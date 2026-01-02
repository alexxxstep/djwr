"""
Django REST Framework views for DjangoWeatherReminder application.
"""

import json
from datetime import datetime

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.generic import TemplateView
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView
from social_django.models import UserSocialAuth

from .models import City, User
from .serializers import (
    CityDetailSerializer,
    CitySerializer,
    UserRegistrationSerializer,
    UserSerializer,
    WeatherDataSerializer,
)
from .services.city_service import CityService
from .services.weather_service import WeatherService


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


# City Views
@extend_schema(
    tags=["Cities"],
    summary="List Cities",
    description="Get paginated list of all cities in database.",
    responses={
        200: CitySerializer(many=True),
    },
)
class CityListView(generics.ListAPIView):
    """
    City list endpoint.

    GET /api/cities/
    Returns paginated list of all cities in database.
    """

    queryset = City.objects.all().order_by("name")
    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Will use default DRF pagination


@extend_schema(
    tags=["Cities"],
    summary="City Details",
    description="Get city details with current weather data.",
    responses={
        200: CityDetailSerializer,
        404: OpenApiExample(
            "Not Found",
            value={"detail": "Not found."},
        ),
    },
)
class CityDetailView(generics.RetrieveAPIView):
    """
    City detail endpoint.

    GET /api/cities/{id}/
    Returns city details with current weather.
    Fetches current weather if not cached.
    """

    queryset = City.objects.all()
    serializer_class = CityDetailSerializer
    permission_classes = [AllowAny]

    def retrieve(self, request, *args, **kwargs):
        """Retrieve city and fetch current weather if needed."""
        city = self.get_object()

        # Fetch current weather if not cached
        weather_service = WeatherService()
        try:
            weather_service.fetch_current_weather(city)
        except Exception as e:
            # Log error but don't fail the request
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to fetch weather for {city.name}: {e}")

        serializer = self.get_serializer(city)
        return Response(serializer.data)


@extend_schema(
    tags=["Cities"],
    summary="Search Cities",
    description="Search cities by name using database-first approach.",
    parameters=[
        {
            "name": "q",
            "in": "query",
            "required": True,
            "schema": {"type": "string"},
            "description": "City name to search for",
            "example": "Kyiv",
        }
    ],
    responses={
        200: CitySerializer(many=True),
        400: OpenApiExample(
            "Bad Request",
            value={"error": "Query parameter 'q' is required."},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def city_search_view(request):
    """
    City search endpoint.

    GET /api/cities/search/?q={query}
    Searches cities using database-first approach.
    Falls back to API if not found in database.
    """
    query = request.query_params.get("q", "").strip()

    if not query:
        return Response(
            {"error": "Query parameter 'q' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    city_service = CityService()
    cities = city_service.search_cities(query)

    if not cities:
        return Response(
            {"results": [], "count": 0, "message": f"No cities found for '{query}'"},
            status=status.HTTP_200_OK,
        )

    serializer = CitySerializer(cities, many=True)
    return Response(
        {"results": serializer.data, "count": len(cities)},
        status=status.HTTP_200_OK,
    )


# Weather Views
@extend_schema(
    tags=["Weather"],
    summary="Get Weather Data",
    description=(
        "Get weather data for a city. Supports different forecast periods: "
        "current, today, tomorrow, 3days, week, hourly."
    ),
    parameters=[
        {
            "name": "period",
            "in": "query",
            "required": False,
            "schema": {"type": "string", "default": "current"},
            "description": "Forecast period",
            "enum": [
                "current",
                "today",
                "tomorrow",
                "3days",
                "week",
                "hourly",
                "10days",
                "2weeks",
                "month",
            ],
        }
    ],
    responses={
        200: OpenApiExample(
            "Success Response",
            value={
                "city": {"id": 1, "name": "Kyiv", "country": "UA"},
                "period": "current",
                "temperature": 15.5,
                "feels_like": 14.8,
                "humidity": 65,
                "pressure": 1013,
                "wind_speed": 3.2,
                "description": "clear sky",
                "icon": "01d",
            },
        ),
        404: OpenApiExample(
            "Not Found",
            value={"detail": "City not found."},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def weather_view(request, city_id):
    """
    Weather data endpoint.

    GET /api/weather/{city_id}/?period={period}
    Returns weather data for a city.
    Period options: current, today, tomorrow, 3days, week, hourly
    Default period: current
    """
    # #region agent log
    import json as json_module

    from django.utils import timezone as tz

    try:
        log_path = settings.BASE_DIR / ".cursor" / "debug.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "views.py:973",
                        "message": "weather_view entry - FIRST LINE",
                        "data": {
                            "city_id": city_id,
                            "base_dir": str(settings.BASE_DIR),
                        },
                        "timestamp": int(tz.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Debug log write failed: {e}")
    # #endregion

    period = request.query_params.get("period", "current").strip()

    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "views.py:995",
                        "message": "weather_view after period extraction",
                        "data": {"city_id": city_id, "period": period},
                        "timestamp": int(tz.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion

    # Validate period
    valid_periods = [
        "current",
        "today",
        "tomorrow",
        "3days",
        "week",
        "hourly",
        "10days",
        "2weeks",
        "month",
    ]
    if period not in valid_periods:
        return Response(
            {"error": f"Invalid period. Valid options: {', '.join(valid_periods)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get city
    city = get_object_or_404(City, pk=city_id)

    # Fetch weather data
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "views.py:1045",
                        "message": "weather_view before service call",
                        "data": {"city_id": city.id, "period": period},
                        "timestamp": int(tz.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion
    weather_service = WeatherService()
    try:
        if period == "current":
            weather_data = weather_service.fetch_current_weather(city)
        else:
            weather_data = weather_service.fetch_forecast(city, period)
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json_module.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "views.py:1069",
                            "message": "weather_view after fetch - type check",
                            "data": {
                                "city_id": city.id,
                                "period": period,
                                "weather_data_type": type(weather_data).__name__,
                                "is_list": isinstance(weather_data, list),
                                "is_dict": isinstance(weather_data, dict),
                            },
                            "timestamp": int(tz.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Failed to fetch weather for {city.name}: {e}")
        return Response(
            {"error": "Failed to fetch weather data. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Add city info to response
    # Handle both dict (single forecast) and list (hourly forecast)
    # #region agent log
    log_path = settings.BASE_DIR / ".cursor" / "debug.log"
    with open(log_path, "a") as f:
        f.write(
            json_module.dumps(
                {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "A",
                    "location": "views.py:1015",
                    "message": "weather_view before response construction",
                    "data": {
                        "city_id": city.id,
                        "period": period,
                        "weather_data_type": type(weather_data).__name__,
                        "is_list": isinstance(weather_data, list),
                    },
                    "timestamp": int(tz.now().timestamp() * 1000),
                }
            )
            + "\n"
        )
    # #endregion
    if isinstance(weather_data, list):
        # For hourly forecasts, return list with city info in each item
        response_data = [
            {
                "city": {
                    "id": city.id,
                    "name": city.name,
                    "country": city.country,
                },
                "period": period,
                **item,
            }
            for item in weather_data
        ]
    else:
        # For single forecasts, return dict
        response_data = {
            "city": {
                "id": city.id,
                "name": city.name,
                "country": city.country,
            },
            "period": period,
            **weather_data,
        }

    return Response(response_data, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Weather"],
    summary="Weather History",
    description="Get historical weather data for a city from database.",
    responses={
        200: WeatherDataSerializer(many=True),
        404: OpenApiExample(
            "Not Found",
            value={"detail": "City not found."},
        ),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def weather_history_view(request, city_id):
    """
    Weather history endpoint.

    GET /api/weather/{city_id}/history/
    Returns historical weather data from database.
    Ordered by fetched_at descending, paginated.
    """
    # Get city
    city = get_object_or_404(City, pk=city_id)

    # Get weather history
    from .models import WeatherData

    weather_history = (
        WeatherData.objects.filter(city=city)
        .order_by("-fetched_at")
        .select_related("city")
    )

    # Paginate results
    from rest_framework.pagination import PageNumberPagination

    paginator = PageNumberPagination()
    paginator.page_size = 20
    paginated_history = paginator.paginate_queryset(weather_history, request)

    serializer = WeatherDataSerializer(paginated_history, many=True)
    return paginator.get_paginated_response(serializer.data)
