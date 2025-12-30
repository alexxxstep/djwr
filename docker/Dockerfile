# Use Python 3.12 slim image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml ./

# Install Python dependencies using UV
# UV can install from pyproject.toml directly
RUN uv pip install --system .

# Copy project files
COPY . .

# Create directories for static and media files
RUN mkdir -p /app/staticfiles /app/media

# Collect static files (will be run in production)
# RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose.yml)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

