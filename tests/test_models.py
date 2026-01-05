"""
Tests for Django models.
"""

import pytest
from django.db import IntegrityError
from django.utils import timezone
from freezegun import freeze_time

from app.models import User, WeatherData


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
        from tests.factories import (
            CityFactory,
            SubscriptionFactory,
            UserFactory,
        )

        user = UserFactory()
        city = CityFactory()
        SubscriptionFactory(user=user, city=city)
        # Same user and city should raise IntegrityError
        with pytest.raises(IntegrityError):
            SubscriptionFactory(user=user, city=city)

    def test_subscription_is_due_for_notification_first_time(self, db):
        """Test is_due_for_notification when last_notified_at is None."""
        from tests.factories import SubscriptionFactory

        sub = SubscriptionFactory(last_notified_at=None, is_active=True)
        assert sub.is_due_for_notification() is True

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

    def test_subscription_forecast_period_choices(self, db):
        """Test that FORECAST_PERIOD_CHOICES contains expected values."""
        from app.models import Subscription

        expected_choices = [
            ("current", "Current"),
            ("hourly", "Hourly"),
            ("today", "Today"),
            ("tomorrow", "Tomorrow"),
            ("3days", "3 Days"),
            ("week", "Week"),
        ]
        assert Subscription.FORECAST_PERIOD_CHOICES == expected_choices

    def test_subscription_all_forecast_periods_valid(self, db):
        """Test that all forecast periods can be saved to database."""
        from tests.factories import (
            CityFactory,
            SubscriptionFactory,
            UserFactory,
        )

        user = UserFactory()
        valid_periods = [
            "current",
            "hourly",
            "today",
            "tomorrow",
            "3days",
            "week",
        ]

        for period in valid_periods:
            # New city for each subscription (unique_together constraint)
            city = CityFactory()
            sub = SubscriptionFactory(user=user, city=city, forecast_period=period)
            assert sub.forecast_period == period


class TestWeatherData:
    """Tests for WeatherData model."""

    def test_weather_data_str(self, db):
        """Test WeatherData __str__ method with new JSON structure."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory(forecast_period="current")
        count = len(weather_data.data)
        expected = (
            f"{weather_data.city.name} - {weather_data.forecast_period} ({count} items)"
        )
        assert str(weather_data) == expected

    def test_weather_data_str_hourly(self, db):
        """Test WeatherData __str__ for hourly forecast (48 items)."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory(forecast_period="hourly")
        assert "48 items" in str(weather_data)

    def test_weather_data_str_week(self, db):
        """Test WeatherData __str__ for week forecast (7 items)."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory(forecast_period="week")
        assert "7 items" in str(weather_data)

    def test_weather_data_forecast_period_choices(self, db):
        """Test that FORECAST_PERIOD_CHOICES contains expected values."""
        from app.models import WeatherData

        expected_choices = [
            ("current", "Current"),
            ("hourly", "Hourly"),
            ("today", "Today"),
            ("tomorrow", "Tomorrow"),
            ("3days", "3 Days"),
            ("week", "Week"),
        ]
        assert WeatherData.FORECAST_PERIOD_CHOICES == expected_choices

    def test_weather_data_all_forecast_periods_valid(self, db):
        """Test that all forecast periods can be saved to database."""
        from tests.factories import CityFactory, WeatherDataFactory

        city = CityFactory()
        valid_periods = [
            "current",
            "hourly",
            "today",
            "tomorrow",
            "3days",
            "week",
        ]

        for period in valid_periods:
            weather = WeatherDataFactory(city=city, forecast_period=period)
            assert weather.forecast_period == period

    def test_weather_data_json_structure(self, db):
        """Test that data field contains valid JSON array."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory(forecast_period="current")

        # Data should be a list
        assert isinstance(weather_data.data, list)
        assert len(weather_data.data) == 1

        # Check required fields in first item
        item = weather_data.data[0]
        required_fields = [
            "dt",
            "temp",
            "feels_like",
            "humidity",
            "pressure",
            "wind_speed",
            "wind_deg",
            "clouds",
            "visibility",
            "uvi",
            "pop",
            "description",
            "icon",
        ]
        for field in required_fields:
            assert field in item, f"Missing field: {field}"

    def test_weather_data_items_count_property(self, db):
        """Test items_count property."""
        from tests.factories import WeatherDataFactory

        # Current: 1 item
        weather_current = WeatherDataFactory(forecast_period="current")
        assert weather_current.items_count == 1

        # Hourly: 48 items
        weather_hourly = WeatherDataFactory(forecast_period="hourly")
        assert weather_hourly.items_count == 48

        # Week: 7 items
        weather_week = WeatherDataFactory(forecast_period="week")
        assert weather_week.items_count == 7

    def test_weather_data_first_item_property(self, db):
        """Test first_item property."""
        from tests.factories import WeatherDataFactory

        weather_data = WeatherDataFactory(forecast_period="current")
        first = weather_data.first_item

        assert first is not None
        assert "temp" in first
        assert "dt" in first

    def test_weather_data_first_item_empty_data(self, db):
        """Test first_item property with empty data."""
        from app.models import WeatherData
        from tests.factories import CityFactory

        city = CityFactory()
        weather_data = WeatherData.objects.create(
            city=city,
            forecast_period="current",
            data=[],
            fetched_at=timezone.now(),
        )

        assert weather_data.first_item is None
        assert weather_data.items_count == 0

    def test_weather_data_unique_together(self, db):
        """Test that (city, forecast_period) must be unique."""
        from app.models import WeatherData
        from tests.factories import CityFactory, WeatherDataFactory

        city = CityFactory()
        WeatherDataFactory(city=city, forecast_period="current")
        # Same city and forecast_period should raise IntegrityError
        # Create directly to avoid django_get_or_create in factory
        with pytest.raises(IntegrityError):
            WeatherData.objects.create(
                city=city,
                forecast_period="current",
                data=[{"temp": 20.5, "dt": 1234567890}],
                fetched_at=timezone.now(),
            )

    def test_weather_data_ordering(self, db):
        """Test that WeatherData is ordered by fetched_at descending."""
        from tests.factories import WeatherDataFactory

        # Create weather data with different fetched_at times
        two_hours_ago = timezone.now() - timezone.timedelta(hours=2)
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        WeatherDataFactory(fetched_at=two_hours_ago)
        WeatherDataFactory(fetched_at=one_hour_ago)

        # Query should return newest first
        all_data = list(WeatherData.objects.all())
        assert len(all_data) >= 2
        assert all_data[0].fetched_at > all_data[1].fetched_at


class TestNotificationLog:
    """Tests for NotificationLog model."""

    def test_notification_log_str(self, db):
        """Test NotificationLog __str__ method."""
        from tests.factories import NotificationLogFactory

        log = NotificationLogFactory()
        expected = f"{log.subscription} - {log.notification_type} - {log.status}"
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
