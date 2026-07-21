# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""POST /assignments/compose: create a template and assign it in one transaction."""


def _compose(client, headers, subject_id, **overrides):
    payload = {
        "name": "Composed worksheet",
        "subject_id": subject_id,
        "assignment_type": "homework",
        "max_points": 50,
        "is_library": False,
        "student_ids": [],
        **overrides,
    }
    return client.post("/api/assignments/compose", json=payload, headers=headers)


def test_compose_creates_template_and_assignments(
    client, admin_headers, classroom, student_factory
):
    student, _ = student_factory()
    r = _compose(
        client, admin_headers, classroom["subject"]["id"],
        student_ids=[student["id"]], custom_max_points=25,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["template"]["is_library"] is False
    assert len(body["created_assignment_ids"]) == 1

    sa = client.get(
        f"/api/assignments/student-assignments/{body['created_assignment_ids'][0]}",
        headers=admin_headers,
    ).json()
    assert sa["template_id"] == body["template"]["id"]
    assert sa["custom_max_points"] == 25


def test_compose_without_students_creates_template_only(
    client, admin_headers, classroom
):
    r = _compose(client, admin_headers, classroom["subject"]["id"], is_library=True)
    assert r.status_code == 200, r.text
    assert r.json()["created_assignment_ids"] == []


def test_compose_unknown_student_creates_nothing(
    client, admin_headers, classroom
):
    # Distinct name: tables persist across the session (see conftest), so a
    # generic name could collide with a template another test created.
    unique_name = "Atomicity probe worksheet"
    r = _compose(
        client, admin_headers, classroom["subject"]["id"],
        name=unique_name, student_ids=[999999],
    )
    assert r.status_code == 404, r.text
    # Atomicity: the template must not have been created.
    names = [t["name"] for t in client.get(
        "/api/assignments/templates?include_one_offs=true", headers=admin_headers
    ).json()]
    assert unique_name not in names
