"""
Django REST Framework serializers for DjangoWeatherReminder application.
"""

import json
import re
from datetime import datetime

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import City, Subscription, User, WeatherData


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
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password,
            is_email_verified=False,
            **validated_data,
        )
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


class SubscriptionSerializer(serializers.ModelSerializer):
    """
    Serializer for Subscription model.

    Includes nested CitySerializer for city information
    and user email (read-only).
    """

    city = CitySerializer(read_only=True)
    city_id = serializers.IntegerField(write_only=True, required=False)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "user",
            "user_email",
            "city",
            "city_id",
            "period",
            "forecast_period",
            "notification_type",
            "is_active",
            "last_notified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "user_email",
            "last_notified_at",
            "created_at",
            "updated_at",
        ]

    def validate_period(self, value):
        """Validate period is one of the allowed choices (1, 3, 6, 12)."""
        valid_periods = [1, 3, 6, 12]
        if value not in valid_periods:
            raise serializers.ValidationError(
                f"Period must be one of: {', '.join(map(str, valid_periods))}"
            )
        return value

    def validate_forecast_period(self, value):
        """Validate forecast_period is one of the allowed choices."""
        valid_periods = ["current", "today", "tomorrow", "3days", "week"]
        if value not in valid_periods:
            raise serializers.ValidationError(
                f"Forecast period must be one of: {', '.join(valid_periods)}"
            )
        return value

    def validate_notification_type(self, value):
        """Validate notification_type is one of the allowed choices."""
        valid_types = ["email", "webhook", "both"]
        if value not in valid_types:
            raise serializers.ValidationError(
                f"Notification type must be one of: {', '.join(valid_types)}"
            )
        return value


class SubscriptionCreateSerializer(SubscriptionSerializer):
    """
    Serializer for creating subscriptions.

    Extends SubscriptionSerializer and adds validation
    to prevent duplicate subscriptions (unique_together: user + city).

    Can create city in database if city_id is not provided but city data is provided.
    """

    city_id = serializers.IntegerField(write_only=True, required=False)
    city_data = serializers.DictField(
        write_only=True,
        required=False,
        help_text="City data (name, country, lat, lon) if city not in DB",
    )
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta(SubscriptionSerializer.Meta):
        fields = SubscriptionSerializer.Meta.fields + ["city_data"]
        read_only_fields = [
            "id",
            "user",
            "user_email",
            "last_notified_at",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        """Validate that user cannot subscribe to the same city twice."""
        user = self.context["request"].user
        city_id = attrs.get("city_id")
        city_data = attrs.get("city_data")

        # Must provide either city_id or city_data
        if not city_id and not city_data:
            raise serializers.ValidationError(
                {"city_id": "Either city_id or city_data must be provided."}
            )

        # If city_id provided, use existing city
        if city_id:
            try:
                city = City.objects.get(pk=city_id)
            except City.DoesNotExist:
                raise serializers.ValidationError({"city_id": "City not found."})
        else:
            # Create city from API data
            if not all(key in city_data for key in ["name", "country", "lat", "lon"]):
                raise serializers.ValidationError(
                    {
                        "city_data": "Must include 'name', 'country', 'lat', and 'lon' fields."
                    }
                )

            from app.services.city_service import CityService

            city_service = CityService()
            city, created = city_service.get_or_create_city(
                name=city_data["name"],
                country=city_data["country"],
                lat=city_data["lat"],
                lon=city_data["lon"],
            )

        # Check if subscription already exists
        if Subscription.objects.filter(user=user, city=city).exists():
            raise serializers.ValidationError(
                {"city_id": "You are already subscribed to this city."}
            )

        attrs["city"] = city
        # Remove city_data from attrs as it's not a model field
        attrs.pop("city_data", None)
        return attrs

    def create(self, validated_data):
        """Create subscription and set user automatically."""
        validated_data["user"] = self.context["request"].user
        city = validated_data.pop("city")
        validated_data["city"] = city
        return super().create(validated_data)


class SubscriptionUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating subscriptions.

    Allows updating period, forecast_period, notification_type, and is_active.
    Prevents updating user and city.
    """

    class Meta:
        model = Subscription
        fields = ["period", "forecast_period", "notification_type", "is_active"]
        read_only_fields = ["user", "city"]

    def validate_period(self, value):
        """Validate period is one of the allowed choices (1, 3, 6, 12)."""
        valid_periods = [1, 3, 6, 12]
        if value not in valid_periods:
            raise serializers.ValidationError(
                f"Period must be one of: {', '.join(map(str, valid_periods))}"
            )
        return value

    def validate_forecast_period(self, value):
        """Validate forecast_period is one of the allowed choices."""
        valid_periods = ["current", "today", "tomorrow", "3days", "week"]
        if value not in valid_periods:
            raise serializers.ValidationError(
                f"Forecast period must be one of: {', '.join(valid_periods)}"
            )
        return value

    def validate_notification_type(self, value):
        """Validate notification_type is one of the allowed choices."""
        valid_types = ["email", "webhook", "both"]
        if value not in valid_types:
            raise serializers.ValidationError(
                f"Notification type must be one of: {', '.join(valid_types)}"
            )
        return value
