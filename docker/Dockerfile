# Use Python 3.12 slim image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set work directory
WORKDIR /app

# Install system dependencies (including Node.js for frontend build)
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager
RUN pip install --no-cache-dir uv

# Copy dependency files first
COPY pyproject.toml ./

# Install Python dependencies from pyproject.toml
# Note: UV doesn't automatically read dependencies from pyproject.toml when installing a package
# So we install dependencies explicitly, but keep them in sync with pyproject.toml
# This ensures Docker builds work while maintaining pyproject.toml as the source of truth
RUN uv pip install --system \
    "django>=5.0.0,<6.0.0" \
    "djangorestframework>=3.15.0" \
    "djangorestframework-simplejwt>=5.3.0" \
    "drf-spectacular>=0.27.0" \
    "social-auth-app-django>=5.4.0" \
    "celery>=5.3.0" \
    "celery[redis]>=5.3.0" \
    "redis>=5.0.0" \
    "django-redis>=5.4.0" \
    "psycopg2-binary>=2.9.9" \
    "dj-database-url>=2.1.0" \
    "python-dotenv>=1.0.0" \
    "django-debug-toolbar>=4.3.0" \
    "requests>=2.31.0" \
    "cryptography>=41.0.0" \
    "pytest>=8.0.0" \
    "pytest-django>=4.8.0" \
    "pytest-cov>=4.1.0" \
    "factory-boy>=3.3.0" \
    "faker>=22.0.0" \
    "freezegun>=1.2.0"

# Copy source code (needed for package installation)
COPY src/ ./src/
COPY manage.py ./
COPY README.md ./

# Install the package itself in editable mode (dependencies already installed above)
RUN uv pip install --system --no-deps -e .

# Copy frontend files for build
COPY package.json package-lock.json* ./
COPY webpack.config.js ./
COPY frontend/ ./frontend/

# Install Node.js dependencies and build frontend
# Note: We need devDependencies (webpack, babel, etc.) for the build
RUN if [ -f "package.json" ]; then \
        npm ci --no-audit --no-fund || npm install --no-audit --no-fund; \
        npm run build; \
    fi

# Copy remaining project files
COPY . .

# Create directories for static and media files
RUN mkdir -p /app/staticfiles /app/media

# Collect static files (will be run in production)
# RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8080

# Default command (can be overridden in docker-compose.yml)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]

