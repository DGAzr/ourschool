# OurSchool Configuration Guide

This document explains how to configure OurSchool using environment variables and the `.env` file.

## Overview

OurSchool uses environment variables for configuration with fallback to a `.env` file. This approach provides:
- Secure configuration management 
- Easy deployment across different environments
- Docker and cloud deployment compatibility
- Development/production separation

## Configuration Methods

### 1. Environment Variables (Recommended for Production)
Set environment variables directly in your system or container:
```bash
export DATABASE_HOST=localhost
export DATABASE_PASSWORD=mysecurepassword
export SECRET_KEY=your-production-secret-key
```

### 2. .env File (Recommended for Development)
Copy `.env.example` to `.env` and customize:
```bash
cp .env.example .env
# Edit .env with your values
```

Environment variables take precedence over `.env` file values.

## Configuration Options

### Database Configuration

You can configure the database using either individual settings or a complete URL:

#### Individual Settings
```env
DATABASE_HOST=localhost          # Database server hostname
DATABASE_PORT=5432              # Database port (default: 5432)
DATABASE_NAME=ourschool         # Database name
DATABASE_USER=postgres          # Database username
DATABASE_PASSWORD=yourpassword  # Database password
```

#### Complete URL (takes precedence)
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

**Examples:**
- Local development: `postgresql://postgres:password@localhost:5432/ourschool`
- Docker: `postgresql://postgres:password@db:5432/ourschool`
- Cloud: `postgresql://user:pass@your-cloud-db.com:5432/ourschool`

### Security Configuration

```env
SECRET_KEY=your-secret-key-here         # JWT signing key (REQUIRED)
ALGORITHM=HS256                         # JWT algorithm (default: HS256)
ACCESS_TOKEN_EXPIRE_MINUTES=30         # Token expiration (default: 30)
```

**Important:** The `SECRET_KEY` must be set and should be a long, random string for production.

### Server Configuration

#### Backend Server
```env
BACKEND_HOST=0.0.0.0               # Backend bind address (default: 0.0.0.0)
BACKEND_PORT=8000                  # Backend port (default: 8000)
```

#### Frontend Server (Development Reference)
```env
FRONTEND_HOST=0.0.0.0              # Frontend bind address (default: 0.0.0.0)
FRONTEND_PORT=5173                 # Frontend port (default: 5173)
```

### Logging Configuration

```env
LOG_LEVEL=INFO                     # Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT=json                    # Log format: json or text
LOG_FILE=/path/to/logfile.log      # Optional: Log to file (with rotation)
```

**Log Levels:**
- `DEBUG`: Detailed information for debugging
- `INFO`: General application information
- `WARNING`: Warning messages
- `ERROR`: Error messages
- `CRITICAL`: Critical errors only

**Log Formats:**
- `json`: Structured JSON logs (recommended for production)
- `text`: Human-readable text logs (good for development)

### CORS Configuration

```env
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com
```

Comma-separated list of allowed origins for CORS. Include all domains that will access your API.

## Environment-Specific Examples

### Development Environment
```env
# Development settings
DATABASE_HOST=localhost
DATABASE_NAME=ourschool_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=devpassword

SECRET_KEY=dev-secret-key-not-for-production

BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_PORT=5173

LOG_LEVEL=DEBUG
LOG_FORMAT=text

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Production Environment
```env
# Production settings
DATABASE_URL=postgresql://user:secure_password@prod-db.example.com:5432/ourschool

SECRET_KEY=your-extremely-secure-production-secret-key

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=/var/log/ourschool/app.log

ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

### Docker Environment
```env
# Docker settings
DATABASE_HOST=db                   # Docker service name
DATABASE_NAME=ourschool
DATABASE_USER=postgres
DATABASE_PASSWORD=docker_password

SECRET_KEY=docker-secret-key

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

LOG_LEVEL=INFO
LOG_FORMAT=json

ALLOWED_ORIGINS=http://frontend:4173,https://yourapp.com
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique `SECRET_KEY`** values for each environment
3. **Use secure database passwords** with special characters
4. **Restrict `ALLOWED_ORIGINS`** to only necessary domains
5. **Use `LOG_FILE`** in production to avoid logging sensitive data to stdout
6. **Set appropriate `LOG_LEVEL`** (INFO or WARNING in production)

## Deployment Considerations

### Docker
When using Docker, you can:
- Mount a `.env` file: `-v /path/to/.env:/app/.env`
- Pass environment variables: `-e DATABASE_HOST=db -e SECRET_KEY=...`
- Use Docker Compose with `env_file` directive

### Cloud Platforms
Most cloud platforms support environment variables:
- **Heroku**: Use config vars
- **AWS**: Use Parameter Store or environment variables
- **Google Cloud**: Use Secret Manager or environment variables
- **Azure**: Use App Settings or Key Vault

### Kubernetes
Create ConfigMaps and Secrets:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ourschool-secrets
data:
  SECRET_KEY: <base64-encoded-secret>
  DATABASE_PASSWORD: <base64-encoded-password>
```

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check `DATABASE_HOST` and `DATABASE_PORT`
   - Verify database credentials
   - Ensure database server is running

2. **CORS errors in browser**
   - Add your frontend URL to `ALLOWED_ORIGINS`
   - Check protocol (http vs https)

3. **Logs not appearing**
   - Check `LOG_LEVEL` setting
   - Verify `LOG_FILE` path permissions
   - Check `LOG_FORMAT` setting

4. **Token/authentication issues**
   - Verify `SECRET_KEY` is set consistently
   - Check `ACCESS_TOKEN_EXPIRE_MINUTES`

### Validation

You can validate your configuration by checking the application logs at startup. The system will log the active configuration (with sensitive values masked).

## Migration from Legacy Configuration

If you're upgrading from a previous version that only used `DATABASE_URL`, you can:

1. **Keep using `DATABASE_URL`** - it still works and takes precedence
2. **Migrate to individual settings** for more flexibility:
   ```env
   # Old way
   DATABASE_URL=postgresql://user:pass@host:5432/db
   
   # New way (both work)
   DATABASE_HOST=host
   DATABASE_USER=user
   DATABASE_PASSWORD=pass
   DATABASE_NAME=db
   ```