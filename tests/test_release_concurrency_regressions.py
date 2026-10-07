"""Exercise concurrent initial reads and stale reward decisions."""

import concurrent.futures
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from contextlib import contextmanager

import pytest
from sqlalchemy.orm import Session


@contextmanager
def running_api(engine, tmp_path):
    # An actual Uvicorn event loop catches blocking async SQL that TestClient
    # and sequential CRUD tests cannot. Every request uses the disposable DB.
    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    env = {
        **os.environ,
        "DATABASE_URL": engine.url.render_as_string(hide_password=False),
        "LOG_LEVEL": "ERROR",
    }
    with (tmp_path / "server.log").open("w") as log:
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            env=env,
            stdout=log,
            stderr=log,
        )
        base = f"http://127.0.0.1:{port}"
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(
                        base + "/health", timeout=0.3
                    ) as response:
                        assert response.status == 200
                        break
                except OSError:
                    if process.poll() is not None:
                        pytest.fail(
                            "Isolated API exited: "
                            + (tmp_path / "server.log").read_text()
                        )
                    time.sleep(0.05)
            else:
                pytest.fail("Isolated API never became healthy")
            yield base
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def test_concurrent_first_points_reads_leave_backend_responsive(
    engine, tmp_path, student_factory, db_session
):
    from app.models.points import StudentPoints

    student, headers = student_factory()
    assert (
        db_session.query(StudentPoints).filter_by(student_id=student["id"]).count() == 0
    )
    with running_api(engine, tmp_path) as base:
        start = threading.Barrier(9)

        def read(path):
            start.wait(timeout=5)
            request = urllib.request.Request(base + path, headers=headers)
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status

        with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
            futures = [
                pool.submit(
                    read, "/api/points/my-balance" if i % 2 else "/api/points/my-ledger"
                )
                for i in range(8)
            ]
            futures.append(pool.submit(read, "/health"))
            assert [future.result(timeout=8) for future in futures] == [200] * 9
        with urllib.request.urlopen(base + "/health", timeout=1) as response:
            assert response.status == 200
    db_session.expire_all()
    points = db_session.query(StudentPoints).filter_by(student_id=student["id"]).one()
    assert points.current_balance == 0
    assert points.total_earned == 0


@pytest.mark.parametrize("second_action", ["decline", "approve", "fulfill"])
def test_stale_reward_decisions_refund_at_most_once(
    engine, db_session, student_factory, second_action
):
    from app.crud import shop
    from app.models.points import PointTransaction, StudentPoints
    from app.models.shop import ShopCategory, ShopItem

    student, _ = student_factory()
    category = ShopCategory(name="Concurrent decisions")
    db_session.add(category)
    db_session.flush()
    item = ShopItem(
        category_id=category.id,
        name="One reward",
        cost_points=10,
        fulfillment_type="request",
        quantity_available=1,
    )
    db_session.add_all(
        [
            item,
            StudentPoints(
                student_id=student["id"],
                current_balance=100,
                total_earned=100,
                total_spent=0,
            ),
        ]
    )
    db_session.commit()
    redemption, _ = shop.redeem_item(db_session, student["id"], item.id)
    db_session.commit()
    redemption_id, item_id = redemption.id, item.id
    if second_action == "fulfill":
        shop.approve_redemption(db_session, redemption, None)
    # Both callers read the old pending state before either obtains the lock.
    barrier = threading.Barrier(2)

    def decide(action):
        with Session(engine) as session:
            stale = shop.get_redemption(session, redemption_id)
            assert stale.status == (
                "ready" if second_action == "fulfill" else "pending"
            )
            barrier.wait(timeout=5)
            try:
                if action == "decline":
                    shop.decline_redemption(session, stale, None)
                    session.commit()
                elif action == "approve":
                    shop.approve_redemption(session, stale, None)
                else:
                    shop.fulfill_redemption(session, stale)
                return action
            except ValueError:
                session.rollback()
                return "conflict"

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        actions = (
            ["fulfill", "fulfill"]
            if second_action == "fulfill"
            else ["decline", second_action]
        )
        futures = [pool.submit(decide, action) for action in actions]
        outcomes = [future.result(timeout=10) for future in futures]
    assert outcomes.count("conflict") == 1
    db_session.expire_all()
    final = shop.get_redemption(db_session, redemption_id)
    points = db_session.query(StudentPoints).filter_by(student_id=student["id"]).one()
    refunds = (
        db_session.query(PointTransaction)
        .filter_by(student_id=student["id"], transaction_type="refund")
        .count()
    )
    if final.status == "declined":
        assert (
            points.current_balance,
            refunds,
            db_session.get(ShopItem, item_id).quantity_available,
        ) == (100, 1, 1)
    else:
        assert final.status == ("fulfilled" if second_action == "fulfill" else "ready")
        assert (
            points.current_balance,
            refunds,
            db_session.get(ShopItem, item_id).quantity_available,
        ) == (90, 0, 0)


def test_login_limiter_prunes_bounds_and_limits_username_rotation(monkeypatch):
    from app.routers import auth
    from fastapi import HTTPException

    # Do not pollute other tests' login state.
    monkeypatch.setattr(auth, "_login_failures", auth.OrderedDict())
    now = [1000.0]
    monkeypatch.setattr(auth.time, "monotonic", lambda: now[0])
    for i in range(auth._LOGIN_MAX_IP_ATTEMPTS):
        auth._check_login_rate_limit("one-ip", f"user-{i}")
        auth._record_login_failure("one-ip", f"user-{i}")
    with pytest.raises(HTTPException) as limited:
        auth._check_login_rate_limit("one-ip", "another-user")
    assert limited.value.status_code == 429
    # Unrelated check-only requests create no retained state.
    count = len(auth._login_failures)
    for i in range(100):
        auth._check_login_rate_limit(f"check-{i}", "unused")
    assert len(auth._login_failures) == count
    for i in range(auth._LOGIN_MAX_TRACKED_KEYS * 2):
        auth._record_login_failure(f"ip-{i}", "x" * 10_000)
    assert len(auth._login_failures) <= auth._LOGIN_MAX_TRACKED_KEYS
    assert max(len(key[1]) for key in auth._login_failures) <= 64
    now[0] += auth._LOGIN_WINDOW_SECONDS + 1
    auth._check_login_rate_limit("one-ip", "unused")
    assert not auth._login_failures
    for _ in range(auth._LOGIN_MAX_ATTEMPTS):
        auth._record_login_failure("same-ip", "Same-User")
    with pytest.raises(HTTPException):
        auth._check_login_rate_limit("same-ip", "same-user")
    auth._clear_login_failures("same-ip", "SAME-USER")
    auth._check_login_rate_limit("same-ip", "same-user")
