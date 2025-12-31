"""
Tests for Django models.
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone
from freezegun import freeze_time

from app.models import City, NotificationLog, Subscription, User, WeatherData


class TestUser:
    """Tests for User model."""

    def test_user_str(self, db):
        """Test User __str__ method."""
        from tests.factories import UserFactory

        user = UserFactory(email="test@example.com")
        assert str(user) == "test@example.com"

    def test_user_email_uniqueness(self, db):
        """Test that email must be unique."""
        from app.models import User

        User.objects.create_user(
            email="test@example.com",
            username="testuser1",
            password="testpass123",
        )
        with pytest.raises(IntegrityError):
            User.objects.create_user(
                email="test@example.com",
                username="testuser2",
                password="testpass123",
            )

    def test_user_username_field(self, db):
        """Test that USERNAME_FIELD is email."""
        assert User.USERNAME_FIELD == "email"

    def test_user_required_fields(self, db):
        """Test that username is in REQUIRED_FIELDS."""
        assert "username" in User.REQUIRED_FIELDS


class TestCity:
    """Tests for City model."""

    def test_city_str(self, db):
        """Test City __str__ method."""
        from tests.factories import CityFactory

        city = CityFactory(name="Kyiv", country="UA")
        assert str(city) == "Kyiv, UA"

    def test_city_unique_together(self, db):
        """Test that (name, country) must be unique."""
        from tests.factories import CityFactory

        CityFactory(name="Kyiv", country="UA")
        # Same name and country should raise IntegrityError
        with pytest.raises(IntegrityError):
            CityFactory(name="Kyiv", country="UA")

    def test_city_different_country_allowed(self, db):
        """Test that same name in different country is allowed."""
        from tests.factories import CityFactory

        CityFactory(name="Kyiv", country="UA")
        # Same name but different country should be allowed
        city2 = CityFactory(name="Kyiv", country="US")
        assert city2.name == "Kyiv"
        assert city2.country == "US"


class TestSubscription:
    """Tests for Subscription model."""

    def test_subscription_str(self, db):
        """Test Subscription __str__ method."""
        from tests.factories import SubscriptionFactory

        subscription = SubscriptionFactory()
        expected = f"{subscription.user.email} - {subscription.city.name}"
        assert str(subscription) == expected

    def test_subscription_unique_together(self, db):
        """Test that (user, city) must be unique."""
        from tests.factories import SubscriptionFactory, UserFactory, CityFactory

        user = UserFactory()
        city = CityFactory()
        SubscriptionFactory(user=user, city=city)
        # Same user and city should raise IntegrityError
        with pytest.raises(IntegrityError):
            SubscriptionFactory(user=user, city=city)

    def test_subscription_is_due_for_notification_first_time(self, db):
        """Test is_due_for_notification when last_notified_at is None."""
        from tests.factories import SubscriptionFactory

        subscription = SubscriptionFactory(last_notified_at=None, is_active=True)
        assert subscription.is_due_for_notification() is True

    @freeze_time("2024-01-01 12:00:00")
    def test_subscription_is_due_for_notification_due(self, db):
        """Test is_due_for_notification when time difference >= period."""
        from tests.factories import SubscriptionFactory

        # Create subscription with period=3 hours, last_notified 4 hours ago
        subscription = SubscriptionFactory(
            period=3,
            is_active=True,
            last_notified_at=timezone.now() - timezone.timedelta(hours=4),
        )
        assert subscription.is_due_for_notification() is True

    @freeze_time("2024-01-01 12:00:00")
    def test_subscription_is_due_for_notification_not_due(self, db):
        """Test is_due_for_notification when time difference < period."""
        from tests.factories import SubscriptionFactory

        # Create subscription with period=3 hours, last_notified 1 hour ago
        subscription = SubscriptionFactory(
            period=3,
            is_active=True,
            last_notified_at=timezone.now() - timezone.timedelta(hours=1),
        )
        assert subscription.is_due_for_notification() is False

    @freeze_time("2024-01-01 12:00:00")
    def test_subscription_is_due_for_notification_inactive(self, db):
        """Test that inactive subscription is never due."""
        from tests.factories import SubscriptionFactory

        subscription = SubscriptionFactory(
            period=3,
            is_active=False,
            last_notified_at=None,
        )
        assert subscription.is_due_for_notification() is False


class TestWeatherData:
    """Tests for WeatherData model."""

    def test_weather_data_str(self, db):
        """Test WeatherData __str__ method."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory()
        expected = (
            f"{weather_data.city.name} - {weather_data.forecast_period} - "
            f"{weather_data.temperature}°C"
        )
        assert str(weather_data) == expected

    def test_weather_data_unique_together(self, db):
        """Test that (city, forecast_period) must be unique."""
        from app.models import WeatherData
        from tests.factories import WeatherDataFactory, CityFactory

        city = CityFactory()
        WeatherDataFactory(city=city, forecast_period="current")
        # Same city and forecast_period should raise IntegrityError
        # Create directly to avoid django_get_or_create in factory
        with pytest.raises(IntegrityError):
            WeatherData.objects.create(
                city=city,
                forecast_period="current",
                temperature=Decimal("20.5"),
                feels_like=Decimal("20.0"),
                humidity=50,
                pressure=1013,
                wind_speed=Decimal("5.0"),
                description="Clear sky",
                icon="01d",
                fetched_at=timezone.now(),
            )

    def test_weather_data_ordering(self, db):
        """Test that WeatherData is ordered by fetched_at descending."""
        from tests.factories import WeatherDataFactory

        # Create weather data with different fetched_at times
        old_data = WeatherDataFactory(
            fetched_at=timezone.now() - timezone.timedelta(hours=2)
        )
        new_data = WeatherDataFactory(
            fetched_at=timezone.now() - timezone.timedelta(hours=1)
        )

        # Query should return newest first
        all_data = list(WeatherData.objects.all())
        assert all_data[0].fetched_at > all_data[1].fetched_at


class TestNotificationLog:
    """Tests for NotificationLog model."""

    def test_notification_log_str(self, db):
        """Test NotificationLog __str__ method."""
        from tests.factories import NotificationLogFactory

        log = NotificationLogFactory()
        expected = (
            f"{log.subscription} - {log.notification_type} - " f"{log.status}"
        )
        assert str(log) == expected

    def test_notification_log_relationships(self, db):
        """Test NotificationLog relationships."""
        from tests.factories import (
            NotificationLogFactory,
            SubscriptionFactory,
            WeatherDataFactory,
        )

        subscription = SubscriptionFactory()
        weather_data = WeatherDataFactory()
        log = NotificationLogFactory(
            subscription=subscription, weather_data=weather_data
        )

        assert log.subscription == subscription
        assert log.weather_data == weather_data
        assert subscription.logs.count() == 1
        assert weather_data.logs.count() == 1

    def test_notification_log_weather_data_nullable(self, db):
        """Test that weather_data can be None."""
        from tests.factories import NotificationLogFactory

        log = NotificationLogFactory(weather_data=None)
        assert log.weather_data is None
