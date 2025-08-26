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

"""APIs for users."""
import secrets
import string
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.dual_auth import AuthUser, require_admin_or_permission
from app.models.assignment import StudentAssignment
from app.models.attendance import AttendanceRecord
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user, get_current_user
from app.schemas.user import User as UserSchema
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter()


optional_auth = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    db: Annotated[Session, Depends(get_db)],
    token: Optional[HTTPAuthorizationCredentials] = Depends(optional_auth),
) -> Optional[User]:
    """Get current user if authenticated, None if not."""
    if not token:
        return None
    
    try:
        return await get_current_user(token.credentials, db)
    except HTTPException:
        return None


@router.post("/", response_model=UserSchema)
async def create_user(
    user: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
):
    """Create a new user."""
    # Check if there are any existing users for initial signup
    existing_users_count = db.query(User).count()
    
    if existing_users_count == 0:
        # Allow first user creation without authentication
        pass
    elif current_user and current_user.role == UserRole.ADMIN:
        # Allow admin users to create new users
        pass
    else:
        # Deny access if not first user and not authenticated admin
        raise HTTPException(
            status_code=403, detail="Only administrators can create users"
        )

    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Validate student-specific fields if creating a student
    if user.role == UserRole.STUDENT:
        if not user.date_of_birth or not user.grade_level:
            raise HTTPException(
                status_code=400,
                detail="Student users require date_of_birth and grade_level",
            )
        if current_user and not user.parent_id:
            # If creating as admin, set current admin as parent
            user.parent_id = current_user.id

    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        parent_id=user.parent_id if user.role == UserRole.STUDENT else None,
        date_of_birth=user.date_of_birth if user.role == UserRole.STUDENT else None,
        grade_level=user.grade_level if user.role == UserRole.STUDENT else None,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/", response_model=List[UserSchema])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all users."""
    if current_user.role == UserRole.ADMIN:
        # Admins see all users in the system
        return db.query(User).all()
    if current_user.role == UserRole.STUDENT:
        # Students only see their own profile
        return [current_user]
    raise HTTPException(status_code=403, detail="Access denied")


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete users"
        )

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Handle cascade deletion manually
    # If deleting a parent admin, find all managed students
    if db_user.role == UserRole.ADMIN:
        managed_students = db.query(User).filter(User.parent_id == user_id).all()
        for student in managed_students:
            # Delete all academic records for each managed student
            db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student.id
            ).delete()
            db.query(StudentAssignment).filter(
                StudentAssignment.student_id == student.id
            ).delete()
            # Delete the student user
            db.delete(student)

    # If deleting a student, clean up their academic records
    if db_user.role == UserRole.STUDENT:
        db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == user_id
        ).delete()
        db.query(StudentAssignment).filter(
            StudentAssignment.student_id == user_id
        ).delete()

    # Now safe to delete the user
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get the current user."""
    return current_user


@router.get("/students", response_model=List[UserSchema])
def list_students(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all students managed by the current admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can list students"
        )

    # Return all students for admins in homeschool context
    return (
        db.query(User)
        .filter(User.role == UserRole.STUDENT)
        .all()
    )


@router.get("/{user_id}", response_model=UserSchema)
def read_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific user."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Access control: admins can see all users, students can only see themselves
    if current_user.role == UserRole.STUDENT:
        if db_user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    # Admins have access to all users in homeschool context

    return db_user


@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a user."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    # Use a mix of letters, digits, and safe special characters
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Reset a user's password to a temporary password (Admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can reset passwords",
        )

    # Find the user to reset
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Admin can reset any user's password, but let's add a safety check
    # to prevent admins from resetting other admin passwords (optional security measure)
    if target_user.role == UserRole.ADMIN and target_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot reset another administrator's password",
        )

    # Generate a temporary password
    temp_password = generate_temporary_password()

    # Hash and update the password
    target_user.hashed_password = get_password_hash(temp_password)

    db.commit()
    db.refresh(target_user)

    return {
        "message": f"Password reset successfully for {target_user.username}",
        "temporary_password": temp_password,
        "user_id": target_user.id,
        "username": target_user.username,
    }


@router.post("/me/change-password")
def change_my_password(
    password_data: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Allow users to change their own password."""
    from app.core.security import verify_password

    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both current_password and new_password are required",
        )

    # Verify current password
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password strength
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )

    # Don't allow same password
    if verify_password(new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Password changed successfully",
        "user_id": current_user.id,
        "username": current_user.username,
    }


@router.get("/students/lookup", response_model=List[UserSchema])
async def lookup_students(
    username: Optional[str] = Query(None, description="Search by username"),
    email: Optional[str] = Query(None, description="Search by email"),
    auth_user: AuthUser = Depends(require_admin_or_permission("students:read")),
    db: Session = Depends(get_db)
):
    """
    Lookup students by username or email for API integrations.
    Returns matching student records for external systems to get student IDs.
    """
    if not username and not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either username or email must be provided"
        )
    
    query = db.query(User).filter(User.role == UserRole.STUDENT, User.is_active == True)
    
    if username:
        query = query.filter(User.username.ilike(f"%{username}%"))
    
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    
    students = query.limit(10).all()  # Limit results to prevent abuse
    
    return students


@router.get("/students/{student_id}/info", response_model=UserSchema)
async def get_student_info(
    student_id: int,
    auth_user: AuthUser = Depends(require_admin_or_permission("students:read")),
    db: Session = Depends(get_db)
):
    """
    Get basic student information by ID for API integrations.
    Useful for verifying student exists before point operations.
    """
    student = db.query(User).filter(
        User.id == student_id,
        User.role == UserRole.STUDENT,
        User.is_active == True
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    return student