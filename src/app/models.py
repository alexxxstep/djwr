"""
Django models for DjangoWeatherReminder application.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    """
    Abstract base model with common fields for all models.
    Provides created_at and updated_at timestamps.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class User(AbstractUser):
    """
    Custom user model with email as username.
    Extends Django's AbstractUser to use email for authentication.
    """

    email = models.EmailField(unique=True, db_index=True)
    is_email_verified = models.BooleanField(default=False)
    webhook_url = models.URLField(max_length=500, blank=True, null=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email


class City(BaseModel):
    """
    City model representing a geographical location.
    Stores city name, country, and coordinates.
    """

    name = models.CharField(max_length=100, db_index=True)
    country = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    class Meta:
        db_table = "cities"
        verbose_name = "City"
        verbose_name_plural = "Cities"
        unique_together = [["name", "country"]]
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.name}, {self.country}"


class Subscription(BaseModel):
    """
    Subscription model for user's weather update subscriptions.

    Represents a user's subscription to weather updates for a specific city.
    """

    PERIOD_CHOICES = [
        (1, "1 hour"),
        (3, "3 hours"),
        (6, "6 hours"),
        (12, "12 hours"),
    ]

    FORECAST_PERIOD_CHOICES = [
        ("current", "Current"),
        ("hourly", "Hourly"),
        ("today", "Today"),
        ("tomorrow", "Tomorrow"),
        ("3days", "3 Days"),
        ("week", "Week"),
    ]

    NOTIFICATION_TYPE_CHOICES = [
        ("email", "Email"),
        ("webhook", "Webhook"),
        ("both", "Both"),
    ]

    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    city = models.ForeignKey(
        "City",
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    period = models.IntegerField(choices=PERIOD_CHOICES)
    forecast_period = models.CharField(
        max_length=20,
        choices=FORECAST_PERIOD_CHOICES,
    )
    notification_type = models.CharField(
        max_length=10,
        choices=NOTIFICATION_TYPE_CHOICES,
    )
    is_active = models.BooleanField(default=True)
    last_notified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "subscriptions"
        verbose_name = "Subscription"
        verbose_name_plural = "Subscriptions"
        unique_together = [["user", "city"]]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["is_active", "last_notified_at"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.city.name}"

    def is_due_for_notification(self):
        """
        Check if subscription is due for notification.

        Returns:
            bool: True if subscription should be notified, False otherwise.
        """
        # Check if subscription is active
        if not self.is_active:
            return False

        # First notification (never notified before)
        if self.last_notified_at is None:
            return True

        # Calculate time difference
        now = timezone.now()
        time_diff = now - self.last_notified_at

        # Compare with period (period is in hours)
        hours_diff = time_diff.total_seconds() / 3600

        return hours_diff >= self.period


class WeatherData(BaseModel):
    """
    WeatherData model storing weather information for cities.

    Stores current and forecast weather data fetched from OpenWeatherMap API.
    Data is always stored as JSON array (even for single items like 'current').

    JSON data structure (each item in array):
    {
        "dt": 1704067200,        # Unix timestamp
        "temp": 5.2,             # Temperature °C
        "feels_like": 3.1,       # Feels like °C
        "humidity": 80,          # Humidity %
        "pressure": 1015,        # Pressure hPa
        "wind_speed": 3.5,       # Wind speed m/s
        "wind_deg": 180,         # Wind direction degrees
        "clouds": 75,            # Cloudiness %
        "visibility": 10000,     # Visibility m
        "uvi": 2.5,              # UV index
        "pop": 0.2,              # Probability of precipitation (0-1)
        "rain": 0.5,             # Rain mm (if any)
        "snow": null,            # Snow mm (if any)
        "description": "cloudy", # Weather description
        "icon": "04d"            # Weather icon code
    }
    """

    FORECAST_PERIOD_CHOICES = [
        ("current", "Current"),
        ("hourly", "Hourly"),
        ("today", "Today"),
        ("tomorrow", "Tomorrow"),
        ("3days", "3 Days"),
        ("week", "Week"),
    ]

    city = models.ForeignKey(
        "City",
        on_delete=models.CASCADE,
        related_name="weather_data",
    )
    forecast_period = models.CharField(
        max_length=20,
        choices=FORECAST_PERIOD_CHOICES,
    )
    data = models.JSONField(
        default=list,
        help_text="Weather data as JSON array",
    )
    fetched_at = models.DateTimeField()

    class Meta:
        db_table = "weather_data"
        verbose_name = "Weather Data"
        verbose_name_plural = "Weather Data"
        unique_together = [["city", "forecast_period"]]
        ordering = ["-fetched_at"]
        indexes = [
            models.Index(fields=["city", "forecast_period"]),
            models.Index(fields=["fetched_at"]),
        ]

    def __str__(self):
        count = len(self.data) if self.data else 0
        return f"{self.city.name} - {self.forecast_period} ({count} items)"

    @property
    def items_count(self) -> int:
        """Return number of weather data items."""
        return len(self.data) if self.data else 0

    @property
    def first_item(self) -> dict | None:
        """Return first weather data item or None."""
        if self.data and len(self.data) > 0:
            return self.data[0]
        return None


class NotificationLog(BaseModel):
    """
    NotificationLog model for tracking notification delivery.

    Stores logs of all notification attempts (email, webhook) with status
    and error information for debugging and monitoring.
    """

    NOTIFICATION_TYPE_CHOICES = [
        ("email", "Email"),
        ("webhook", "Webhook"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    subscription = models.ForeignKey(
        "Subscription",
        on_delete=models.CASCADE,
        related_name="logs",
    )
    weather_data = models.ForeignKey(
        "WeatherData",
        on_delete=models.SET_NULL,
        related_name="logs",
        blank=True,
        null=True,
    )
    notification_type = models.CharField(
        max_length=10,
        choices=NOTIFICATION_TYPE_CHOICES,
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="pending",
    )
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "notification_logs"
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["subscription", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.subscription} - {self.notification_type} - {self.status}"
