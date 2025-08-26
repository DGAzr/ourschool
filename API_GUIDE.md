# API Development Guide

This guide outlines standards and best practices for developing backend APIs in the OurSchool project using FastAPI.

## 🏗️ API Architecture

### Project Structure

```
app/
├── routers/              # API route handlers (organized by domain)
│   ├── auth.py          # Authentication endpoints
│   ├── users.py         # User management
│   ├── assignments/     # Assignment-related endpoints
│   │   ├── __init__.py
│   │   ├── templates.py
│   │   ├── student_assignments.py
│   │   └── shared/
│   ├── lessons/         # Lesson management
│   └── reports/         # Reporting endpoints
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic request/response schemas
├── services/            # Business logic layer
├── crud/               # Database operations
├── core/               # Configuration and dependencies
└── utils/              # Utility functions
```

### Layered Architecture

```
┌─────────────────┐
│   API Routes   │ ← FastAPI routers (routers/)
├─────────────────┤
│ Business Logic │ ← Services layer (services/)
├─────────────────┤
│   Data Access  │ ← CRUD operations (crud/)
├─────────────────┤
│   Database     │ ← SQLAlchemy models (models/)
└─────────────────┘
```

## 🛣️ Router Organization

### Domain-Based Routing

```python
# app/routers/assignments/__init__.py
from fastapi import APIRouter
from .templates import router as templates_router
from .student_assignments import router as student_assignments_router

router = APIRouter(prefix="/assignments", tags=["assignments"])
router.include_router(templates_router, prefix="/templates")
router.include_router(student_assignments_router, prefix="/student")
```

### Route Naming Conventions

```python
# ✅ Good: RESTful route patterns
@router.get("/")                           # GET /api/assignments/
@router.post("/")                          # POST /api/assignments/
@router.get("/{assignment_id}")            # GET /api/assignments/123
@router.put("/{assignment_id}")            # PUT /api/assignments/123
@router.delete("/{assignment_id}")         # DELETE /api/assignments/123

# ✅ Good: Action-based routes for non-CRUD operations
@router.post("/{assignment_id}/assign")    # POST /api/assignments/123/assign
@router.post("/{assignment_id}/submit")    # POST /api/assignments/123/submit
@router.get("/{assignment_id}/statistics") # GET /api/assignments/123/statistics
```

## 📝 Endpoint Standards

### Complete Endpoint Template

```python
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_active_user
from app.schemas.assignment import AssignmentResponse, AssignmentCreate
from app.services.assignment_service import AssignmentService

router = APIRouter()

@router.post("/", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    assignment_data: AssignmentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AssignmentResponse:
    """
    Create a new assignment template.
    
    Creates a new assignment template that can be assigned to students.
    Only administrators and teachers can create assignment templates.
    
    Args:
        assignment_data: Assignment template data
        db: Database session
        current_user: Currently authenticated user
        
    Returns:
        Created assignment template
        
    Raises:
        HTTPException: 403 if user lacks permission
        HTTPException: 400 if validation fails
        HTTPException: 409 if duplicate name exists
    """
    # Permission check
    if not current_user.can_create_assignments():
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to create assignments"
        )
    
    try:
        # Business logic delegation
        assignment = await AssignmentService.create(
            db=db,
            assignment_data=assignment_data,
            created_by=current_user.id
        )
        return assignment
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DuplicateNameError:
        raise HTTPException(
            status_code=409,
            detail="Assignment template with this name already exists"
        )
```

### Query Parameters and Pagination

```python
@router.get("/", response_model=List[AssignmentResponse])
async def list_assignments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    # Pagination
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    # Filtering
    subject_id: Annotated[int | None, Query()] = None,
    difficulty: Annotated[str | None, Query(regex="^(beginner|intermediate|advanced)$")] = None,
    # Sorting
    order_by: Annotated[str, Query(regex="^(name|created_at|difficulty)$")] = "created_at",
    order_direction: Annotated[str, Query(regex="^(asc|desc)$")] = "desc",
) -> List[AssignmentResponse]:
    """
    List assignment templates with filtering and pagination.
    
    Returns a paginated list of assignment templates that the current user
    has permission to view, with optional filtering by subject and difficulty.
    
    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return (1-100)
        subject_id: Filter by subject ID
        difficulty: Filter by difficulty level
        order_by: Field to sort by
        order_direction: Sort direction (asc/desc)
    """
    filters = {
        "subject_id": subject_id,
        "difficulty": difficulty
    }
    
    assignments = await AssignmentService.list_filtered(
        db=db,
        user=current_user,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by=order_by,
        order_direction=order_direction
    )
    
    return assignments
```

## 📋 Schema Design

### Request/Response Schema Patterns

```python
# schemas/assignment.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

class AssignmentBase(BaseModel):
    """Base schema with common assignment fields."""
    name: str = Field(..., min_length=1, max_length=200, description="Assignment name")
    description: Optional[str] = Field(None, max_length=2000, description="Assignment description")
    subject_id: int = Field(..., gt=0, description="Subject ID")
    max_points: int = Field(..., ge=1, le=1000, description="Maximum points possible")
    difficulty_level: str = Field(..., regex="^(beginner|intermediate|advanced)$")
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty or whitespace only')
        return v.strip()

class AssignmentCreate(AssignmentBase):
    """Schema for creating assignments."""
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    instructions: Optional[str] = Field(None, max_length=5000)

class AssignmentUpdate(BaseModel):
    """Schema for updating assignments (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    max_points: Optional[int] = Field(None, ge=1, le=1000)
    # ... other optional fields

class AssignmentResponse(AssignmentBase):
    """Schema for assignment responses."""
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    
    # Related data
    subject_name: Optional[str] = None
    creator_name: Optional[str] = None
    
    class Config:
        from_attributes = True  # For SQLAlchemy model conversion

class AssignmentListResponse(BaseModel):
    """Paginated list response."""
    items: List[AssignmentResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_previous: bool
```

## 🔐 Authentication & Authorization

### Dependency Injection Pattern

```python
# routers/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the currently authenticated user from JWT token."""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    user = await UserService.get_by_username(db, username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

def require_role(required_role: UserRole):
    """Dependency factory for role-based access control."""
    def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires {required_role.value} role"
            )
        return current_user
    return role_checker

# Usage in routes
@router.get("/admin-only")
async def admin_endpoint(
    admin_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Endpoint that requires admin role."""
    pass
```

## 🛠️ Business Logic Layer

### Service Pattern

```python
# services/assignment_service.py
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.assignment import AssignmentTemplate
from app.models.user import User
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.crud.assignment_crud import AssignmentCRUD

class AssignmentService:
    """Business logic for assignment operations."""
    
    @staticmethod
    async def create(
        db: Session,
        assignment_data: AssignmentCreate,
        created_by: int
    ) -> AssignmentTemplate:
        """
        Create a new assignment template with business rules validation.
        
        Args:
            db: Database session
            assignment_data: Assignment creation data
            created_by: ID of user creating the assignment
            
        Returns:
            Created assignment template
            
        Raises:
            ValueError: If business rules validation fails
            DuplicateNameError: If assignment name already exists
        """
        # Business rule: Check for duplicate names
        existing = await AssignmentCRUD.get_by_name(db, assignment_data.name)
        if existing:
            raise DuplicateNameError(f"Assignment '{assignment_data.name}' already exists")
        
        # Business rule: Validate subject exists and user has access
        subject = await SubjectCRUD.get(db, assignment_data.subject_id)
        if not subject:
            raise ValueError("Invalid subject ID")
        
        # Create assignment
        assignment_dict = assignment_data.dict()
        assignment_dict['created_by'] = created_by
        
        assignment = await AssignmentCRUD.create(db, assignment_dict)
        
        # Business logic: Auto-assign to existing students if configured
        if assignment_data.auto_assign:
            await cls._auto_assign_to_students(db, assignment)
        
        return assignment
    
    @staticmethod
    async def list_filtered(
        db: Session,
        user: User,
        skip: int = 0,
        limit: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        order_by: str = "created_at",
        order_direction: str = "desc"
    ) -> List[AssignmentTemplate]:
        """
        List assignments with filtering and user-based access control.
        """
        # Build query with user permissions
        query_filters = []
        
        # User can only see assignments they created or public ones
        if user.role != UserRole.ADMIN:
            query_filters.append(
                or_(
                    AssignmentTemplate.created_by == user.id,
                    AssignmentTemplate.is_public == True
                )
            )
        
        # Apply additional filters
        if filters:
            if filters.get('subject_id'):
                query_filters.append(AssignmentTemplate.subject_id == filters['subject_id'])
            
            if filters.get('difficulty'):
                query_filters.append(AssignmentTemplate.difficulty_level == filters['difficulty'])
        
        return await AssignmentCRUD.list_filtered(
            db=db,
            filters=query_filters,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_direction=order_direction
        )
    
    @staticmethod
    async def _auto_assign_to_students(
        db: Session,
        assignment: AssignmentTemplate
    ) -> None:
        """Private method to handle auto-assignment logic."""
        # Implementation for auto-assignment business logic
        pass
```

## 🗄️ Database Operations

### CRUD Pattern

```python
# crud/assignment_crud.py
from typing import List, Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc

from app.models.assignment import AssignmentTemplate
from .base import CRUDBase

class AssignmentCRUD(CRUDBase[AssignmentTemplate, Dict[str, Any], Dict[str, Any]]):
    """CRUD operations for AssignmentTemplate model."""
    
    async def get_by_name(self, db: Session, name: str) -> Optional[AssignmentTemplate]:
        """Get assignment template by name."""
        return db.query(AssignmentTemplate)\
            .filter(AssignmentTemplate.name == name)\
            .first()
    
    async def get_by_subject(
        self,
        db: Session,
        subject_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[AssignmentTemplate]:
        """Get assignment templates by subject with pagination."""
        return db.query(AssignmentTemplate)\
            .filter(AssignmentTemplate.subject_id == subject_id)\
            .offset(skip)\
            .limit(limit)\
            .all()
    
    async def list_filtered(
        self,
        db: Session,
        filters: List[Any],
        skip: int = 0,
        limit: int = 20,
        order_by: str = "created_at",
        order_direction: str = "desc"
    ) -> List[AssignmentTemplate]:
        """List assignments with complex filtering and sorting."""
        query = db.query(AssignmentTemplate)
        
        # Apply filters
        if filters:
            query = query.filter(and_(*filters))
        
        # Apply sorting
        order_column = getattr(AssignmentTemplate, order_by, AssignmentTemplate.created_at)
        if order_direction.lower() == "desc":
            query = query.order_by(desc(order_column))
        else:
            query = query.order_by(asc(order_column))
        
        return query.offset(skip).limit(limit).all()

# Initialize CRUD instance
assignment_crud = AssignmentCRUD(AssignmentTemplate)
```

## ⚠️ Error Handling

### Standardized Error Responses

```python
# utils/exceptions.py
from fastapi import HTTPException, status

class BusinessLogicError(Exception):
    """Base exception for business logic errors."""
    pass

class DuplicateNameError(BusinessLogicError):
    """Raised when attempting to create duplicate names."""
    pass

class PermissionDeniedError(BusinessLogicError):
    """Raised when user lacks required permissions."""
    pass

class ValidationError(BusinessLogicError):
    """Raised when business rule validation fails."""
    pass

# Exception handlers
from fastapi import Request
from fastapi.responses import JSONResponse

async def business_logic_exception_handler(
    request: Request,
    exc: BusinessLogicError
) -> JSONResponse:
    """Handle business logic exceptions."""
    status_map = {
        DuplicateNameError: status.HTTP_409_CONFLICT,
        PermissionDeniedError: status.HTTP_403_FORBIDDEN,
        ValidationError: status.HTTP_400_BAD_REQUEST,
    }
    
    status_code = status_map.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)}
    )
```

### Route Error Handling

```python
@router.post("/", response_model=AssignmentResponse)
async def create_assignment(
    assignment_data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create assignment with comprehensive error handling."""
    try:
        assignment = await AssignmentService.create(
            db=db,
            assignment_data=assignment_data,
            created_by=current_user.id
        )
        return assignment
        
    except DuplicateNameError:
        raise HTTPException(
            status_code=409,
            detail="Assignment template with this name already exists"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except PermissionDeniedError:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to create assignment"
        )
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error creating assignment: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

## 📝 Testing APIs

### Test Structure

```python
# tests/test_assignments.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.models.assignment import AssignmentTemplate
from tests.utils import create_test_user, create_test_assignment

client = TestClient(app)

class TestAssignmentAPI:
    """Test suite for assignment API endpoints."""
    
    def test_create_assignment_success(self, db: Session, admin_user: User):
        """Test successful assignment creation."""
        assignment_data = {
            "name": "Test Assignment",
            "description": "Test description",
            "subject_id": 1,
            "max_points": 100,
            "difficulty_level": "intermediate"
        }
        
        response = client.post(
            "/api/assignments/",
            json=assignment_data,
            headers={"Authorization": f"Bearer {admin_user.token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == assignment_data["name"]
        assert data["max_points"] == assignment_data["max_points"]
        
        # Verify database state
        assignment = db.query(AssignmentTemplate)\
            .filter(AssignmentTemplate.name == assignment_data["name"])\
            .first()
        assert assignment is not None
        assert assignment.created_by == admin_user.id
    
    def test_create_assignment_duplicate_name(self, db: Session, admin_user: User):
        """Test creating assignment with duplicate name fails."""
        # Create existing assignment
        existing = create_test_assignment(db, name="Duplicate Name")
        
        assignment_data = {
            "name": "Duplicate Name",
            "subject_id": 1,
            "max_points": 100,
            "difficulty_level": "beginner"
        }
        
        response = client.post(
            "/api/assignments/",
            json=assignment_data,
            headers={"Authorization": f"Bearer {admin_user.token}"}
        )
        
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    def test_create_assignment_permission_denied(self, db: Session, student_user: User):
        """Test that students cannot create assignments."""
        assignment_data = {
            "name": "Student Assignment",
            "subject_id": 1,
            "max_points": 100,
            "difficulty_level": "beginner"
        }
        
        response = client.post(
            "/api/assignments/",
            json=assignment_data,
            headers={"Authorization": f"Bearer {student_user.token}"}
        )
        
        assert response.status_code == 403
    
    @pytest.mark.parametrize("invalid_data,expected_field", [
        ({"name": ""}, "name"),
        ({"max_points": 0}, "max_points"),
        ({"difficulty_level": "invalid"}, "difficulty_level"),
    ])
    def test_create_assignment_validation_errors(
        self,
        db: Session,
        admin_user: User,
        invalid_data: dict,
        expected_field: str
    ):
        """Test validation errors for various invalid inputs."""
        base_data = {
            "name": "Valid Assignment",
            "subject_id": 1,
            "max_points": 100,
            "difficulty_level": "intermediate"
        }
        
        # Override with invalid data
        assignment_data = {**base_data, **invalid_data}
        
        response = client.post(
            "/api/assignments/",
            json=assignment_data,
            headers={"Authorization": f"Bearer {admin_user.token}"}
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any(error["loc"][-1] == expected_field for error in errors)
```

## 📊 API Documentation

### OpenAPI/Swagger Enhancement

```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="OurSchool API",
    description="Educational management system API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

def custom_openapi():
    """Customize OpenAPI schema."""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="OurSchool API",
        version="1.0.0",
        description="RESTful API for educational management",
        routes=app.routes,
    )
    
    # Add custom schema info
    openapi_schema["info"]["contact"] = {
        "name": "OurSchool Development Team",
        "email": "dev@ourschool.com"
    }
    
    # Add authentication scheme
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```

## 🚀 Performance Optimization

### Database Query Optimization

```python
# ✅ Good: Use eager loading for related data
@router.get("/{assignment_id}/details")
async def get_assignment_details(assignment_id: int, db: Session = Depends(get_db)):
    """Get assignment with related data in single query."""
    assignment = db.query(AssignmentTemplate)\
        .options(
            joinedload(AssignmentTemplate.subject),
            joinedload(AssignmentTemplate.creator),
            joinedload(AssignmentTemplate.student_assignments)
        )\
        .filter(AssignmentTemplate.id == assignment_id)\
        .first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return assignment

# ✅ Good: Use database-level filtering and pagination
@router.get("/")
async def list_assignments(
    skip: int = 0,
    limit: int = 20,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Efficient pagination and filtering."""
    query = db.query(AssignmentTemplate)
    
    if subject_id:
        query = query.filter(AssignmentTemplate.subject_id == subject_id)
    
    # Count total for pagination info
    total = query.count()
    
    # Get paginated results
    assignments = query.offset(skip).limit(limit).all()
    
    return {
        "items": assignments,
        "total": total,
        "page": skip // limit + 1,
        "per_page": limit
    }
```

---

Following these API development guidelines ensures consistent, maintainable, and scalable backend services for the OurSchool application.