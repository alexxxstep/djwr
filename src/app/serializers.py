"""
Django REST Framework serializers for DjangoWeatherReminder application.
"""

import json
import re
from datetime import datetime

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import City, User, WeatherData


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.

    Validates email format, password strength, and creates user account.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        label="Confirm Password",
    )

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "password",
            "password2",
            "first_name",
            "last_name",
        ]
        extra_kwargs = {
            "email": {"required": True},
            "username": {"required": True},
            "first_name": {"required": False},
            "last_name": {"required": False},
        }

    def validate_email(self, value):
        """Validate email format."""
        if not value:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower().strip()

    def validate_password(self, value):
        """Validate password strength."""
        if len(value) < 8:
            raise serializers.ValidationError(
                "Password must be at least 8 characters long."
            )
        if not re.search(r"[A-Za-z]", value):
            raise serializers.ValidationError(
                "Password must contain at least one letter."
            )
        if not re.search(r"[0-9]", value):
            raise serializers.ValidationError(
                "Password must contain at least one digit."
            )
        return value

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password2": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        """Create user with hashed password."""
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
                            "location": "serializers.py:84",
                            "message": "UserRegistrationSerializer.create entry",
                            "data": {
                                "email": validated_data.get("email", ""),
                                "has_password": "password" in validated_data,
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password,
            is_email_verified=False,
            **validated_data,
        )
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "serializers.py:93",
                            "message": "UserRegistrationSerializer.create user created",
                            "data": {
                                "user_id": user.id,
                                "email": user.email,
                                "password_hashed": user.password != password,
                                "is_email_verified": user.is_email_verified,
                            },
                            "timestamp": int(datetime.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile.

    Used for retrieving and updating user profile information.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "is_email_verified",
            "webhook_url",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "email",
            "username",
            "is_email_verified",
            "date_joined",
        ]

    def validate_webhook_url(self, value):
        """Validate webhook URL format if provided."""
        if value:
            # Basic URL validation
            url_pattern = re.compile(
                r"^https?://"  # http:// or https://
                r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain...
                r"localhost|"  # localhost...
                r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
                r"(?::\d+)?"  # optional port
                r"(?:/?|[/?]\S+)$",
                re.IGNORECASE,
            )
            if not url_pattern.match(value):
                raise serializers.ValidationError(
                    "Enter a valid URL (e.g., https://example.com/webhook)."
                )
        return value


class WeatherDataSerializer(serializers.ModelSerializer):
    """
    Serializer for WeatherData model.

    Used for serializing weather information for cities.
    """

    city_id = serializers.IntegerField(source="city.id", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)

    class Meta:
        model = WeatherData
        fields = [
            "id",
            "city_id",
            "city_name",
            "forecast_period",
            "temperature",
            "feels_like",
            "humidity",
            "pressure",
            "wind_speed",
            "wind_deg",
            "visibility",
            "clouds",
            "description",
            "icon",
            "fetched_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "city_id",
            "city_name",
            "fetched_at",
            "created_at",
            "updated_at",
        ]


class CitySerializer(serializers.ModelSerializer):
    """
    Serializer for City model.

    Used for listing cities and basic city information.
    """

    subscriptions_count = serializers.IntegerField(
        source="subscriptions.count", read_only=True
    )

    class Meta:
        model = City
        fields = [
            "id",
            "name",
            "country",
            "latitude",
            "longitude",
            "subscriptions_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "subscriptions_count",
            "created_at",
            "updated_at",
        ]


class CityDetailSerializer(CitySerializer):
    """
    Extended City serializer with current weather data.

    Used for city detail views that include weather information.
    """

    current_weather = serializers.SerializerMethodField()

    class Meta(CitySerializer.Meta):
        fields = CitySerializer.Meta.fields + ["current_weather"]

    def get_current_weather(self, obj):
        """
        Get current weather data for the city.

        Returns the most recent 'current' weather data.
        """
        current_weather = (
            obj.weather_data.filter(forecast_period="current")
            .order_by("-fetched_at")
            .first()
        )

        if current_weather:
            return WeatherDataSerializer(current_weather).data
        return None
