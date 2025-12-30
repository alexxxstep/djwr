"""
Django settings for DjangoWeatherReminder project.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Load environment variables from .env file
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    "SECRET_KEY", "django-insecure-dev-key-change-in-production"
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get("DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.github",
    # Local apps
    "app",
]

# Conditionally add debug_toolbar in development
if DEBUG:
    INSTALLED_APPS.append("debug_toolbar")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Conditionally add debug_toolbar middleware
if DEBUG:
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "src" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:55434/weather_reminder",
)

DATABASES = {
    "default": dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,  # Connection pooling: reuse connections for 10 minutes
        conn_health_checks=True,  # Verify connections before using them
    )
}

# Fallback to default PostgreSQL settings if DATABASE_URL parsing fails
if not DATABASES["default"].get("ENGINE"):
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "weather_reminder"),
        "USER": os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "55434"),
        "CONN_MAX_AGE": 600,  # Connection pooling
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }

# Redis Configuration
# https://docs.djangoproject.com/en/5.0/topics/cache/
REDIS_URL = os.environ.get(
    "REDIS_URL",
    "redis://localhost:6379/0",
)

# Redis for caching (database 0)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
            "CONNECTION_POOL_KWARGS": {
                "max_connections": 50,
                "retry_on_timeout": True,
            },
            "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
            "IGNORE_EXCEPTIONS": True,  # Don't break if Redis is down
        },
        "KEY_PREFIX": "weather_reminder",
        "TIMEOUT": 300,  # Default cache timeout: 5 minutes
    }
}

# Redis for Celery broker (database 1)
CELERY_BROKER_URL = os.environ.get(
    "CELERY_BROKER_URL",
    "redis://localhost:6379/1",
)

# Celery result backend (same as broker, database 1)
CELERY_RESULT_BACKEND = os.environ.get(
    "CELERY_RESULT_BACKEND",
    "redis://localhost:6379/1",
)

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

o Additional directories for static files (for frontend build output)
STATICFILES_DIRS = (
    [
        BASE_DIR / "frontend" / "dist",
    ]
    if (BASE_DIR / "frontend" / "dist").exists()
    else []
)

# Static files finders
STATICFILES_FINDERS = [
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
]

# Media files (User uploads)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# JWT Settings (Simple JWT)
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME", 900))
    ),  # 15 minutes
    "REFRESH_TOKEN_LIFETIME": timedelta(
        seconds=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME", 604800))
    ),  # 7 days
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": os.environ.get("JWT_ALGORITHM", "HS256"),
    "SIGNING_KEY": os.environ.get("JWT_SECRET_KEY", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Email Configuration
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", 10))
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "noreply@weatherreminder.local"
)

# OAuth Configuration (django-allauth)
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": [
            "profile",
            "email",
        ],
        "AUTH_PARAMS": {
            "access_type": "online",
        },
        "APP": {
            "client_id": os.environ.get("SOCIAL_AUTH_GOOGLE_OAUTH2_KEY", ""),
            "secret": os.environ.get("SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET", ""),
            "key": "",
        },
    },
    "github": {
        "SCOPE": [
            "user:email",
        ],
        "APP": {
            "client_id": os.environ.get("SOCIAL_AUTH_GITHUB_KEY", ""),
            "secret": os.environ.get("SOCIAL_AUTH_GITHUB_SECRET", ""),
        },
    },
}

# OAuth Settings
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_VERIFICATION = "optional"  # Will be set to "mandatory" in production
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_REQUIRED = True

# Weather API Configuration
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY", "")
WEATHER_API_URL = os.environ.get(
    "WEATHER_API_URL", "https://api.openweathermap.org/data/2.5"
)

# Django Debug Toolbar settings (development only)
if DEBUG:
    INTERNAL_IPS = [
        "127.0.0.1",
    ]
