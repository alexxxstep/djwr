"""
Pytest configuration and shared fixtures for DjangoWeatherReminder tests.
"""
import pytest
from django.conf import settings
from django.test import RequestFactory

# Configure Django settings for tests
pytest_plugins = ["pytest_django"]


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """
    Configure test database settings.
    This fixture runs once per test session.
    """
    # Test database configuration is handled by pytest-django
    # Additional setup can be added here if needed
    pass


@pytest.fixture
def db_access_allowed():
    """
    Allow database access in tests.
    This is required for tests that need database access.
    """
    return True


@pytest.fixture
def request_factory():
    """
    Provide a RequestFactory instance for testing views.
    """
    return RequestFactory()


@pytest.fixture
def api_client():
    """
    Provide a DRF API client for testing API endpoints.
    """
    from rest_framework.test import APIClient

    return APIClient()


# Factory Boy fixtures will be added in Phase 2 when models are created
# Example structure:
# @pytest.fixture
# def user(db):
#     from app.models import User
#     from tests.factories import UserFactory
#     return UserFactory()

