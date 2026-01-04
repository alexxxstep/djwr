"""
Django REST Framework views for DjangoWeatherReminder application.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.generic import TemplateView
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
)
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView
from social_django.models import UserSocialAuth

from .models import City, Subscription, User
from .serializers import (
    CityDetailSerializer,
    CitySerializer,
    SubscriptionCreateSerializer,
    SubscriptionSerializer,
    SubscriptionUpdateSerializer,
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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

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
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        return Response(
            {"error": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_email = email.lower().strip()

    try:
        user = User.objects.get(email=normalized_email)
    except User.DoesNotExist:
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    password_valid = user.check_password(password)

    if not password_valid:
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Generate JWT tokens
    try:
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
    except Exception:
        return Response(
            {"error": "Token generation failed."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    response_data = {
        "user": UserSerializer(user).data,
        "tokens": {
            "refresh": str(refresh),
            "access": str(access_token),
        },
    }

    return Response(
        response_data,
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
    description="Search cities by name. Returns cities from database or API results (without creating in DB). Cities are created only when user creates a subscription.",
    parameters=[
        OpenApiParameter(
            name="q",
            type=str,
            location=OpenApiParameter.QUERY,
            required=True,
            description="City name to search for",
            examples=[
                OpenApiExample("Kyiv", value="Kyiv"),
                OpenApiExample("London", value="London"),
            ],
        )
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
    Does NOT create cities in database - only returns results for user selection.
    Cities are created only when user creates a subscription.
    """
    query = request.query_params.get("q", "").strip()

    if not query:
        return Response(
            {"error": "Query parameter 'q' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    city_service = CityService()
    # Search without creating cities in DB - only return results for user selection
    results = city_service.search_cities(query, create_in_db=False)

    if not results:
        return Response(
            {"results": [], "count": 0, "message": f"No cities found for '{query}'"},
            status=status.HTTP_200_OK,
        )

    # Check if results are City objects (from DB) or dictionaries (from API)
    if results and isinstance(results[0], dict):
        # API results - return as dictionaries (no DB creation)
        return Response(
            {"results": results, "count": len(results)},
            status=status.HTTP_200_OK,
        )
    else:
        # Database results - serialize City objects
        serializer = CitySerializer(results, many=True)
        return Response(
            {"results": serializer.data, "count": len(results)},
            status=status.HTTP_200_OK,
        )


# Weather Views
@extend_schema(
    tags=["Weather"],
    summary="Get Weather Data",
    description="""
Get weather data for a city with different forecast periods.

## Available Periods

| Period | Description | Items Count | Data Source |
|--------|-------------|-------------|-------------|
| `current` | Current weather conditions | 1 | Real-time data |
| `hourly` | Hourly forecast for next 48 hours | up to 48 | Hourly forecast |
| `today` | Today's daily forecast | 1 | Daily forecast |
| `tomorrow` | Tomorrow's daily forecast | 1 | Daily forecast |
| `3days` | 3-day forecast | 3 | Daily forecast |
| `week` | 7-day forecast (max available) | 7 | Daily forecast |

## Response Structure

All responses have unified format with `data` always being an array:

```json
{
  "city": {"id": 1, "name": "Kyiv", "country": "UA"},
  "period": "current",
  "data": [...],
  "items_count": 1,
  "fetched_at": "2024-01-01T12:00:00Z"
}
```

## Data Fields

### For `current` and `hourly` periods:
- `dt` - Unix timestamp
- `temp` - Temperature (°C)
- `feels_like` - Feels like temperature (°C)
- `humidity` - Humidity (%)
- `pressure` - Atmospheric pressure (hPa)
- `wind_speed` - Wind speed (m/s)
- `wind_deg` - Wind direction (degrees)
- `visibility` - Visibility (meters)
- `clouds` - Cloudiness (%)
- `uvi` - UV index
- `description` - Weather description
- `icon` - Weather icon code

### For daily periods (`today`, `tomorrow`, `3days`, `week`):
All fields above plus:
- `temp_min` - Minimum temperature (°C)
- `temp_max` - Maximum temperature (°C)
- `pop` - Probability of precipitation (0-1)
- `rain` - Rain volume (mm, if applicable)
- `snow` - Snow volume (mm, if applicable)

## Caching

Data is cached in Redis with period-specific TTL:
- `current`: 10 minutes
- `hourly`: 30 minutes
- `today`, `tomorrow`: 1 hour
- `3days`, `week`: 3 hours
    """,
    parameters=[
        OpenApiParameter(
            name="period",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            default="current",
            description=(
                "Forecast period. Options: current, hourly, today, "
                "tomorrow, 3days, week"
            ),
            enum=[
                "current",
                "hourly",
                "today",
                "tomorrow",
                "3days",
                "week",
            ],
        )
    ],
    examples=[
        OpenApiExample(
            "Current Weather",
            summary="Current weather (period=current)",
            description="Returns single item with current conditions",
            value={
                "city": {"id": 1, "name": "Kyiv", "country": "UA"},
                "period": "current",
                "data": [
                    {
                        "dt": 1704283200,
                        "temp": 5.2,
                        "feels_like": 2.1,
                        "humidity": 78,
                        "pressure": 1015,
                        "wind_speed": 4.5,
                        "wind_deg": 180,
                        "visibility": 10000,
                        "clouds": 75,
                        "uvi": 0.5,
                        "description": "overcast clouds",
                        "icon": "04d",
                    }
                ],
                "items_count": 1,
                "fetched_at": "2026-01-03T12:00:00Z",
            },
        ),
        OpenApiExample(
            "Hourly Forecast",
            summary="Hourly forecast (period=hourly)",
            description="Returns up to 48 hourly forecasts",
            value={
                "city": {"id": 1, "name": "Kyiv", "country": "UA"},
                "period": "hourly",
                "data": [
                    {
                        "dt": 1704283200,
                        "temp": 5.2,
                        "feels_like": 2.1,
                        "humidity": 78,
                        "pressure": 1015,
                        "wind_speed": 4.5,
                        "wind_deg": 180,
                        "visibility": 10000,
                        "clouds": 75,
                        "uvi": 0.5,
                        "pop": 0.2,
                        "description": "overcast clouds",
                        "icon": "04d",
                    },
                    {
                        "dt": 1704286800,
                        "temp": 4.8,
                        "feels_like": 1.5,
                        "humidity": 82,
                        "pressure": 1016,
                        "wind_speed": 5.1,
                        "wind_deg": 190,
                        "visibility": 10000,
                        "clouds": 80,
                        "uvi": 0.3,
                        "pop": 0.35,
                        "description": "light rain",
                        "icon": "10d",
                    },
                ],
                "items_count": 48,
                "fetched_at": "2026-01-03T12:00:00Z",
            },
        ),
        OpenApiExample(
            "Today Forecast",
            summary="Today's forecast (period=today)",
            description="Returns single daily forecast for today",
            value={
                "city": {"id": 1, "name": "Kyiv", "country": "UA"},
                "period": "today",
                "data": [
                    {
                        "dt": 1704283200,
                        "temp": 6.5,
                        "temp_min": 2.1,
                        "temp_max": 8.3,
                        "feels_like": 4.2,
                        "humidity": 72,
                        "pressure": 1015,
                        "wind_speed": 4.5,
                        "wind_deg": 180,
                        "clouds": 75,
                        "uvi": 1.2,
                        "pop": 0.15,
                        "description": "overcast clouds",
                        "icon": "04d",
                    }
                ],
                "items_count": 1,
                "fetched_at": "2026-01-03T12:00:00Z",
            },
        ),
        OpenApiExample(
            "Week Forecast",
            summary="7-day forecast (period=week)",
            description="Returns 7 daily forecasts",
            value={
                "city": {"id": 1, "name": "Kyiv", "country": "UA"},
                "period": "week",
                "data": [
                    {
                        "dt": 1704283200,
                        "temp": 6.5,
                        "temp_min": 2.1,
                        "temp_max": 8.3,
                        "feels_like": 4.2,
                        "humidity": 72,
                        "pressure": 1015,
                        "wind_speed": 4.5,
                        "pop": 0.15,
                        "description": "overcast clouds",
                        "icon": "04d",
                    },
                    {
                        "dt": 1704369600,
                        "temp": 4.2,
                        "temp_min": 0.5,
                        "temp_max": 5.8,
                        "feels_like": 1.8,
                        "humidity": 85,
                        "pressure": 1012,
                        "wind_speed": 6.2,
                        "pop": 0.65,
                        "rain": 2.5,
                        "description": "light rain",
                        "icon": "10d",
                    },
                ],
                "items_count": 7,
                "fetched_at": "2026-01-03T12:00:00Z",
            },
        ),
    ],
    responses={
        200: {
            "description": "Weather data retrieved successfully",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "integer", "example": 1},
                                    "name": {"type": "string", "example": "Kyiv"},
                                    "country": {"type": "string", "example": "UA"},
                                },
                            },
                            "period": {
                                "type": "string",
                                "enum": [
                                    "current",
                                    "hourly",
                                    "today",
                                    "tomorrow",
                                    "3days",
                                    "week",
                                ],
                                "example": "current",
                            },
                            "data": {
                                "type": "array",
                                "description": "Weather data array (always array)",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "dt": {
                                            "type": "integer",
                                            "description": "Unix timestamp",
                                        },
                                        "temp": {
                                            "type": "number",
                                            "description": "Temperature (°C)",
                                        },
                                        "temp_min": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "Min temp (daily only)",
                                        },
                                        "temp_max": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "Max temp (daily only)",
                                        },
                                        "feels_like": {
                                            "type": "number",
                                            "description": "Feels like (°C)",
                                        },
                                        "humidity": {
                                            "type": "integer",
                                            "description": "Humidity (%)",
                                        },
                                        "pressure": {
                                            "type": "integer",
                                            "description": "Pressure (hPa)",
                                        },
                                        "wind_speed": {
                                            "type": "number",
                                            "description": "Wind speed (m/s)",
                                        },
                                        "wind_deg": {
                                            "type": "integer",
                                            "nullable": True,
                                            "description": "Wind direction (°)",
                                        },
                                        "visibility": {
                                            "type": "integer",
                                            "nullable": True,
                                            "description": "Visibility (m)",
                                        },
                                        "clouds": {
                                            "type": "integer",
                                            "nullable": True,
                                            "description": "Cloudiness (%)",
                                        },
                                        "uvi": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "UV index",
                                        },
                                        "pop": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "Precipitation prob",
                                        },
                                        "rain": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "Rain volume (mm)",
                                        },
                                        "snow": {
                                            "type": "number",
                                            "nullable": True,
                                            "description": "Snow volume (mm)",
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": "Weather description",
                                        },
                                        "icon": {
                                            "type": "string",
                                            "description": "Icon code",
                                        },
                                    },
                                },
                            },
                            "items_count": {
                                "type": "integer",
                                "description": "Number of items in data array",
                            },
                            "fetched_at": {
                                "type": "string",
                                "format": "date-time",
                                "description": "Timestamp when data was fetched",
                            },
                        },
                    },
                },
            },
        },
        400: OpenApiExample(
            "Invalid Period",
            value={
                "error": (
                    "Invalid period. Valid options: current, hourly, "
                    "today, tomorrow, 3days, week"
                )
            },
        ),
        404: OpenApiExample(
            "City Not Found",
            value={"detail": "Not found."},
        ),
        500: OpenApiExample(
            "Server Error",
            value={"error": "Failed to fetch weather data. Please try again later."},
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
    Period options: current, hourly, today, tomorrow, 3days, week
    Default period: current

    Response format (unified):
    {
        "city": {"id": 1, "name": "Kyiv", "country": "UA"},
        "period": "current",
        "data": [...],  # Always array
        "items_count": 1,
        "fetched_at": "2024-01-01T12:00:00Z"
    }
    """
    import logging

    period = request.query_params.get("period", "current").strip()

    # Validate period
    valid_periods = [
        "current",
        "hourly",
        "today",
        "tomorrow",
        "3days",
        "week",
    ]
    if period not in valid_periods:
        return Response(
            {"error": f"Invalid period. Valid options: {', '.join(valid_periods)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get city
    city = get_object_or_404(City, pk=city_id)

    # Fetch weather data
    weather_service = WeatherService()
    try:
        if period == "current":
            result = weather_service.fetch_current_weather(city)
            if isinstance(result, tuple):
                weather_data, timezone_offset = result
            else:
                # Fallback for cached data without timezone_offset
                weather_data = result
                timezone_offset = 0
        else:
            result = weather_service.fetch_forecast(city, period)
            if isinstance(result, tuple):
                weather_data, timezone_offset = result
            else:
                # Fallback for cached data without timezone_offset
                weather_data = result
                timezone_offset = 0
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to fetch weather for {city.name}: {e}")
        return Response(
            {"error": "Failed to fetch weather data. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Unified response format - weather_data is always a list now
    response_data = {
        "city": {
            "id": city.id,
            "name": city.name,
            "country": city.country,
        },
        "period": period,
        "data": weather_data,
        "items_count": len(weather_data),
        "fetched_at": timezone.now().isoformat(),
        "timezone_offset": timezone_offset,  # Timezone offset in seconds
    }

    return Response(response_data, status=status.HTTP_200_OK)


@extend_schema(
    tags=["Weather"],
    summary="Weather History",
    description="""
Get historical weather data for a city from database.

Returns cached weather records stored in database, ordered by fetch time (newest first).
Each record contains weather data for a specific forecast period.

## Response Structure

Paginated response with weather history records:

```json
{
  "count": 10,
  "next": "http://api/weather/1/history/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "city": 1,
      "forecast_period": "current",
      "data": [...],
      "items_count": 1,
      "fetched_at": "2026-01-03T12:00:00Z"
    }
  ]
}
```

## Use Cases

- View historical weather data for analytics
- Debug caching behavior
- Compare weather changes over time
    """,
    parameters=[
        OpenApiParameter(
            name="page",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            default=1,
            description="Page number for pagination",
        )
    ],
    examples=[
        OpenApiExample(
            "Weather History Response",
            summary="Paginated weather history",
            value={
                "count": 25,
                "next": "http://localhost:8000/api/weather/1/history/?page=2",
                "previous": None,
                "results": [
                    {
                        "id": 1,
                        "city": 1,
                        "forecast_period": "current",
                        "data": [
                            {
                                "dt": 1704283200,
                                "temp": 5.2,
                                "feels_like": 2.1,
                                "humidity": 78,
                                "pressure": 1015,
                                "wind_speed": 4.5,
                                "description": "overcast clouds",
                                "icon": "04d",
                            }
                        ],
                        "items_count": 1,
                        "fetched_at": "2026-01-03T12:00:00Z",
                    },
                    {
                        "id": 2,
                        "city": 1,
                        "forecast_period": "week",
                        "data": [
                            {
                                "dt": 1704283200,
                                "temp": 6.5,
                                "temp_min": 2.1,
                                "temp_max": 8.3,
                                "description": "cloudy",
                                "icon": "03d",
                            },
                        ],
                        "items_count": 7,
                        "fetched_at": "2026-01-03T11:30:00Z",
                    },
                ],
            },
        ),
    ],
    responses={
        200: WeatherDataSerializer(many=True),
        404: OpenApiExample(
            "City Not Found",
            value={"detail": "Not found."},
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
    Ordered by fetched_at descending, paginated (20 items per page).
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
    response_data = paginator.get_paginated_response(serializer.data)

    return response_data


# Subscription Permissions
class IsSubscriptionOwner(BasePermission):
    """
    Permission class to check if user owns the subscription.

    Allows access only if the subscription belongs to the requesting user.
    """

    def has_object_permission(self, request, view, obj):
        """Check if the subscription belongs to the requesting user."""
        return obj.user == request.user


# Subscription Views
@extend_schema(
    tags=["Subscriptions"],
    summary="List and Create Subscriptions",
    description="""
Manage weather subscriptions for cities.

## GET - List Subscriptions

Returns paginated list of current user's subscriptions with city details.

## POST - Create Subscription

Create a new subscription for a city with specified forecast period and notification interval.

### Available Forecast Periods

| Period | Description | Data Items |
|--------|-------------|------------|
| `current` | Current weather | 1 |
| `hourly` | Hourly forecast (48h) | up to 48 |
| `today` | Today's forecast | 1 |
| `tomorrow` | Tomorrow's forecast | 1 |
| `3days` | 3-day forecast | 3 |
| `week` | 7-day forecast (max available) | 7 |

### Notification Periods (hours)

Available intervals: 1, 3, 6, 12, 24 hours

### Request Body Example

```json
{
  "city_id": 1,
  "forecast_period": "week",
  "notification_period": 6
}
```
    """,
    examples=[
        OpenApiExample(
            "Create Subscription",
            summary="Create weekly forecast subscription",
            request_only=True,
            value={
                "city_id": 1,
                "forecast_period": "week",
                "notification_period": 6,
            },
        ),
        OpenApiExample(
            "Subscription List Response",
            summary="List of user subscriptions",
            response_only=True,
            value={
                "count": 2,
                "next": None,
                "previous": None,
                "results": [
                    {
                        "id": 1,
                        "city": {
                            "id": 1,
                            "name": "Kyiv",
                            "country": "UA",
                            "latitude": "50.4501",
                            "longitude": "30.5234",
                        },
                        "forecast_period": "current",
                        "notification_period": 1,
                        "is_active": True,
                        "created_at": "2026-01-01T10:00:00Z",
                        "updated_at": "2026-01-01T10:00:00Z",
                    },
                    {
                        "id": 2,
                        "city": {
                            "id": 2,
                            "name": "London",
                            "country": "GB",
                            "latitude": "51.5074",
                            "longitude": "-0.1278",
                        },
                        "forecast_period": "week",
                        "notification_period": 12,
                        "is_active": True,
                        "created_at": "2026-01-02T15:30:00Z",
                        "updated_at": "2026-01-02T15:30:00Z",
                    },
                ],
            },
        ),
    ],
    responses={
        200: SubscriptionSerializer(many=True),
        201: SubscriptionSerializer,
        400: OpenApiExample(
            "Validation Error",
            value={
                "forecast_period": [
                    "Invalid period. Choose from: current, hourly, today, "
                    "tomorrow, 3days, week"
                ]
            },
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
class SubscriptionListCreateView(generics.ListCreateAPIView):
    """
    Subscription list and create endpoint.

    GET /api/subscriptions/ - Returns paginated list of user's subscriptions.
    POST /api/subscriptions/ - Creates a new subscription.
    Requires authentication.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return subscriptions for the current user only."""
        return Subscription.objects.filter(user=self.request.user).select_related(
            "city", "user"
        )

    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == "POST":
            return SubscriptionCreateSerializer
        return SubscriptionSerializer

    def perform_create(self, serializer):
        """Set user automatically from request."""
        serializer.save(user=self.request.user)


@extend_schema(
    tags=["Subscriptions"],
    summary="Subscription Details, Update, Delete",
    description="""
Get, update, or delete a subscription. Only accessible by subscription owner.

## GET - Subscription Details

Returns full subscription details including city information.

## PATCH/PUT - Update Subscription

Update subscription settings:
- `forecast_period` - Weather forecast type
- `notification_period` - Notification interval in hours
- `is_active` - Enable/disable subscription

### Available Forecast Periods

| Period | Description |
|--------|-------------|
| `current` | Current weather |
| `hourly` | Hourly forecast (48h) |
| `today` | Today's forecast |
| `tomorrow` | Tomorrow's forecast |
| `3days` | 3-day forecast |
| `week` | 7-day forecast (max available) |

### Notification Periods

Available intervals: 1, 3, 6, 12, 24 hours

## DELETE - Remove Subscription

Permanently removes the subscription.
    """,
    examples=[
        OpenApiExample(
            "Update Subscription",
            summary="Change to weekly forecast with 12h notifications",
            request_only=True,
            value={
                "forecast_period": "week",
                "notification_period": 12,
            },
        ),
        OpenApiExample(
            "Subscription Detail Response",
            summary="Full subscription details",
            response_only=True,
            value={
                "id": 1,
                "city": {
                    "id": 1,
                    "name": "Kyiv",
                    "country": "UA",
                    "latitude": "50.4501",
                    "longitude": "30.5234",
                },
                "forecast_period": "week",
                "notification_period": 12,
                "is_active": True,
                "created_at": "2026-01-01T10:00:00Z",
                "updated_at": "2026-01-03T14:00:00Z",
            },
        ),
    ],
    responses={
        200: SubscriptionSerializer,
        204: OpenApiExample("Deleted", value=None),
        400: OpenApiExample(
            "Validation Error",
            value={
                "forecast_period": [
                    "Invalid period. Choose from: current, hourly, today, "
                    "tomorrow, 3days, week"
                ],
                "notification_period": ["Period must be one of: 1, 3, 6, 12, 24"],
            },
        ),
        404: OpenApiExample(
            "Not Found",
            value={"detail": "Not found."},
        ),
        401: OpenApiExample(
            "Unauthorized",
            value={"detail": "Authentication credentials were not provided."},
        ),
    },
)
class SubscriptionDetailUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """
    Subscription detail, update, and delete endpoint.

    GET /api/subscriptions/{id}/ - Returns subscription details.
    PATCH /api/subscriptions/{id}/ - Updates subscription.
    DELETE /api/subscriptions/{id}/ - Deletes subscription.
    Only accessible by subscription owner.
    """

    permission_classes = [IsAuthenticated, IsSubscriptionOwner]

    def get_queryset(self):
        """Return only subscriptions belonging to the current user."""
        return Subscription.objects.filter(user=self.request.user).select_related(
            "city", "user"
        )

    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method in ["PATCH", "PUT"]:
            return SubscriptionUpdateSerializer
        return SubscriptionSerializer
