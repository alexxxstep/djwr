"""
Django admin configuration for DjangoWeatherReminder application.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import City, NotificationLog, Subscription, User, WeatherData


class SubscriptionInline(admin.TabularInline):
    """Inline admin for Subscription model in User admin."""

    model = Subscription
    extra = 0
    fields = ["city", "period", "forecast_period", "notification_type", "is_active"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model."""

    inlines = [SubscriptionInline]

    list_display = [
        "email",
        "username",
        "first_name",
        "last_name",
        "is_email_verified",
        "is_active",
        "is_staff",
        "date_joined",
    ]
    list_filter = [
        "is_active",
        "is_staff",
        "is_superuser",
        "is_email_verified",
        "date_joined",
    ]
    search_fields = ["email", "username", "first_name", "last_name"]
    ordering = ["-date_joined"]
    readonly_fields = ["date_joined", "last_login"]

    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        (
            "Personal info",
            {"fields": ("first_name", "last_name", "webhook_url")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "is_email_verified",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Important dates",
            {"fields": ("last_login", "date_joined")},
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "username",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    """Admin configuration for City model."""

    list_display = ["name", "country", "latitude", "longitude", "created_at"]
    list_filter = ["country", "created_at"]
    search_fields = ["name", "country"]
    ordering = ["country", "name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    """Admin configuration for Subscription model."""

    list_display = [
        "user",
        "city",
        "period",
        "forecast_period",
        "notification_type",
        "is_active",
        "last_notified_at",
        "created_at",
    ]
    list_filter = [
        "is_active",
        "notification_type",
        "forecast_period",
        "period",
        "created_at",
    ]
    search_fields = ["user__email", "user__username", "city__name", "city__country"]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields = ["user", "city"]

    fieldsets = (
        (
            "Subscription Details",
            {
                "fields": (
                    "user",
                    "city",
                    "period",
                    "forecast_period",
                    "notification_type",
                ),
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "is_active",
                    "last_notified_at",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )


@admin.register(WeatherData)
class WeatherDataAdmin(admin.ModelAdmin):
    """Admin configuration for WeatherData model."""

    list_display = [
        "city",
        "forecast_period",
        "temperature",
        "feels_like",
        "humidity",
        "pressure",
        "wind_speed",
        "description",
        "fetched_at",
    ]
    list_filter = [
        "forecast_period",
        "fetched_at",
        "city__country",
    ]
    search_fields = ["city__name", "city__country", "description"]
    ordering = ["-fetched_at"]
    readonly_fields = ["created_at", "updated_at", "fetched_at"]
    raw_id_fields = ["city"]

    fieldsets = (
        (
            "Location & Period",
            {
                "fields": (
                    "city",
                    "forecast_period",
                ),
            },
        ),
        (
            "Temperature",
            {
                "fields": (
                    "temperature",
                    "feels_like",
                ),
            },
        ),
        (
            "Weather Conditions",
            {
                "fields": (
                    "humidity",
                    "pressure",
                    "wind_speed",
                    "wind_deg",
                    "visibility",
                    "clouds",
                    "description",
                    "icon",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "fetched_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    """Admin configuration for NotificationLog model."""

    list_display = [
        "subscription",
        "notification_type",
        "status",
        "sent_at",
        "created_at",
    ]
    list_filter = [
        "status",
        "notification_type",
        "created_at",
        "sent_at",
    ]
    search_fields = [
        "subscription__user__email",
        "subscription__user__username",
        "subscription__city__name",
        "error_message",
    ]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields = ["subscription", "weather_data"]

    fieldsets = (
        (
            "Notification Details",
            {
                "fields": (
                    "subscription",
                    "weather_data",
                    "notification_type",
                    "status",
                ),
            },
        ),
        (
            "Delivery",
            {
                "fields": (
                    "sent_at",
                    "error_message",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )
