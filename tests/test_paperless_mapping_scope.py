"""Scoped mapping candidates, explicit choices, and safe sync publication."""

# Fixtures imported from the integration suite are resolved by pytest by name.
# ruff: noqa: F811
import pytest

from app.models.paperless import PaperlessConnection
from app.services import paperless_client
from test_paperless import (  # noqa: F401
    BASE,
    fake_factory,
    paperless_env,
    _reconnect_with_scope,
    _sync_and_wait,
    _doc_pk,
)


def status(client, headers):
    response = client.get(f"{BASE}/status", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def candidates(body, key, identity):
    return {row[identity] for row in body[key] if row["in_scope"]}


@pytest.mark.parametrize(
    "scope,tag_indexes,type_indexes",
    [
        ("tag", [0], [0, 1]),
        ("type", [0, 1], [0]),
        ("union", [0, 1], [0, 1]),
        ("all", [0, 1, 2], [0, 1]),
        ("empty", [], []),
    ],
)
def test_candidates_are_metadata_used_by_scoped_documents(
    client, admin_headers, paperless_env, scope, tag_indexes, type_indexes
):
    library = paperless_env["library"]
    filters = {}
    if scope in {"tag", "union"}:
        filters["scope_tag_ids"] = [library["tags"][0]["id"]]
    if scope in {"type", "union"}:
        filters["scope_doctype_ids"] = [library["doctypes"][0]["id"]]
    if scope == "empty":
        filters["scope_tag_ids"] = [999999999]
    body = _reconnect_with_scope(client, admin_headers, paperless_env, filters)
    assert body["mapping_options_ready"]
    assert candidates(body, "tag_maps", "paperless_tag_id") == {
        library["tags"][i]["id"] for i in tag_indexes
    }
    assert candidates(body, "doctype_maps", "paperless_doctype_id") == {
        library["doctypes"][i]["id"] for i in type_indexes
    }
    assert all(not row["configured"] for row in body["tag_maps"] if row["in_scope"])
    assert all(not row["configured"] for row in body["doctype_maps"] if row["in_scope"])
    # Scope selection deliberately still offers the complete upstream catalogue.
    picker = client.get(f"{BASE}/scope-options", headers=admin_headers).json()
    assert {row["id"] for row in picker["document_types"]} == {
        row["id"] for row in library["doctypes"]
    }


def test_candidates_include_carried_tags_outside_scope_roots(
    client, admin_headers, paperless_env
):
    library = paperless_env["library"]
    library["documents"][0]["tags"].append(library["tags"][2]["id"])
    body = _reconnect_with_scope(
        client,
        admin_headers,
        paperless_env,
        {"scope_tag_ids": [library["tags"][0]["id"]]},
    )
    assert candidates(body, "tag_maps", "paperless_tag_id") == {
        library["tags"][i]["id"] for i in [0, 2]
    }


def test_unmapped_documents_still_offer_mapping_choices(
    client, admin_headers, paperless_env
):
    library = paperless_env["library"]
    tag_id, type_id = library["tags"][2]["id"], library["doctypes"][2]["id"]
    library["documents"][3]["document_type"] = type_id
    response = client.patch(
        f"{BASE}/settings",
        json={"mapped_only": True, "scope_tag_ids": [tag_id]},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    body = status(client, admin_headers)
    assert body["document_count"] == 0
    assert candidates(body, "tag_maps", "paperless_tag_id") == {tag_id}
    assert candidates(body, "doctype_maps", "paperless_doctype_id") == {type_id}
    response = client.patch(
        f"{BASE}/settings",
        json={
            "tag_maps": [
                {"paperless_tag_id": tag_id, "subject_id": paperless_env["math"]["id"]}
            ]
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    assert status(client, admin_headers)["document_count"] == 1
    # The suite uses a shared database; restore the setting for later fixtures.
    assert (
        client.patch(
            f"{BASE}/settings", json={"mapped_only": False}, headers=admin_headers
        ).status_code
        == 200
    )


def test_manual_rows_survive_scope_changes_and_removal_restores_defaults(
    client, admin_headers, paperless_env, db_session
):
    library = paperless_env["library"]
    tag_id, type_id = library["tags"][0]["id"], library["doctypes"][1]["id"]
    doc = _doc_pk(db_session, library["documents"][1]["id"])
    lesson = client.post(
        "/api/lessons/",
        json={"title": "Mapping snapshot", "date": "2026-10-05"},
        headers=admin_headers,
    ).json()["lesson"]
    snapshot = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert snapshot.status_code == 201, snapshot.text
    response = client.patch(
        f"{BASE}/settings",
        json={
            "tag_maps": [
                {"paperless_tag_id": tag_id, "subject_id": paperless_env["sci"]["id"]}
            ],
            "doctype_maps": [
                {"paperless_doctype_id": type_id, "material_kind": "reading"}
            ],
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = _reconnect_with_scope(
        client,
        admin_headers,
        paperless_env,
        {"scope_tag_ids": [library["tags"][1]["id"]]},
    )
    assert next(row for row in body["tag_maps"] if row["paperless_tag_id"] == tag_id)[
        "configured"
    ]
    assert not next(
        row for row in body["tag_maps"] if row["paperless_tag_id"] == tag_id
    )["in_scope"]
    assert not next(
        row for row in body["doctype_maps"] if row["paperless_doctype_id"] == type_id
    )["in_scope"]
    body = _reconnect_with_scope(
        client, admin_headers, paperless_env, {"scope_tag_ids": [tag_id]}
    )
    assert next(row for row in body["tag_maps"] if row["paperless_tag_id"] == tag_id)[
        "in_scope"
    ]
    response = client.patch(
        f"{BASE}/settings",
        json={"remove_tag_map_ids": [tag_id], "remove_doctype_map_ids": [type_id]},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    tag = next(row for row in body["tag_maps"] if row["paperless_tag_id"] == tag_id)
    dtype = next(
        row for row in body["doctype_maps"] if row["paperless_doctype_id"] == type_id
    )
    assert (
        not tag["configured"]
        and tag["auto_matched"]
        and tag["subject_id"] == paperless_env["math"]["id"]
    )
    assert not dtype["configured"] and dtype["material_kind"] == "test"
    db_session.expire_all()
    cached = _doc_pk(db_session, library["documents"][1]["id"])
    assert (
        cached.subject_id == paperless_env["math"]["id"]
        and cached.material_kind == "test"
    )
    attachments = client.get(
        f"/api/lessons/{lesson['id']}", headers=admin_headers
    ).json()["paperless_materials"]
    assert attachments[0]["subject_id"] == snapshot.json()["subject_id"]
    assert attachments[0]["material_kind"] == snapshot.json()["material_kind"]
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    assert not next(
        row
        for row in status(client, admin_headers)["tag_maps"]
        if row["paperless_tag_id"] == tag_id
    )["configured"]


def test_stale_outside_and_conflicting_mapping_edits_are_rejected(
    client, admin_headers, paperless_env
):
    library = paperless_env["library"]
    tag_id, outside_id = library["tags"][0]["id"], library["tags"][1]["id"]
    _reconnect_with_scope(
        client, admin_headers, paperless_env, {"scope_tag_ids": [tag_id]}
    )
    change = {"paperless_tag_id": outside_id, "subject_id": None}
    assert (
        client.patch(
            f"{BASE}/settings", json={"tag_maps": [change]}, headers=admin_headers
        ).status_code
        == 409
    )
    assert (
        client.patch(
            f"{BASE}/settings",
            json={
                "doctype_maps": [
                    {
                        "paperless_doctype_id": library["doctypes"][2]["id"],
                        "material_kind": "other",
                    }
                ]
            },
            headers=admin_headers,
        ).status_code
        == 409
    )
    change["paperless_tag_id"] = tag_id
    assert (
        client.patch(
            f"{BASE}/settings",
            json={"tag_maps": [change], "remove_tag_map_ids": [tag_id]},
            headers=admin_headers,
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"{BASE}/settings",
            json={"tag_maps": [change, change]},
            headers=admin_headers,
        ).status_code
        == 422
    )
    response = client.patch(
        f"{BASE}/settings", json={"scope_tag_ids": [outside_id]}, headers=admin_headers
    )
    assert not response.json()["mapping_options_ready"]
    assert (
        client.patch(
            f"{BASE}/settings", json={"tag_maps": [change]}, headers=admin_headers
        ).status_code
        == 409
    )
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    assert status(client, admin_headers)["mapping_options_ready"]


@pytest.mark.parametrize("failure", ["partial", "truncated", "cancelled"])
def test_failed_sync_preserves_published_candidates(
    client, admin_headers, paperless_env, monkeypatch, db_session, failure
):
    before = status(client, admin_headers)
    library = paperless_env["library"]

    def incomplete(**kwargs):
        yield {**library["documents"][0], "tags": [999999]}
        if failure == "partial":
            raise paperless_client.PaperlessError("Incomplete scoped inventory")
        if failure == "truncated":
            paperless_env["fake"].truncated = True
        if failure == "cancelled":
            response = client.patch(
                f"{BASE}/settings",
                json={"sync_interval_minutes": 60},
                headers=admin_headers,
            )
            assert response.status_code == 200

    monkeypatch.setattr(paperless_env["fake"], "iter_documents", incomplete)
    result = _sync_and_wait(client, headers=admin_headers).json()
    assert result["state"] == ("cancelled" if failure == "cancelled" else "queued")
    after = status(client, admin_headers)
    assert after["mapping_options_ready"]
    assert after["tag_maps"] == before["tag_maps"]
    assert after["doctype_maps"] == before["doctype_maps"]
    db_session.expire_all()
    conn = db_session.get(PaperlessConnection, 1)
    assert conn.mapping_scope_tag_ids == [] and conn.mapping_scope_doctype_ids == []


def test_inactive_mapping_can_be_removed(client, admin_headers, paperless_env):
    library = paperless_env["library"]
    tag_id = library["tags"][0]["id"]
    assert (
        client.patch(
            f"{BASE}/settings",
            json={"tag_maps": [{"paperless_tag_id": tag_id, "subject_id": None}]},
            headers=admin_headers,
        ).status_code
        == 200
    )
    _reconnect_with_scope(
        client,
        admin_headers,
        paperless_env,
        {"scope_tag_ids": [library["tags"][1]["id"]]},
    )
    response = client.patch(
        f"{BASE}/settings", json={"remove_tag_map_ids": [tag_id]}, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert tag_id not in {
        row["paperless_tag_id"] for row in response.json()["tag_maps"]
    }
