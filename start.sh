#!/bin/bash
set -e

echo "Starting OurSchool Backend..."

# Resolve database connection parameters.
# DATABASE_URL takes precedence; parse host/port/user from it when set.
if [ -n "${DATABASE_URL}" ]; then
    echo "Using DATABASE_URL for connection settings..."
    read DB_HOST DB_PORT DB_USER <<< $(python3 -c "
from urllib.parse import urlparse
u = urlparse('${DATABASE_URL}')
print(u.hostname or 'localhost', u.port or 5432, u.username or 'postgres')
")
else
    DB_USER=${DATABASE_USER:-${POSTGRES_USER:-postgres}}
    DB_HOST=${DATABASE_HOST:-db}
    DB_PORT=${DATABASE_PORT:-5432}
fi

# Wait for database to be ready
echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
while ! pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER}; do
    echo "Waiting for database..."
    sleep 2
done

echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Check if migrations succeeded
if [ $? -eq 0 ]; then
    echo "Database migrations completed successfully!"
else
    echo "Database migrations failed!"
    exit 1
fi

# Create initial data if needed (only if no users exist)
echo "Checking if initial data is needed..."
if python -c "
from app.core.database import get_engine, init_db
from sqlalchemy.orm import sessionmaker
from app.models.user import User
init_db()
engine = get_engine()
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()
user_count = db.query(User).count()
db.close()
exit(0 if user_count > 0 else 1)
"; then
    echo "Users already exist, skipping initial data creation."
else
    echo "No users found, creating initial admin user and test data..."
    python seed_data.py
fi

# Start the application
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000