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

"""One-off templates (is_library=False) are hidden from the default list."""


def _create_template(client, headers, name, is_library=True, subject_id=None):
    return client.post(
        "/api/assignments/templates",
        json={
            "name": name,
            "subject_id": subject_id,
            "assignment_type": "homework",
            "max_points": 100,
            "is_library": is_library,
        },
        headers=headers,
    )


def test_one_off_template_hidden_from_default_list(client, admin_headers, classroom):
    subject_id = classroom["subject"]["id"]
    r = _create_template(client, admin_headers, "Library one", True, subject_id)
    assert r.status_code == 200, r.text
    assert r.json()["is_library"] is True

    r = _create_template(client, admin_headers, "One-off", False, subject_id)
    assert r.status_code == 200, r.text
    one_off_id = r.json()["id"]

    names = [t["name"] for t in client.get(
        "/api/assignments/templates", headers=admin_headers
    ).json()]
    assert "Library one" in names
    assert "One-off" not in names

    with_one_offs = [t["id"] for t in client.get(
        "/api/assignments/templates?include_one_offs=true", headers=admin_headers
    ).json()]
    assert one_off_id in with_one_offs
