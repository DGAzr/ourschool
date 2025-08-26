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

"""Application configuration."""
from typing import Optional
from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Database configuration
    database_host: str = Field(default="localhost", env="DATABASE_HOST")
    database_port: int = Field(default=5432, env="DATABASE_PORT")
    database_name: str = Field(default="ourschool", env="DATABASE_NAME")
    database_user: str = Field(default="ourschool", env="DATABASE_USER")
    database_password: str = Field(default="ourschool", env="DATABASE_PASSWORD")
    
    # Legacy support - if DATABASE_URL is provided, it takes precedence
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")

    # Authentication configuration
    secret_key: str = Field(..., env="SECRET_KEY")
    algorithm: str = Field(default="HS256", env="ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # Backend server configuration
    backend_host: str = Field(default="0.0.0.0", env="BACKEND_HOST")
    backend_port: int = Field(default=8000, env="BACKEND_PORT")

    # Frontend server configuration (for development/reference)
    frontend_host: str = Field(default="0.0.0.0", env="FRONTEND_HOST")
    frontend_port: int = Field(default=5173, env="FRONTEND_PORT")

    # Logging configuration
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")  # json or text
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")

    # CORS configuration
    allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        env="ALLOWED_ORIGINS"
    )

    @computed_field
    @property
    def effective_database_url(self) -> str:
        """Get the effective database URL, building from components if needed."""
        if self.database_url:
            return self.database_url
        
        # URL-encode the password and database name to handle special characters
        from urllib.parse import quote_plus
        
        encoded_password = quote_plus(self.database_password)
        encoded_db_name = quote_plus(self.database_name)
        
        return (
            f"postgresql+psycopg://{self.database_user}:{encoded_password}"
            f"@{self.database_host}:{self.database_port}/{encoded_db_name}"
        )

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f'log_level must be one of {valid_levels}, got {v}')
        return v_upper

    @field_validator('log_format')
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        """Validate log format."""
        valid_formats = {'json', 'text'}
        v_lower = v.lower()
        if v_lower not in valid_formats:
            raise ValueError(f'log_format must be one of {valid_formats}, got {v}')
        return v_lower

    class Config:
        """Pydantic configuration."""

        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields in .env file


settings = Settings()