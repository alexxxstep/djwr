"""
Factory Boy factories for creating test data.
"""

import random
from decimal import Decimal

import factory
from django.utils import timezone
from faker import Faker

from app.models import City, NotificationLog, Subscription, User, WeatherData

fake = Faker()


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for User model."""

    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    username = factory.Sequence(lambda n: f"user{n}")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_email_verified = True
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        """Set password after user creation."""
        if not create:
            return
        password = extracted or "testpass123"
        self.set_password(password)
        self.save()


class CityFactory(factory.django.DjangoModelFactory):
    """Factory for City model."""

    class Meta:
        model = City

    name = factory.Faker("city")
    country = factory.Faker("country_code")
    latitude = factory.LazyAttribute(lambda obj: Decimal(str(fake.latitude())))
    longitude = factory.LazyAttribute(lambda obj: Decimal(str(fake.longitude())))


class SubscriptionFactory(factory.django.DjangoModelFactory):
    """Factory for Subscription model."""

    class Meta:
        model = Subscription

    user = factory.SubFactory(UserFactory)
    city = factory.SubFactory(CityFactory)
    period = 3  # 3 hours
    forecast_period = "current"
    notification_type = "email"
    is_active = True


class WeatherDataFactory(factory.django.DjangoModelFactory):
    """Factory for WeatherData model.

    Note: WeatherData has unique_together constraint on (city, forecast_period).
    When using this factory multiple times for the same city, use different
    forecast_period values or use update_or_create pattern.
    """

    class Meta:
        model = WeatherData

    city = factory.SubFactory(CityFactory)
    forecast_period = "current"
    data = factory.LazyAttribute(
        lambda obj: _generate_weather_data(obj.forecast_period)
    )
    fetched_at = factory.LazyFunction(
        lambda: timezone.make_aware(fake.date_time_this_month())
    )


def _generate_weather_data(forecast_period: str) -> list[dict]:
    """Generate weather data array based on forecast period."""
    import time

    def _generate_item(timestamp: int) -> dict:
        """Generate single weather data item."""
        return {
            "dt": timestamp,
            "temp": round(random.uniform(-30, 40), 2),
            "feels_like": round(random.uniform(-30, 40), 2),
            "humidity": random.randint(0, 100),
            "pressure": random.randint(950, 1050),
            "wind_speed": round(random.uniform(0, 30), 2),
            "wind_deg": random.randint(0, 360),
            "clouds": random.randint(0, 100),
            "visibility": random.randint(1000, 10000),
            "uvi": round(random.uniform(0, 11), 2),
            "pop": round(random.uniform(0, 1), 2),
            "rain": round(random.uniform(0, 10), 2) if random.random() > 0.7 else None,
            "snow": round(random.uniform(0, 10), 2) if random.random() > 0.9 else None,
            "description": fake.sentence(nb_words=3),
            "icon": random.choice(
                ["01d", "02d", "03d", "04d", "09d", "10d", "11d", "13d", "50d"]
            ),
        }

    base_timestamp = int(time.time())
    hour = 3600
    day = 86400

    # Determine number of items based on period
    period_items = {
        "current": 1,
        "hourly": 48,
        "today": 1,
        "tomorrow": 1,
        "3days": 3,
        "week": 7,
    }

    count = period_items.get(forecast_period, 1)

    # Generate items with appropriate timestamps
    if forecast_period == "hourly":
        return [_generate_item(base_timestamp + i * hour) for i in range(count)]
    else:
        return [_generate_item(base_timestamp + i * day) for i in range(count)]


class NotificationLogFactory(factory.django.DjangoModelFactory):
    """Factory for NotificationLog model."""

    class Meta:
        model = NotificationLog

    subscription = factory.SubFactory(SubscriptionFactory)
    weather_data = factory.SubFactory(WeatherDataFactory)
    notification_type = "email"
    status = "sent"
    sent_at = factory.LazyFunction(
        lambda: timezone.make_aware(fake.date_time_this_month())
    )
