"""
Celery configuration for DjangoWeatherReminder project.
"""

import os

from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Create Celery app instance
app = Celery("django_weather_reminder")

# Load configuration from Django settings
# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


# Celery configuration
app.conf.update(
    # Broker settings
    broker_url=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1"),
    # Result backend
    result_backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task execution settings
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    # Result settings
    result_expires=3600,  # Results expire after 1 hour
    # Worker settings
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    # Task routing (can be extended later)
    task_routes={},
    # Task default settings
    task_default_queue="default",
    task_default_exchange="default",
    task_default_exchange_type="direct",
    task_default_routing_key="default",
    # Beat schedule (will be configured in Phase 7)
    beat_schedule={},
)
