# Multi-stage Dockerfile for DietIntel FastAPI application

# Base stage with common dependencies
FROM python:3.11-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # For building Python packages
    gcc \
    g++ \
    # For OpenCV and image processing
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    # For Tesseract OCR
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    # For PostgreSQL client
    libpq-dev \
    # Utilities
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Create virtual environment and install Python dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base as development

# Install development dependencies
COPY requirements-dev.txt* ./
RUN if [ -f requirements-dev.txt ]; then pip install --no-cache-dir -r requirements-dev.txt; fi

# Copy application code
COPY . .

# Create non-root user for development
RUN useradd --create-home --shell /bin/bash dietintel \
    && chown -R dietintel:dietintel /app
USER dietintel

# Create directories for OCR debug and uploads
RUN mkdir -p /app/debug_images /app/uploads /app/temp

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command for development (with hot reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM base as production

# Install only production dependencies (already done in base)

# Copy application code
COPY . .

# Create non-root user for production
RUN useradd --create-home --shell /bin/bash --uid 1000 dietintel \
    && chown -R dietintel:dietintel /app \
    && chmod +x /app/scripts/entrypoint.sh 2>/dev/null || true

# Create necessary directories
RUN mkdir -p /app/debug_images /app/uploads /app/temp \
    && chown -R dietintel:dietintel /app/debug_images /app/uploads /app/temp

USER dietintel

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command (no reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# Testing stage
FROM development as testing

USER root
RUN pip install --no-cache-dir pytest pytest-asyncio pytest-cov httpx

USER dietintel
CMD ["python", "-m", "pytest", "tests/", "-v", "--cov=app", "--cov-report=html"]