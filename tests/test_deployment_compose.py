"""Validate deployment modes with Compose itself, without starting containers."""

import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[1]
BASES = ["docker-compose.yml", "docker-compose.ghcr.yml"]
EXTERNAL = "docker-compose.external-db.yml"
DEV = "docker-compose.dev.yml"


@pytest.fixture(scope="module")
def docker_compose():
    docker = shutil.which("docker")
    available = (
        docker
        and subprocess.run(
            [docker, "compose", "version"], capture_output=True, timeout=15
        ).returncode
        == 0
    )
    if not available:
        if os.environ.get("CI"):
            pytest.fail("CI requires Docker Compose 2.20+ for deployment tests")
        pytest.skip("Docker Compose 2.20+ is required")
    return docker


@pytest.fixture()
def config(docker_compose, tmp_path):
    # Never consume the checkout's .env or inherited application credentials.
    empty_env = tmp_path / "empty.env"
    empty_env.write_text("")
    environment = {
        key: value
        for key, value in os.environ.items()
        if key in {"PATH", "HOME", "TMPDIR", "DOCKER_CONFIG"}
    }

    def render(files, values=None, secret=True, profiles=()):
        command = [
            docker_compose,
            "compose",
            "--env-file",
            str(empty_env),
            "--project-directory",
            str(ROOT),
        ]
        for file in files:
            command.extend(["-f", str(ROOT / file)])
        for profile in profiles:
            command.extend(["--profile", profile])
        command.extend(["config", "--format", "json"])
        env = {**environment, **(values or {})}
        if secret:
            env["SECRET_KEY"] = "compose-configuration-test-only-secret"
        result = subprocess.run(
            command, env=env, capture_output=True, text=True, timeout=20
        )
        if not secret:
            return result
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)

    return render


@pytest.mark.parametrize("base", BASES)
def test_production_defaults_start_bundled_database_and_publish_only_frontend(
    config, base
):
    model = config([base])
    services = model["services"]
    assert set(services) == {"db", "backend", "frontend"}
    assert not services["db"].get("profiles")
    assert services["db"]["image"] == "postgres:15-alpine"
    assert services["db"]["volumes"][0]["source"] == "postgres_data"
    assert services["db"]["expose"] == ["5432"]
    assert services["backend"]["expose"] == ["8000"]
    assert not services["db"].get("ports")
    assert not services["backend"].get("ports")
    assert services["frontend"]["ports"][0]["published"] == "4173"
    assert services["frontend"]["ports"][0]["target"] == 80
    assert services["backend"]["depends_on"]["db"] == {
        "condition": "service_healthy",
        "required": True,
    }
    assert services["frontend"]["depends_on"]["backend"] == {
        "condition": "service_healthy",
        "required": True,
    }
    assert services["backend"]["environment"]["DATABASE_HOST"] == "db"
    assert services["backend"]["environment"]["DATABASE_PORT"] == "5432"
    assert services["backend"]["environment"]["BACKEND_PORT"] == "8000"
    assert services["backend"]["command"] == ["./start.sh"]
    assert (
        services["backend"]["healthcheck"]["test"][-1] == "http://localhost:8000/health"
    )
    assert not services["backend"].get("volumes")
    assert not services["frontend"].get("command")


@pytest.mark.parametrize("base", BASES)
@pytest.mark.parametrize("url", [False, True])
def test_external_database_mode_preserves_both_connection_styles(config, base, url):
    values = {
        "DATABASE_HOST": "external-db",
        "DATABASE_PORT": "6543",
        "DATABASE_NAME": "school",
        "DATABASE_USER": "school-user",
        "DATABASE_PASSWORD": "synthetic",
    }
    if url:
        values["DATABASE_URL"] = (
            "postgresql+psycopg://demo:synthetic@url-db:5432/school"
        )
    services = config([base, EXTERNAL], values)["services"]
    assert set(services) == {"backend", "frontend"}
    assert not services["backend"].get("ports")
    assert not services["backend"]["depends_on"]["db"]["required"]
    for key, value in values.items():
        assert services["backend"]["environment"][key] == value
    assert services["backend"]["environment"]["DATABASE_URL"] == values.get(
        "DATABASE_URL", ""
    )


@pytest.mark.parametrize("external", [False, True])
@pytest.mark.parametrize("custom_ports", [False, True])
def test_development_is_explicit_with_loopback_host_ports_and_fixed_container_ports(
    config, external, custom_ports
):
    files = [BASES[0], DEV] + ([EXTERNAL] if external else [])
    values = (
        {"BACKEND_PORT": "18000", "POSTGRES_PORT": "15432", "FRONTEND_PORT": "14173"}
        if custom_ports
        else {}
    )
    if external:
        values["DATABASE_URL"] = (
            "postgresql+psycopg://demo:synthetic@external-db:5432/school"
        )
    services = config(files, values)["services"]
    backend_port = services["backend"]["ports"][0]
    assert backend_port["host_ip"] == "127.0.0.1"
    assert backend_port["published"] == values.get("BACKEND_PORT", "8000")
    assert backend_port["target"] == 8000
    assert services["backend"]["environment"]["BACKEND_PORT"] == "8000"
    assert services["frontend"]["ports"][0]["published"] == values.get(
        "FRONTEND_PORT", "4173"
    )
    assert services["frontend"]["build"]["target"] == "builder"
    assert services["frontend"]["environment"]["PROXY_TARGET"] == "http://backend:8000"
    assert services["frontend"]["environment"]["CHOKIDAR_USEPOLLING"] == "true"
    assert services["frontend"]["command"][-2:] == ["--port", "80"]
    assert services["backend"]["volumes"][0]["read_only"]
    assert any(
        mount["target"] == "/app/node_modules"
        for mount in services["frontend"]["volumes"]
    )
    if external:
        assert "db" not in services
    else:
        db_port = services["db"]["ports"][0]
        assert db_port["host_ip"] == "127.0.0.1"
        assert db_port["published"] == values.get("POSTGRES_PORT", "5432")
        assert db_port["target"] == 5432
        assert services["backend"]["environment"]["DATABASE_PORT"] == "5432"


@pytest.mark.parametrize("base", BASES)
def test_missing_secret_is_rejected(config, base):
    result = config([base], secret=False)
    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr


@pytest.mark.parametrize("base", BASES)
def test_legacy_local_db_flag_is_unnecessary_but_still_harmless(config, base):
    assert set(config([base], profiles=["local-db"])["services"]) == {
        "db",
        "backend",
        "frontend",
    }


def test_ghcr_defaults_select_a_published_release(config):
    services = config(["docker-compose.ghcr.yml"])["services"]
    assert services["backend"]["image"] == "ghcr.io/dgazr/ourschool-backend:v1.1-beta5"
    assert (
        services["frontend"]["image"] == "ghcr.io/dgazr/ourschool-frontend:v1.1-beta5"
    )
