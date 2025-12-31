"""
Django management command to create fake data for testing.
"""

from decimal import Decimal
import random

from django.core.management.base import BaseCommand
from django.utils import timezone

from app.models import City, NotificationLog, Subscription, User, WeatherData


class Command(BaseCommand):
    """Command to create fake data for testing."""

    help = "Create fake data for testing (users, cities, subscriptions, weather data, logs)"

    def add_arguments(self, parser):
        """Add command arguments."""
        parser.add_argument(
            "--users",
            type=int,
            default=10,
            help="Number of users to create (default: 10)",
        )
        parser.add_argument(
            "--cities",
            type=int,
            default=20,
            help="Number of cities to create (default: 20)",
        )
        parser.add_argument(
            "--subscriptions",
            type=int,
            default=30,
            help="Number of subscriptions to create (default: 30)",
        )
        parser.add_argument(
            "--weather-data",
            type=int,
            default=50,
            help="Number of weather data entries to create (default: 50)",
        )
        parser.add_argument(
            "--logs",
            type=int,
            default=40,
            help="Number of notification logs to create (default: 40)",
        )

    def handle(self, *args, **options):
        """Execute the command."""
        num_users = options["users"]
        num_cities = options["cities"]
        num_subscriptions = options["subscriptions"]
        num_weather_data = options["weather_data"]
        num_logs = options["logs"]

        self.stdout.write(self.style.SUCCESS("Creating fake data..."))

        # Create users
        self.stdout.write(f"Creating {num_users} users...")
        users = self._create_users(num_users)
        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {len(users)} users")
        )

        # Create cities
        self.stdout.write(f"Creating {num_cities} cities...")
        cities = self._create_cities(num_cities)
        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {len(cities)} cities")
        )

        # Create subscriptions
        self.stdout.write(f"Creating {num_subscriptions} subscriptions...")
        subscriptions = self._create_subscriptions(
            users, cities, num_subscriptions
        )
        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {len(subscriptions)} subscriptions")
        )

        # Create weather data
        self.stdout.write(f"Creating {num_weather_data} weather data entries...")
        weather_data_list = self._create_weather_data(
            cities, num_weather_data
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {len(weather_data_list)} weather data entries"
            )
        )

        # Create notification logs
        self.stdout.write(f"Creating {num_logs} notification logs...")
        logs = self._create_notification_logs(
            subscriptions, weather_data_list, num_logs
        )
        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {len(logs)} notification logs")
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\n✓ Fake data created successfully!\n"
                f"  - Users: {len(users)}\n"
                f"  - Cities: {len(cities)}\n"
                f"  - Subscriptions: {len(subscriptions)}\n"
                f"  - Weather Data: {len(weather_data_list)}\n"
                f"  - Notification Logs: {len(logs)}\n"
            )
        )

    def _create_users(self, count):
        """Create fake users."""
        users = []
        for i in range(count):
            email = f"user{i+1}@example.com"
            username = f"user{i+1}"
            user = User.objects.create_user(
                email=email,
                username=username,
                password="testpass123",
                first_name=random.choice(
                    ["John", "Jane", "Bob", "Alice", "Charlie", "Diana"]
                ),
                last_name=random.choice(
                    ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"]
                ),
                is_email_verified=random.choice([True, False]),
                is_active=True,
            )
            users.append(user)
        return users

    def _create_cities(self, count):
        """Create fake cities."""
        cities_data = [
            ("Kyiv", "UA", 50.4501, 30.5234),
            ("Lviv", "UA", 49.8397, 24.0297),
            ("Odesa", "UA", 46.4825, 30.7233),
            ("Kharkiv", "UA", 49.9935, 36.2304),
            ("Warsaw", "PL", 52.2297, 21.0122),
            ("Krakow", "PL", 50.0647, 19.9450),
            ("Berlin", "DE", 52.5200, 13.4050),
            ("Munich", "DE", 48.1351, 11.5820),
            ("Paris", "FR", 48.8566, 2.3522),
            ("London", "GB", 51.5074, -0.1278),
            ("New York", "US", 40.7128, -74.0060),
            ("Los Angeles", "US", 34.0522, -118.2437),
            ("Tokyo", "JP", 35.6762, 139.6503),
            ("Sydney", "AU", -33.8688, 151.2093),
            ("Toronto", "CA", 43.6532, -79.3832),
            ("Barcelona", "ES", 41.3851, 2.1734),
            ("Rome", "IT", 41.9028, 12.4964),
            ("Amsterdam", "NL", 52.3676, 4.9041),
            ("Vienna", "AT", 48.2082, 16.3738),
            ("Prague", "CZ", 50.0755, 14.4378),
        ]

        cities = []
        for i, (name, country, lat, lon) in enumerate(cities_data[:count]):
            city, created = City.objects.get_or_create(
                name=name,
                country=country,
                defaults={
                    "latitude": Decimal(str(lat)),
                    "longitude": Decimal(str(lon)),
                },
            )
            cities.append(city)
        return cities

    def _create_subscriptions(self, users, cities, count):
        """Create fake subscriptions."""
        subscriptions = []
        periods = [1, 3, 6, 12]
        forecast_periods = ["current", "1h", "3h", "6h", "12h", "24h"]
        notification_types = ["email", "webhook"]

        for _ in range(count):
            user = random.choice(users)
            city = random.choice(cities)

            # Check if subscription already exists
            subscription, created = Subscription.objects.get_or_create(
                user=user,
                city=city,
                defaults={
                    "period": random.choice(periods),
                    "forecast_period": random.choice(forecast_periods),
                    "notification_type": random.choice(notification_types),
                    "is_active": random.choice([True, False]),
                    "last_notified_at": (
                        timezone.now() - timezone.timedelta(hours=random.randint(0, 24))
                        if random.choice([True, False])
                        else None
                    ),
                },
            )
            if created:
                subscriptions.append(subscription)
        return subscriptions

    def _create_weather_data(self, cities, count):
        """Create fake weather data."""
        weather_data_list = []
        forecast_periods = ["current", "1h", "3h", "6h", "12h", "24h"]
        descriptions = [
            "Clear sky",
            "Few clouds",
            "Scattered clouds",
            "Broken clouds",
            "Shower rain",
            "Rain",
            "Thunderstorm",
            "Snow",
            "Mist",
        ]
        icons = ["01d", "02d", "03d", "04d", "09d", "10d", "11d", "13d", "50d"]

        for _ in range(count):
            city = random.choice(cities)
            forecast_period = random.choice(forecast_periods)

            # Check if weather data already exists
            weather_data, created = WeatherData.objects.get_or_create(
                city=city,
                forecast_period=forecast_period,
                defaults={
                    "temperature": Decimal(
                        str(round(random.uniform(-30, 40), 2))
                    ),
                    "feels_like": Decimal(
                        str(round(random.uniform(-30, 40), 2))
                    ),
                    "humidity": random.randint(0, 100),
                    "pressure": random.randint(950, 1050),
                    "wind_speed": Decimal(
                        str(round(random.uniform(0, 30), 2))
                    ),
                    "wind_deg": random.randint(0, 360),
                    "visibility": random.randint(1000, 10000),
                    "clouds": random.randint(0, 100),
                    "description": random.choice(descriptions),
                    "icon": random.choice(icons),
                    "fetched_at": timezone.now()
                    - timezone.timedelta(hours=random.randint(0, 24)),
                },
            )
            if created:
                weather_data_list.append(weather_data)
        return weather_data_list

    def _create_notification_logs(
        self, subscriptions, weather_data_list, count
    ):
        """Create fake notification logs."""
        logs = []
        notification_types = ["email", "webhook"]
        statuses = ["pending", "sent", "failed"]
        error_messages = [
            "",
            "Connection timeout",
            "Invalid email address",
            "Webhook URL not reachable",
            "Rate limit exceeded",
        ]

        for _ in range(count):
            subscription = random.choice(subscriptions)
            weather_data = (
                random.choice(weather_data_list)
                if weather_data_list
                else None
            )
            notification_type = random.choice(notification_types)
            status = random.choice(statuses)

            log = NotificationLog.objects.create(
                subscription=subscription,
                weather_data=weather_data,
                notification_type=notification_type,
                status=status,
                error_message=(
                    random.choice(error_messages)
                    if status == "failed"
                    else ""
                ),
                sent_at=(
                    timezone.now()
                    - timezone.timedelta(hours=random.randint(0, 48))
                    if status == "sent"
                    else None
                ),
            )
            logs.append(log)
        return logs

