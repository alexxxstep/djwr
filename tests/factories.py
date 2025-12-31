"""
Factory Boy factories for creating test data.
"""

from decimal import Decimal
import random

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
    """Factory for WeatherData model."""

    class Meta:
        model = WeatherData
        django_get_or_create = ("city", "forecast_period")

    city = factory.SubFactory(CityFactory)
    forecast_period = "current"
    temperature = factory.LazyAttribute(
        lambda obj: Decimal(str(round(random.uniform(-30, 40), 2)))
    )
    feels_like = factory.LazyAttribute(
        lambda obj: Decimal(str(round(random.uniform(-30, 40), 2)))
    )
    humidity = factory.Faker("random_int", min=0, max=100)
    pressure = factory.Faker("random_int", min=950, max=1050)
    wind_speed = factory.LazyAttribute(
        lambda obj: Decimal(str(round(random.uniform(0, 30), 2)))
    )
    wind_deg = factory.Faker("random_int", min=0, max=360)
    visibility = factory.Faker("random_int", min=1000, max=10000)
    clouds = factory.Faker("random_int", min=0, max=100)
    description = factory.Faker("sentence", nb_words=3)
    icon = factory.Faker("word")
    fetched_at = factory.LazyFunction(
        lambda: timezone.make_aware(fake.date_time_this_month())
    )


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
