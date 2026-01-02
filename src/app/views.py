"""
Django REST Framework views for DjangoWeatherReminder application.
"""

import json
from datetime import datetime

from django.conf import settings
from django.views.generic import TemplateView
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView
from social_django.models import UserSocialAuth

from .models import User
from .serializers import UserRegistrationSerializer, UserSerializer


class WeatherView(TemplateView):
    """Main weather page view."""

    template_name = "weather.html"


@extend_schema(
    tags=["Authentication"],
    summary="User Registration",
    description=(
        "Create a new user account and receive JWT tokens for authentication."
    ),
    request=UserRegistrationSerializer,
    responses={
        201: OpenApiExample(
            "Success Response",
            value={
                "user": {
                    "id": 1,
                    "email": "user@example.com",
                    "username": "user",
                    "first_name": "John",
                    "last_name": "Doe",
                    "is_email_verified": False,
                    "webhook_url": None,
                    "date_joined": "2024-01-01T00:00:00Z",
                },
                "tokens": {
                    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                },
            },
        ),
        400: OpenApiExample(
            "Validation Error",
            value={
                "email": ["A user with this email already exists."],
                "password": ["Password must be at least 8 characters long."],
            },
        ),
    },
    examples=[
        OpenApiExample(
            "Registration Request",
            value={
                "email": "user@example.com",
                "username": "user",
                "password": "SecurePass123",
                "password2": "SecurePass123",
                "first_name": "John",
                "last_name": "Doe",
            },
        ),
    ],
)
class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.

    POST /api/auth/register/
    Creates a new user account and returns JWT tokens.
    """

    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        """Create user and return JWT tokens."""
        # #region agent log
        log_path = str(settings.BASE_DIR / ".cursor" / "debug.log")
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "views.py:81",
                            "message": "RegisterView.create entry",
                            "data": {
                                "email": request.data.get("email", ""),
                                "has_password": bool(request.data.get("password")),
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "views.py:84",
                            "message": "RegisterView serializer validated",
                            "data": {"validated": True},
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        user = serializer.save()
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "views.py:86",
                            "message": "RegisterView user created",
                            "data": {
                                "user_id": user.id,
                                "email": user.email,
                                "password_hashed": (
                                    user.password != request.data.get("password", "")
                                ),
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "views.py:90",
                            "message": "RegisterView JWT tokens generated",
                            "data": {
                                "has_access_token": bool(access_token),
                                "has_refresh_token": bool(refresh),
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=["Authentication"],
    summary="User Login",
    description=("Authenticate user with email and password, receive JWT tokens."),
    request={
        "application/json": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "format": "email",
                    "example": "user@example.com",
                },
                "password": {
                    "type": "string",
                    "format": "password",
                    "example": "SecurePass123",
                },
            },
            "required": ["email", "password"],
        }
    },
    responses={
        200: OpenApiExample(
            "Success Response",
            value={
                "user": {
                    "id": 1,
                    "email": "user@example.com",
                    "username": "user",
                    "is_email_verified": False,
                },
                "tokens": {
                    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                },
            },
        ),
        400: OpenApiExample(
            "Bad Request",
            value={"error": "Email and password are required."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"error": "Invalid email or password."},
        ),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    User login endpoint.

    POST /api/auth/login/
    Authenticates user and returns JWT tokens.
    """
    # #region agent log
    log_path = str(settings.BASE_DIR / ".cursor" / "debug.log")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "views.py:158",
                        "message": "login_view entry",
                        "data": {
                            "email_provided": bool(request.data.get("email")),
                            "password_provided": bool(request.data.get("password")),
                        },
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "B",
                            "location": "views.py:163",
                            "message": "login_view missing fields",
                            "data": {
                                "has_email": bool(email),
                                "has_password": bool(password),
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return Response(
            {"error": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_email = email.lower().strip()
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "views.py:170",
                        "message": "login_view email normalized",
                        "data": {"original": email, "normalized": normalized_email},
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion
    try:
        user = User.objects.get(email=normalized_email)
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "B",
                            "location": "views.py:174",
                            "message": "login_view user found",
                            "data": {"user_id": user.id, "email": user.email},
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
    except User.DoesNotExist:
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "B",
                            "location": "views.py:177",
                            "message": "login_view user not found",
                            "data": {"email": normalized_email},
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    password_valid = user.check_password(password)
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "views.py:185",
                        "message": "login_view password checked",
                        "data": {"password_valid": password_valid},
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion
    if not password_valid:
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access_token = refresh.access_token
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "views.py:195",
                        "message": "login_view JWT tokens generated",
                        "data": {
                            "has_access_token": bool(access_token),
                            "has_refresh_token": bool(refresh),
                        },
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion

    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(access_token),
            },
        },
        status=status.HTTP_200_OK,
    )


@extend_schema(
    tags=["Authentication"],
    summary="Refresh Access Token",
    description="Use refresh token to obtain a new access token.",
    request={
        "application/json": {
            "type": "object",
            "properties": {
                "refresh": {
                    "type": "string",
                    "example": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                },
            },
            "required": ["refresh"],
        }
    },
    responses={
        200: OpenApiExample(
            "Success Response",
            value={"access": "eyJ0eXAiOiJKV1QiLCJhbGc..."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Token is invalid or expired"},
        ),
    },
)
class RefreshTokenView(TokenRefreshView):
    """
    Token refresh endpoint.

    POST /api/auth/refresh/
    Accepts refresh token and returns new access token.
    """

    pass


@extend_schema(
    tags=["Authentication"],
    summary="User Logout",
    description="Blacklist the refresh token to log out the user.",
    request={
        "application/json": {
            "type": "object",
            "properties": {
                "refresh": {
                    "type": "string",
                    "example": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                },
            },
            "required": ["refresh"],
        }
    },
    responses={
        200: OpenApiExample(
            "Success Response",
            value={"detail": "Successfully logged out."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Token is invalid or expired"},
        ),
    },
)
class LogoutView(TokenBlacklistView):
    """
    User logout endpoint.

    POST /api/auth/logout/
    Blacklists the refresh token.
    """

    pass


@extend_schema(
    tags=["Authentication"],
    summary="User Profile",
    description="Get or update current user's profile information.",
    responses={
        200: UserSerializer,
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    User profile endpoint.

    GET /api/auth/me/ - Returns current user's profile information.
    PATCH /api/auth/me/ - Allows updating user profile
    (webhook_url, first_name, last_name).
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Return the current authenticated user."""
        # #region agent log
        log_path = str(settings.BASE_DIR / ".cursor" / "debug.log")
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "C",
                            "location": "views.py:298",
                            "message": "UserProfileView.get_object",
                            "data": {
                                "user_authenticated": self.request.user.is_authenticated,
                                "user_id": (
                                    self.request.user.id
                                    if self.request.user.is_authenticated
                                    else None
                                ),
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return self.request.user


# OAuth Views
@extend_schema(
    tags=["Authentication"],
    summary="OAuth Callback",
    description=(
        "Generate JWT tokens after successful OAuth authentication. "
        "This endpoint is called after OAuth provider redirects back."
    ),
    responses={
        200: OpenApiExample(
            "Success Response",
            value={
                "user": {
                    "id": 1,
                    "email": "user@example.com",
                    "username": "user",
                },
                "tokens": {
                    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                },
            },
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"error": "OAuth authentication failed."},
        ),
    },
)
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def oauth_callback(request, provider):
    """
    OAuth callback endpoint.

    GET/POST /api/auth/oauth/callback/<provider>/
    Generates JWT tokens after successful OAuth authentication.
    """
    # Get user from session (set by social_django)
    user = request.user if request.user.is_authenticated else None

    if not user:
        # Try to get user from social auth
        try:
            social_auth = UserSocialAuth.objects.filter(provider=provider).latest(
                "created"
            )
            user = social_auth.user
        except UserSocialAuth.DoesNotExist:
            return Response(
                {"error": "OAuth authentication failed. Please try again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access_token = refresh.access_token

    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(access_token),
            },
        },
        status=status.HTTP_200_OK,
    )


@extend_schema(
    tags=["Authentication"],
    summary="List OAuth Providers",
    description="Get list of OAuth providers linked to current user account.",
    responses={
        200: OpenApiExample(
            "Success Response",
            value={
                "providers": [
                    {"provider": "google-oauth2", "uid": "123456789"},
                    {"provider": "github", "uid": "github_user"},
                ]
            },
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def oauth_providers(request):
    """
    List OAuth providers linked to user account.

    GET /api/auth/oauth/providers/
    Returns list of connected OAuth providers.
    """
    social_auths = UserSocialAuth.objects.filter(user=request.user)
    providers = [
        {"provider": sa.provider, "uid": sa.uid, "created": sa.created}
        for sa in social_auths
    ]

    return Response({"providers": providers}, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Authentication"],
    summary="Link OAuth Provider",
    description="Link additional OAuth provider to current user account.",
    responses={
        200: OpenApiExample(
            "Success Response",
            value={"message": "OAuth provider linked successfully."},
        ),
        400: OpenApiExample(
            "Bad Request",
            value={"error": "Provider already linked."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def oauth_link(request, provider):
    """
    Link OAuth provider to user account.

    POST /api/auth/oauth/link/<provider>/
    Links additional OAuth provider to current authenticated user.
    """
    # Check if provider is already linked
    if UserSocialAuth.objects.filter(user=request.user, provider=provider).exists():
        return Response(
            {
                "error": (f"Provider {provider} is already linked to your account."),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Redirect to OAuth provider for authentication
    # The actual linking happens in the callback
    from django.shortcuts import redirect
    from django.urls import reverse

    return redirect(reverse("social:begin", args=[provider]))


@extend_schema(
    tags=["Authentication"],
    summary="Disconnect OAuth Provider",
    description="Disconnect OAuth provider from user account.",
    responses={
        200: OpenApiExample(
            "Success Response",
            value={"message": "OAuth provider disconnected successfully."},
        ),
        404: OpenApiExample(
            "Not Found",
            value={"error": "Provider not linked to your account."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def oauth_disconnect(request, provider):
    """
    Disconnect OAuth provider from user account.

    POST /api/auth/oauth/disconnect/<provider>/
    Removes OAuth provider connection from current authenticated user.
    """
    try:
        social_auth = UserSocialAuth.objects.get(user=request.user, provider=provider)
        social_auth.delete()
        return Response(
            {"message": f"Provider {provider} disconnected successfully."},
            status=status.HTTP_200_OK,
        )
    except UserSocialAuth.DoesNotExist:
        return Response(
            {"error": f"Provider {provider} is not linked to your account."},
            status=status.HTTP_404_NOT_FOUND,
        )
