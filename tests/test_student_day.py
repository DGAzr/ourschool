"""The student day combines scheduled work without changing records or privacy."""

from datetime import date, timedelta

from app.enums import AssignmentStatus
from app.models.assignment import StudentAssignment

TODAY = date.today()


def lesson(client, admin_headers, student, template=None, **values):
    response = client.post('/api/lessons/', headers=admin_headers, json={
        'title': 'Student day lesson', 'date': TODAY.isoformat(),
        'student_ids': [student['id']],
        'templates': [{'template_id': template['id']}] if template else [],
        **values,
    })
    assert response.status_code == 200, response.text
    return response.json()['lesson']


def day(client, headers):
    response = client.get('/api/lessons/my-day', params={'date': TODAY.isoformat()}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_day_uses_lesson_order_not_deadlines_and_only_own_work(client, admin_headers, student_factory, classroom):
    student, headers = student_factory()
    outsider, outsider_headers = student_factory()
    first = lesson(client, admin_headers, student, classroom['template'], title='First', notes='Private teacher notes',
                   student_ids=[student['id'], outsider['id']], templates=[{'template_id': classroom['template']['id'], 'due_offset_days': 30}])
    second = lesson(client, admin_headers, student, title='Teacher time')
    waiting = lesson(client, admin_headers, student, title='Not assigned', templates=[{'template_id': classroom['template']['id'], 'assignment_timing': 'draft'}])
    payload = day(client, headers)
    assert [row['id'] for row in payload['lessons']] == [first['id'], second['id'], waiting['id']]
    [work] = payload['lessons'][0]['assignments']
    assert work['student_id'] == student['id']
    assert work['due_date'] == (TODAY + timedelta(days=30)).isoformat()
    assert work['name'] == classroom['template']['name']
    assert not {'student_notes', 'teacher_feedback', 'points_earned', 'students', 'notes', 'materials'} & work.keys()
    assert not {'students', 'notes', 'materials'} & payload['lessons'][0].keys()
    assert payload['lessons'][2]['assignments'] == []
    other_work = day(client, outsider_headers)['lessons'][0]['assignments'][0]
    assert other_work['id'] != work['id']
    assert client.get(f"/api/lessons/my-lessons/{second['id']}", headers=outsider_headers).status_code == 404


def test_day_keeps_taught_lessons_actionable_and_context_survives_drawer(client, admin_headers, student_factory, classroom):
    student, headers = student_factory()
    planned = lesson(client, admin_headers, student, classroom['template'])
    assert client.patch(f"/api/lessons/{planned['id']}/status", headers=admin_headers, json={'status': 'taught'}).status_code == 200
    [entry] = day(client, headers)['lessons']
    assert entry['status'] == 'taught'
    assert entry['assignments'][0]['status'] == 'not_started'
    response = client.put(f"/api/lessons/{planned['id']}", headers=admin_headers, json={'date': None})
    assert response.status_code == 200, response.text
    context = client.get(f"/api/lessons/my-lessons/{planned['id']}", headers=headers)
    assert context.status_code == 200, context.text
    assert context.json()['date'] is None
    assert context.json()['assignments'][0]['id'] == entry['assignments'][0]['id']


def test_day_classifies_standalone_extensions_older_and_long_projects(client, admin_headers, student_factory, classroom, db_session):
    student, headers = student_factory()
    rows = []
    for i in range(10):
        row = StudentAssignment(template_id=classroom['template']['id'], student_id=student['id'],
                                assigned_by=classroom['template']['created_by'], assigned_date=TODAY - timedelta(days=10),
                                due_date=TODAY - timedelta(days=1))
        db_session.add(row)
        rows.append(row)
    # Two current standalone activities; a future project remains outside today.
    rows[0].due_date = TODAY
    rows[1].extended_due_date = TODAY
    rows[2].due_date = TODAY + timedelta(days=30)
    rows[2].status = AssignmentStatus.IN_PROGRESS
    rows[2].started_date = TODAY
    db_session.commit()
    ids = [row.id for row in rows]
    payload = day(client, headers)
    assert {a['id'] for a in payload['standalone']} == set(ids[:2])
    assert payload['earlier']['total'] == 7
    assert len(payload['earlier']['items']) == 6
    assert payload['other']['total'] == 1
    assert payload['other']['items'][0]['id'] == ids[2]
    assert payload['other']['items'][0]['status'] == 'in_progress'
    assert not (set(ids[:2]) & {a['id'] for a in payload['earlier']['items']})
    db_session.expire_all()
    assert rows[0].status == AssignmentStatus.NOT_STARTED
    assert rows[1].due_date == TODAY - timedelta(days=1)


def test_day_rejects_admin_and_requires_explicit_school_date(client, admin_headers, student_factory):
    _, headers = student_factory()
    assert client.get('/api/lessons/my-day', headers=headers).status_code == 422
    assert client.get('/api/lessons/my-day', params={'date': 'invalid'}, headers=headers).status_code == 422
    assert client.get('/api/lessons/my-day', params={'date': TODAY.isoformat()}, headers=admin_headers).status_code == 403
    assert client.get('/api/lessons/my-lessons/1', headers=admin_headers).status_code == 403
