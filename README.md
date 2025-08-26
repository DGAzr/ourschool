# OurSchool - Homeschool Management System

A comprehensive web application for managing homeschool programs, supporting multiple students with attendance tracking, lesson planning, assignments, and grading. Designed to help ease the administrative burden of your homeschool program and improve the accuracy of mandatory reporting. 

# Current Status
Just in time for the Fall Semester I'm releasing this as an alpha for those who want to test and use it. I find that it already works great for the needs of our program. We use it daily to record and review our progress, but I am sure there will need to be changes as we proceed through the year. I will do my best to keep the database schema as stable as possible, but I can't guarantee there won't be breaking changes yet. (Use the built in system export to take regular backups!)

Once I've completed our first academic term I plan to release a more stable beta in January 2026. Then by summer 2026 I will feel confident enough for a stable release in time for the 2026-2027 school year.

## Features

- **Multi-user Authentication**: Separate logins for parents (administrators) and students
- **Attendance Tracking**: Record daily attendance with notes and status. Flexibile academic terms to support reporting needs of your jurisdiction.
- **Lesson Planning**: Organize lessons by subject with scheduling and materials
- **Assignment Management**: Create, track, and grade various types of assignments
- **Optional Gamification**: As assignments are graded, student points accumulate to be used as an incentive system (Points system can be disabled in Admin Center)
- **Import/Export System**: Assignments and Lesson Plans can be exported to simple JSON files for import by other OurSchool installations. Help your fellow homeschool families by sharing.
- **Integration API**: API can be accessed by external systems for Integration and Automation


## Quick Start

```
git clone git@github.com:DGAzr/ourschool.git
cd ourschool
cp env.EXAMPLE .env
(!!!EDIT YOUR .env FILE TO SUIT YOUR ENVIRONMENT!!!)
bash docker-deploy.sh
```
Point your browser at localhost:4173

### Screenshots
![A screenshot of the default OurSchool Admin Dashboard](/utils/OS_Login.png?raw=true "OurSchool Admin Dashboard")


## Buy me a coffee
I really, really like coffee :) 

[![BuyMeACoffee](https://raw.githubusercontent.com/pachadotdev/buymeacoffee-badges/main/bmc-yellow.svg)](https://buymeacoffee.com/cyzfcykbd)

## Not-so-quick-start

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL

### Backend Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and secret key
```

4. **Database Initialization (First Time Setup)**:

   a. Create the PostgreSQL database:
   ```bash
   # Connect to PostgreSQL as superuser
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE ourschool;
   CREATE USER postgres WITH PASSWORD 'your-secure-password-here';
   GRANT ALL PRIVILEGES ON DATABASE ourschool TO postgres;
   \q
   ```

   b. Update your `.env` file with the correct database credentials:
   ```bash
   POSTGRES_DB=ourschool
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your-secure-password-here
   DATABASE_URL=postgresql+psycopg://postgres:your-secure-password-here@localhost:5432/ourschool
   ```

5. Run database migrations:
```bash
alembic upgrade head
```

6. **Seed the database with initial admin**:
```bash
python seed_data.py
```
This creates:
- Admin user: `admin` / `admin123`

7. Start the API server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Database Schema

The application includes the following main entities:

- **Users**: Parent and student accounts with role-based access
- **Students**: Student profiles linked to parent accounts
- **Attendance Records**: Daily attendance tracking with status and notes
- **Subjects**: Course subjects with customizable colors
- **Lessons**: Scheduled lessons with materials and objectives
- **Assignments**: Various assignment types with due dates and status tracking
- **Grades**: Assessment results with points and feedback

## API Integration

OurSchool provides a comprehensive REST API for external integrations, supporting both user session authentication (Bearer tokens) and API key authentication for automated systems.

### API Key Setup

1. **Create API Key**: Navigate to Admin → API Keys in the web interface
2. **Set Permissions**: Assign required permissions (e.g., `points:read`, `assignments:grade`)
3. **Secure Storage**: Store your API key securely - it starts with `os_`

### Authentication Methods

#### User Session (Bearer Token)
```bash
# Login to get token
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"

# Use token in requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/points/admin/overview"
```

#### API Key Authentication
```bash
curl -H "X-API-Key: os_YOUR_API_KEY_HERE" \
  "http://localhost:8000/api/points/admin/overview"
```

### Example API Calls

#### Get Student Points Overview
```bash
curl -X GET "http://localhost:8000/api/points/admin/overview" \
  -H "X-API-Key: os_YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "total_students_with_points": 2,
  "total_students": 2,
  "total_points_awarded": 800,
  "total_points_spent": 0,
  "student_points": [
    {
      "current_balance": 500,
      "total_earned": 500,
      "total_spent": 0,
      "student_id": 4,
      "student_name": "William Ashley"
    },
    {
      "current_balance": 300,
      "total_earned": 300,
      "total_spent": 0,
      "student_id": 5,
      "student_name": "Evelyn Ashley"
    }
  ]
}
```

#### Grade an Assignment
```bash
curl -X POST "http://localhost:8000/api/integrations/assignments/123/grade" \
  -H "X-API-Key: os_YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "points_earned": 85.0,
    "teacher_feedback": "Good work! Minor areas for improvement.",
    "letter_grade": "B+"
  }'
```

#### Get Individual Student Points
```bash
curl -X GET "http://localhost:8000/api/points/student/4/balance" \
  -H "X-API-Key: os_YOUR_API_KEY_HERE"
```

### Python Integration Example

See `list_student_points.py` for a complete Python example:

```python
import requests
import os

BASE_URL = "http://localhost:8000"
API_KEY = os.getenv("OURSCHOOL_API_KEY")

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Get all student points
response = requests.get(f"{BASE_URL}/api/points/admin/overview", headers=headers)
if response.status_code == 200:
    data = response.json()
    for student in data['student_points']:
        print(f"{student['student_name']}: {student['current_balance']} points")
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User authentication (returns JWT)

#### Students & Users  
- `GET /api/users/me` - Current user profile (session auth only)

#### Points System
- `GET /api/points/admin/overview` - All student points overview
- `GET /api/points/student/{id}/balance` - Individual student points
- `GET /api/points/student/{id}/ledger` - Student transaction history
- `POST /api/points/adjust` - Manually adjust student points

#### Assignments (Integration API)
- `GET /api/integrations/assignments/{id}` - Get assignment details
- `POST /api/integrations/assignments/{id}/grade` - Grade assignment

#### Other Endpoints
- `POST /api/attendance/` - Record attendance
- `GET /api/lessons/` - List lessons with filtering
- `POST /api/assignments/` - Create assignments (session auth)

### Required Permissions

| Permission | Description |
|------------|-------------|
| `points:read` | Read student points and transaction history |
| `points:write` | Adjust student points |
| `assignments:read` | Read assignment data |
| `assignments:grade` | Grade student assignments |
| `students:read` | Read student information |
| `attendance:read` | Read attendance records |
| `attendance:write` | Record attendance |

## Development

### Database Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "Description"
```

Apply migrations:
```bash
alembic upgrade head
```

### Running Tests

Backend tests:
```bash
pytest
```

Frontend tests:
```bash
cd frontend && npm test
```

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM with PostgreSQL support
- **Alembic** - Database migrations
- **JWT Authentication** - Secure token-based auth
- **Pydantic** - Data validation and serialization

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Vite** - Fast build tool

## Deployment

The application can be deployed using Docker, traditional hosting, or cloud platforms. Ensure proper environment variables are set for production use.

## License

This project is licensed under the GNU Affero General Public License v3 (GNU AGPLv3).

### License Disclaimer

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
