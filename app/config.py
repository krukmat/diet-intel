import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """
    Configuration settings for DietIntel API.
    
    Environment variables can be set to override defaults:
    - OFF_BASE_URL: Open Food Facts API base URL
    - REDIS_URL: Redis connection URL
    - OFF_TIMEOUT: Request timeout for OFF API calls
    - OFF_RATE_LIMIT_DELAY: Delay between requests to respect rate limits
    - REDIS_CACHE_TTL_HOURS: Cache TTL in hours
    """
    
    # Open Food Facts API configuration
    off_base_url: str = Field(
        default="https://world.openfoodfacts.org",
        description="Open Food Facts API base URL"
    )
    
    off_timeout: float = Field(
        default=10.0,
        description="Timeout for Open Food Facts API requests in seconds"
    )
    
    off_rate_limit_delay: float = Field(
        default=0.1,
        description="Minimum delay between OFF API requests to respect rate limits"
    )
    
    off_max_retries: int = Field(
        default=3,
        description="Maximum number of retries for failed OFF API requests"
    )
    
    off_retry_delay: float = Field(
        default=1.0,
        description="Base delay between retries (with exponential backoff)"
    )
    
    # Redis configuration
    redis_url: str = Field(
        default="redis://localhost:6379",
        description="Redis connection URL"
    )
    
    redis_cache_ttl_hours: int = Field(
        default=24,
        description="Cache TTL in hours for product data"
    )
    
    redis_max_connections: int = Field(
        default=10,
        description="Maximum Redis connection pool size"
    )
    
    # Database configuration
    database_url: str = Field(
        default="postgresql://dietintel_user:dietintel_password@localhost:5432/dietintel",
        description="PostgreSQL database URL"
    )
    
    database_pool_size: int = Field(
        default=5,
        description="Database connection pool size"
    )
    
    database_max_overflow: int = Field(
        default=10,
        description="Maximum database connection overflow"
    )
    
    # Security configuration
    secret_key: str = Field(
        default="your-secret-key-change-in-production",
        description="Secret key for JWT token generation"
    )
    
    access_token_expire_minutes: int = Field(
        default=15,
        description="Access token expiration time in minutes"
    )
    
    # Application configuration
    environment: str = Field(
        default="development",
        description="Application environment (development, production, testing)"
    )
    
    # Logging configuration
    log_level: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR)"
    )
    
    class Config:
        env_prefix = ""  # No prefix, use direct env var names
        case_sensitive = False


# Global configuration instance
config = Config()