"""
Tests for Authentication views and API endpoints.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from tests.factories import UserFactory

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user."""
    return UserFactory(email="test@example.com", password="testpass123")


@pytest.fixture
def authenticated_client(api_client, user):
    """Create an authenticated API client."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


class TestUserRegistration:
    """Tests for user registration endpoint."""

    def test_user_registration_success(self, api_client, db):
        """Test successful user registration."""
        data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "SecurePass123",
            "password2": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert "user" in response.data
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]
        assert response.data["user"]["email"] == "newuser@example.com"
        assert response.data["user"]["is_email_verified"] is False

        # Verify user was created
        user = User.objects.get(email="newuser@example.com")
        assert user.username == "newuser"
        assert user.first_name == "John"
        assert user.last_name == "Doe"

    def test_user_registration_duplicate_email(self, api_client, user, db):
        """Test registration with duplicate email."""
        data = {
            "email": user.email,
            "username": "anotheruser",
            "password": "SecurePass123",
            "password2": "SecurePass123",
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data

    def test_user_registration_weak_password(self, api_client, db):
        """Test registration with weak password."""
        data = {
            "email": "user@example.com",
            "username": "user",
            "password": "weak",
            "password2": "weak",
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_user_registration_password_mismatch(self, api_client, db):
        """Test registration with mismatched passwords."""
        data = {
            "email": "user@example.com",
            "username": "user",
            "password": "SecurePass123",
            "password2": "DifferentPass456",
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password2" in response.data

    def test_user_registration_password_hashing(self, api_client, db):
        """Test that password is properly hashed."""
        password = "SecurePass123"
        data = {
            "email": "user@example.com",
            "username": "user",
            "password": password,
            "password2": password,
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email="user@example.com")
        assert user.password != password  # Password should be hashed
        assert user.check_password(password)  # But should verify correctly


class TestUserLogin:
    """Tests for user login endpoint."""

    def test_user_login_success(self, api_client, user):
        """Test successful user login."""
        data = {
            "email": user.email,
            "password": "testpass123",
        }
        response = api_client.post("/api/auth/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "user" in response.data
        assert "tokens" in response.data
        assert "access" in response.data["tokens"]
        assert "refresh" in response.data["tokens"]
        assert response.data["user"]["email"] == user.email

    def test_user_login_invalid_email(self, api_client, db):
        """Test login with invalid email."""
        data = {
            "email": "nonexistent@example.com",
            "password": "password123",
        }
        response = api_client.post("/api/auth/login/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "error" in response.data

    def test_user_login_invalid_password(self, api_client, user):
        """Test login with invalid password."""
        data = {
            "email": user.email,
            "password": "wrongpassword",
        }
        response = api_client.post("/api/auth/login/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "error" in response.data

    def test_user_login_missing_fields(self, api_client):
        """Test login with missing fields."""
        response = api_client.post("/api/auth/login/", {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data

    def test_user_login_email_normalization(self, api_client, user):
        """Test that email is normalized during login."""
        data = {
            "email": user.email.upper(),  # Uppercase email
            "password": "testpass123",
        }
        response = api_client.post("/api/auth/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["email"] == user.email.lower()


class TestJWTTokenRefresh:
    """Tests for JWT token refresh endpoint."""

    def test_token_refresh_success(self, api_client, user):
        """Test successful token refresh."""
        refresh = RefreshToken.for_user(user)
        data = {"refresh": str(refresh)}
        response = api_client.post("/api/auth/refresh/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_token_refresh_invalid_token(self, api_client):
        """Test refresh with invalid token."""
        data = {"refresh": "invalid_token"}
        response = api_client.post("/api/auth/refresh/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh_missing_token(self, api_client):
        """Test refresh without token."""
        response = api_client.post("/api/auth/refresh/", {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestJWTTokenLogout:
    """Tests for JWT token logout endpoint."""

    def test_token_logout_success(self, api_client, user):
        """Test successful token logout."""
        refresh = RefreshToken.for_user(user)
        data = {"refresh": str(refresh)}
        response = api_client.post("/api/auth/logout/", data, format="json")

        assert response.status_code == status.HTTP_200_OK

        # Verify token is blacklisted
        response2 = api_client.post("/api/auth/refresh/", data, format="json")
        assert response2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_logout_invalid_token(self, api_client):
        """Test logout with invalid token."""
        data = {"refresh": "invalid_token"}
        response = api_client.post("/api/auth/logout/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestUserProfile:
    """Tests for user profile endpoint."""

    def test_get_profile_success(self, authenticated_client, user):
        """Test successful profile retrieval."""
        response = authenticated_client.get("/api/auth/me/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert response.data["id"] == user.id
        assert "is_email_verified" in response.data
        assert "webhook_url" in response.data

    def test_get_profile_unauthorized(self, api_client):
        """Test profile retrieval without authentication."""
        response = api_client.get("/api/auth/me/")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_profile_success(self, authenticated_client, user):
        """Test successful profile update."""
        data = {
            "first_name": "Updated",
            "last_name": "Name",
            "webhook_url": "https://example.com/webhook",
        }
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["first_name"] == "Updated"
        assert response.data["last_name"] == "Name"
        assert response.data["webhook_url"] == "https://example.com/webhook"

        # Verify database update
        user.refresh_from_db()
        assert user.first_name == "Updated"
        assert user.last_name == "Name"
        assert user.webhook_url == "https://example.com/webhook"

    def test_update_profile_invalid_webhook_url(self, authenticated_client):
        """Test profile update with invalid webhook URL."""
        data = {"webhook_url": "not-a-valid-url"}
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "webhook_url" in response.data

    def test_update_profile_readonly_fields(self, authenticated_client, user):
        """Test that readonly fields cannot be updated."""
        original_email = user.email
        data = {"email": "newemail@example.com"}
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        # Email should remain unchanged
        user.refresh_from_db()
        assert user.email == original_email

    def test_update_profile_unauthorized(self, api_client):
        """Test profile update without authentication."""
        data = {"first_name": "Updated"}
        response = api_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestEmailUniqueness:
    """Tests for email uniqueness validation."""

    def test_email_uniqueness_enforcement(self, api_client, user, db):
        """Test that email uniqueness is enforced."""
        data = {
            "email": user.email,  # Same email as existing user
            "username": "differentuser",
            "password": "SecurePass123",
            "password2": "SecurePass123",
        }
        response = api_client.post("/api/auth/register/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data


class TestWebhookURLValidation:
    """Tests for webhook URL validation."""

    def test_webhook_url_valid(self, authenticated_client):
        """Test valid webhook URL."""
        data = {"webhook_url": "https://example.com/webhook"}
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_webhook_url_invalid(self, authenticated_client):
        """Test invalid webhook URL."""
        data = {"webhook_url": "invalid-url"}
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_webhook_url_empty(self, authenticated_client):
        """Test empty webhook URL (should be allowed)."""
        data = {"webhook_url": ""}
        response = authenticated_client.patch("/api/auth/me/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
