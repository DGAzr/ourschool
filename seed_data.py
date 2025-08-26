#!/usr/bin/env python3
"""
Seed script to create comprehensive test data for OurSchool application.

This script creates:
- Admin and student users
- Subjects
- Terms and term subjects
- Lessons with assignments
- Student assignments
- Attendance records
- Journal entries

All data matches the current database schema.
"""
import os
import sys
from datetime import datetime, date, timedelta

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import init_db, SessionLocal
from app.core.security import get_password_hash

# Import all models
from app.models.user import User
from app.models.lesson import Subject, Lesson, LessonAssignment
from app.models.term import Term, TermSubject, StudentTermGrade
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.attendance import AttendanceRecord
from app.models.journal import JournalEntry

# Import enums
from app.enums import (
    UserRole, TermType, AssignmentType, 
    AssignmentStatus, AttendanceStatus
)

# Import all models to ensure they're properly registered
import app.models

def create_users(db: Session):
    """Create admin and student users."""
    print("\n👥 Creating users...")
    
    # Check if admin user already exists
    existing_admin = db.query(User).filter(User.email == "admin@ourschool.work").first()
    if existing_admin:
        admin_user = existing_admin
        print(f"✅ Using existing admin user: {admin_user.username}")
    else:
        # Create admin user
        admin_user = User(
            email="admin@ourschool.work",
            username="admin",
            hashed_password=get_password_hash("admin123"),
            first_name="Admin",
            last_name="Parent",
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print(f"✅ Created admin user: {admin_user.username}")

    # Create student users
    students_data = [
        {
            "email": "emma@ourschool.work",
            "username": "emma",
            "first_name": "Emma",
            "last_name": "Johnson",
            "date_of_birth": date(2012, 3, 15),
            "grade_level": 5
        },
        {
            "email": "jake@ourschool.work", 
            "username": "jake",
            "first_name": "Jake",
            "last_name": "Smith",
            "date_of_birth": date(2014, 7, 22),
            "grade_level": 3
        },
        {
            "email": "lily@ourschool.work",
            "username": "lily", 
            "first_name": "Lily",
            "last_name": "Brown",
            "date_of_birth": date(2010, 11, 8),
            "grade_level": 7
        }
    ]

    student_users = []
    for student_data in students_data:
        # Check if student already exists
        existing_student = db.query(User).filter(User.email == student_data["email"]).first()
        if existing_student:
            student_user = existing_student
            student_users.append(student_user)
            print(f"✅ Using existing student user: {student_user.username}")
        else:
            student_user = User(
                email=student_data["email"],
                username=student_data["username"],
                hashed_password=get_password_hash("student123"),
                first_name=student_data["first_name"],
                last_name=student_data["last_name"],
                role=UserRole.STUDENT,
                is_active=True,
                parent_id=admin_user.id,
                date_of_birth=student_data["date_of_birth"],
                grade_level=student_data["grade_level"]
            )
            db.add(student_user)
            student_users.append(student_user)
            print(f"✅ Created student user: {student_user.username}")

    db.commit()
    return admin_user, student_users


def create_subjects(db: Session):
    """Create subjects."""
    print("\n📚 Creating subjects...")
    
    subjects_data = [
        {"name": "Mathematics", "description": "Math and arithmetic", "color": "#3B82F6"},
        {"name": "Science", "description": "Natural sciences and experiments", "color": "#10B981"},
        {"name": "English", "description": "Language arts and literature", "color": "#8B5CF6"},
        {"name": "History", "description": "Social studies and world history", "color": "#F59E0B"},
        {"name": "Art", "description": "Creative arts and crafts", "color": "#EF4444"},
        {"name": "Physical Education", "description": "Physical fitness and sports", "color": "#06B6D4"},
    ]

    subjects = []
    for subject_data in subjects_data:
        subject = Subject(**subject_data)
        db.add(subject)
        subjects.append(subject)
        print(f"✅ Created subject: {subject.name}")

    db.commit()
    return subjects


def create_terms_and_term_subjects(db: Session, admin_user: User, subjects: list):
    """Create academic terms and link them to subjects."""
    print("\n📅 Creating terms and term subjects...")
    
    # Create current academic year term
    current_term = Term(
        name="Fall Semester 2024",
        description="Fall semester for 2024-2025 academic year",
        start_date=date(2024, 9, 1),
        end_date=date(2024, 12, 20),
        academic_year="2024-2025",
        term_type=TermType.SEMESTER.value,
        is_active=True,
        term_order=1,
        created_by=admin_user.id
    )
    db.add(current_term)
    db.commit()
    db.refresh(current_term)
    print(f"✅ Created active term: {current_term.name}")

    # Create future term
    spring_term = Term(
        name="Spring Semester 2025",
        description="Spring semester for 2024-2025 academic year", 
        start_date=date(2025, 1, 15),
        end_date=date(2025, 5, 30),
        academic_year="2024-2025",
        term_type=TermType.SEMESTER.value,
        is_active=False,
        term_order=2,
        created_by=admin_user.id
    )
    db.add(spring_term)
    db.commit()
    db.refresh(spring_term)
    print(f"✅ Created future term: {spring_term.name}")

    # Link subjects to current term
    term_subjects = []
    for subject in subjects:
        term_subject = TermSubject(
            term_id=current_term.id,
            subject_id=subject.id,
            is_active=True,
            weight=1.0,
            learning_goals=f"Master key concepts in {subject.name.lower()} for this semester"
        )
        db.add(term_subject)
        term_subjects.append(term_subject)
        print(f"✅ Linked {subject.name} to {current_term.name}")

    db.commit()
    return current_term, spring_term, term_subjects


def create_lessons_and_assignments(db: Session, admin_user: User, subjects: list):
    """Create lessons and assignment templates."""
    print("\n📝 Creating lessons and assignments...")
    
    lessons_data = [
        {
            "title": "Introduction to Algebra",
            "description": "Basic algebraic concepts and solving simple equations",
            "subject": "Mathematics",
            "scheduled_date": date.today() - timedelta(days=7),
            "assignments": [
                {
                    "name": "Solving Linear Equations",
                    "description": "Practice solving basic linear equations", 
                    "type": AssignmentType.WORKSHEET.value,
                    "max_points": 50
                },
                {
                    "name": "Algebra Word Problems",
                    "description": "Apply algebra to real-world scenarios",
                    "type": AssignmentType.HOMEWORK.value,
                    "max_points": 75
                }
            ]
        },
        {
            "title": "Plant Biology",
            "description": "Learn about plant structures and photosynthesis",
            "subject": "Science", 
            "scheduled_date": date.today() - timedelta(days=5),
            "assignments": [
                {
                    "name": "Plant Parts Diagram",
                    "description": "Label and describe plant parts",
                    "type": AssignmentType.WORKSHEET.value,
                    "max_points": 40
                },
                {
                    "name": "Photosynthesis Lab Report",
                    "description": "Write report on photosynthesis experiment",
                    "type": AssignmentType.PROJECT.value,
                    "max_points": 100
                }
            ]
        },
        {
            "title": "Creative Writing Workshop",
            "description": "Explore different writing styles and techniques",
            "subject": "English",
            "scheduled_date": date.today() - timedelta(days=3),
            "assignments": [
                {
                    "name": "Short Story Draft",
                    "description": "Write a 500-word short story",
                    "type": AssignmentType.ESSAY.value,
                    "max_points": 80
                }
            ]
        }
    ]
    
    subject_map = {s.name: s for s in subjects}
    lessons = []
    assignment_templates = []
    
    for lesson_data in lessons_data:
        subject = subject_map[lesson_data["subject"]]
        
        # Create lesson
        lesson = Lesson(
            title=lesson_data["title"],
            description=lesson_data["description"],
            scheduled_date=lesson_data["scheduled_date"],
            estimated_duration_minutes=60,
            objectives=f"Students will understand {lesson_data['description'].lower()}",
            lesson_order=len(lessons) + 1
        )
        db.add(lesson)
        db.commit()
        db.refresh(lesson)
        lessons.append(lesson)
        print(f"✅ Created lesson: {lesson.title}")
        
        # Create assignment templates for this lesson
        for i, assignment_data in enumerate(lesson_data["assignments"]):
            template = AssignmentTemplate(
                name=assignment_data["name"],
                description=assignment_data["description"],
                instructions=f"Complete {assignment_data['name']} as part of {lesson.title}",
                assignment_type=assignment_data["type"],
                lesson_id=lesson.id,
                subject_id=subject.id,
                max_points=assignment_data["max_points"],
                estimated_duration_minutes=30,
                order_in_lesson=i + 1,
                created_by=admin_user.id
            )
            db.add(template)
            assignment_templates.append(template)
            print(f"  ✅ Created assignment template: {template.name}")
            
        # Create lesson-assignment relationships
        db.commit()
        for i, template in enumerate(assignment_templates[-len(lesson_data["assignments"]):]):
            lesson_assignment = LessonAssignment(
                lesson_id=lesson.id,
                assignment_template_id=template.id,
                order_in_lesson=i + 1,
                planned_duration_minutes=30,
                is_required=True
            )
            db.add(lesson_assignment)
            print(f"    ✅ Linked assignment to lesson: {template.name}")
    
    db.commit()
    return lessons, assignment_templates


def create_student_assignments(db: Session, admin_user: User, student_users: list, assignment_templates: list):
    """Create student assignment instances."""
    print("\n📋 Creating student assignments...")
    
    student_assignments = []
    
    for student in student_users:
        for template in assignment_templates:
            # Assign recent assignments to students
            if template.lesson and template.lesson.scheduled_date >= (date.today() - timedelta(days=10)):
                assignment = StudentAssignment(
                    template_id=template.id,
                    student_id=student.id,
                    assigned_date=template.lesson.scheduled_date,
                    due_date=template.lesson.scheduled_date + timedelta(days=3),
                    status=AssignmentStatus.NOT_STARTED.value,
                    assigned_by=admin_user.id
                )
                
                # Simulate some completed assignments
                if template.lesson.scheduled_date < date.today() - timedelta(days=2):
                    assignment.status = AssignmentStatus.COMPLETED.value
                    assignment.completed_date = template.lesson.scheduled_date + timedelta(days=1)
                    assignment.points_earned = template.max_points * 0.85  # 85% average
                    assignment.is_graded = True
                    assignment.graded_date = assignment.completed_date
                    assignment.graded_by = admin_user.id
                    assignment.calculate_percentage_grade()
                    assignment.teacher_feedback = "Good work! Keep practicing."
                
                db.add(assignment)
                student_assignments.append(assignment)
                print(f"  ✅ Assigned '{template.name}' to {student.first_name}")
    
    db.commit()
    return student_assignments


def create_student_term_grades(db: Session, student_users: list, term_subjects: list):
    """Create student term grade records."""
    print("\n📊 Creating student term grades...")
    
    for student in student_users:
        for term_subject in term_subjects:
            student_term_grade = StudentTermGrade(
                student_id=student.id,
                term_subject_id=term_subject.id,
                current_points_earned=0.0,
                current_points_possible=0.0,
                assignments_completed=0,
                assignments_total=0,
                learning_goals=f"Excel in {term_subject.subject.name} this semester",
                strengths="Shows good effort and participation"
            )
            db.add(student_term_grade)
            print(f"  ✅ Created grade record: {student.first_name} - {term_subject.subject.name}")
    
    db.commit()


def create_attendance_records(db: Session, student_users: list):
    """Create attendance records for students."""
    print("\n📅 Creating attendance records...")
    
    # Create attendance for the past 2 weeks
    start_date = date.today() - timedelta(days=14)
    
    for student in student_users:
        for i in range(14):
            record_date = start_date + timedelta(days=i)
            
            # Skip weekends
            if record_date.weekday() >= 5:
                continue
                
            # Most days present, occasional absences
            if i % 7 == 0:  # Occasional absence
                status = AttendanceStatus.ABSENT.value
                notes = "Family appointment"
            elif i % 11 == 0:  # Occasional tardiness
                status = AttendanceStatus.LATE.value
                notes = "Traffic delay"
            else:
                status = AttendanceStatus.PRESENT.value
                notes = None
            
            attendance = AttendanceRecord(
                student_id=student.id,
                date=record_date,
                status=status,
                notes=notes
            )
            db.add(attendance)
            
        print(f"  ✅ Created attendance records for {student.first_name}")
    
    db.commit()


def create_journal_entries(db: Session, admin_user: User, student_users: list):
    """Create sample journal entries."""
    print("\n📖 Creating journal entries...")
    
    entries_data = [
        {
            "title": "Great Progress in Math",
            "content": "Emma showed excellent understanding of algebraic concepts today. She completed all practice problems and helped other students.",
            "student": "emma"
        },
        {
            "title": "Science Experiment Success", 
            "content": "Jake was very engaged during the plant biology lesson. His observations were detailed and thoughtful.",
            "student": "jake"
        },
        {
            "title": "Creative Writing Breakthrough",
            "content": "Lily's short story draft shows real creativity and strong character development. Encourage her to continue developing this talent.",
            "student": "lily"
        },
        {
            "title": "Weekly Progress Review",
            "content": "All students are making good progress this week. Math concepts are being grasped well, and science experiments are generating great discussions.",
            "student": "emma"  # General entry for first student
        }
    ]
    
    student_map = {s.username: s for s in student_users}
    
    for entry_data in entries_data:
        student = student_map[entry_data["student"]]
        
        entry = JournalEntry(
            student_id=student.id,
            author_id=admin_user.id,
            title=entry_data["title"],
            content=entry_data["content"],
            entry_date=datetime.now() - timedelta(days=len(entries_data) - entries_data.index(entry_data))
        )
        db.add(entry)
        print(f"  ✅ Created journal entry: {entry.title}")
    
    db.commit()


def create_admin_only():
    """Create only the admin user."""
    print("🌱 Creating admin user only...")
    
    # Initialize database connection - this uses settings from .env file
    init_db()
    from app.core.database import SessionLocal as DB_SessionLocal
    db = DB_SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.email == "admin@ourschool.work").first()
        if existing_admin:
            print(f"✅ Admin user already exists: {existing_admin.username}")
            return existing_admin
            
        # Create admin user
        admin_user = User(
            email="admin@ourschool.work",
            username="admin",
            hashed_password=get_password_hash("admin123"),
            first_name="Admin",
            last_name="Parent",
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("\n🎉 Admin user created successfully!")
        print("\n📝 Login Credentials:")
        print("  Email: admin@ourschool.work")
        print("  Username: admin")
        print("  Password: admin123")
        
        return admin_user
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


def create_test_data():
    """Create comprehensive test data for the application."""
    print("🌱 Initializing OurSchool test data...")
    
    # Initialize database connection - this uses settings from .env file
    init_db()
    from app.core.database import SessionLocal as DB_SessionLocal
    db = DB_SessionLocal()
    
    try:
        # Create all test data
        admin_user, student_users = create_users(db)
        subjects = create_subjects(db)
        current_term, spring_term, term_subjects = create_terms_and_term_subjects(db, admin_user, subjects)
        lessons, assignment_templates = create_lessons_and_assignments(db, admin_user, subjects)
        student_assignments = create_student_assignments(db, admin_user, student_users, assignment_templates)
        create_student_term_grades(db, student_users, term_subjects)
        create_attendance_records(db, student_users)
        create_journal_entries(db, admin_user, student_users)
        
        print("\n🎉 Test data created successfully!")
        print("\n📝 Login Credentials:")
        print("\nAdmin account:")
        print("  Email: admin@ourschool.work")
        print("  Username: admin")
        print("  Password: admin123")
        print("\nStudent accounts:")
        for student in student_users:
            print(f"  Email: {student.email}")
            print(f"  Username: {student.username}")
            print(f"  Password: student123")
            print(f"  Name: {student.first_name} {student.last_name}")
            print()
            
        print("📊 Data Summary:")
        print(f"  • {len(student_users)} student users")
        print(f"  • {len(subjects)} subjects")
        print(f"  • 2 academic terms")
        print(f"  • {len(lessons)} lessons")
        print(f"  • {len(assignment_templates)} assignment templates")
        print(f"  • {len(student_assignments)} student assignments")
        print(f"  • 10+ attendance records per student")
        print(f"  • 4 journal entries")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    # By default, create only admin user
    # Run with python seed_data.py --full to create all test data
    import sys
    if "--full" in sys.argv:
        create_test_data()
    else:
        create_admin_only()
