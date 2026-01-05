# Django configuration package

# Import Celery app to ensure it's loaded when Django starts
# Use try-except to handle cases where Celery might not be available (e.g., during tests)
try:
    from .celery import app as celery_app

    __all__ = ("celery_app",)
except (ImportError, ModuleNotFoundError):
    # Celery not available (e.g., during some test scenarios or if not installed)
    celery_app = None
    __all__ = ()
