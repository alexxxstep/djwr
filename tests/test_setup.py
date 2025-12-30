"""
Basic tests to verify test infrastructure is working correctly.
"""


def test_pytest_working():
    """Verify pytest is working."""
    assert True


def test_django_settings_loaded(db):
    """Verify Django settings are loaded correctly."""
    from django.conf import settings

    assert settings.SECRET_KEY is not None
    assert settings.DATABASES["default"]["ENGINE"] is not None


def test_database_access(db):
    """Verify database access is working."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        assert result[0] == 1

