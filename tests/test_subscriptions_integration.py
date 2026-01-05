"""
Integration tests for Subscription API endpoints.

This module tests end-to-end workflows:
- Creating subscription → Fetching weather for subscribed city
- Updating subscription → Verifying weather data changes
- Subscription lifecycle (create → update → delete)
- Integration with City and Weather services
"""

from unittest.mock import patch

from rest_framework import status

from app.models import Subscription
from tests.factories import (
    CityFactory,
    SubscriptionFactory,
    UserFactory,
    WeatherDataFactory,
)


class TestSubscriptionWeatherIntegration:
    """Integration tests for subscription and weather data interaction."""

    def test_create_subscription_and_fetch_weather(self, api_client, db):
        """Test creating subscription and fetching weather for subscribed city."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Kyiv", country="UA")

        # Create subscription
        subscription_data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
        }
        create_response = api_client.post("/api/subscriptions/", subscription_data)

        assert create_response.status_code == status.HTTP_201_CREATED
        subscription_id = create_response.data["id"]

        # Fetch weather for the subscribed city (unified format)
        with patch(
            "app.services.weather_service.WeatherService.fetch_current_weather"
        ) as mock_fetch:
            # Service now returns list
            mock_fetch.return_value = [
                {
                    "dt": 1609459200,
                    "temp": 15.5,
                    "feels_like": 14.8,
                    "humidity": 65,
                    "pressure": 1013,
                    "wind_speed": 3.2,
                    "description": "clear sky",
                    "icon": "01d",
                }
            ]

            weather_response = api_client.get(f"/api/weather/{city.id}/?period=current")

            assert weather_response.status_code == status.HTTP_200_OK
            assert weather_response.data["city"]["id"] == city.id
            assert weather_response.data["data"][0]["temp"] == 15.5

        # Verify subscription exists and is linked to city
        subscription = Subscription.objects.get(id=subscription_id)
        assert subscription.city.id == city.id
        assert subscription.user.id == user.id

    def test_subscription_with_weather_data_in_db(self, api_client, db):
        """Test subscription with existing weather data in database (JSONField)."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="London", country="GB")

        # Create weather data in database with JSONField
        WeatherDataFactory(
            city=city,
            forecast_period="current",
            data=[{"temp": 18.5, "humidity": 70}],
        )

        # Create subscription
        subscription_data = {
            "city_id": city.id,
            "period": 3,
            "forecast_period": "current",
            "notification_type": "email",
        }
        create_response = api_client.post("/api/subscriptions/", subscription_data)

        assert create_response.status_code == status.HTTP_201_CREATED

        # Mock WeatherService to return data (unified format)
        with patch(
            "app.services.weather_service.WeatherService.fetch_current_weather"
        ) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "dt": 1609459200,
                    "temp": 18.5,
                    "feels_like": 17.8,
                    "humidity": 70,
                    "pressure": 1015,
                    "wind_speed": 4.0,
                    "description": "partly cloudy",
                    "icon": "02d",
                }
            ]

            weather_response = api_client.get(f"/api/weather/{city.id}/?period=current")

            assert weather_response.status_code == status.HTTP_200_OK
            assert weather_response.data["data"][0]["temp"] == 18.5
            assert weather_response.data["city"]["id"] == city.id

    def test_update_subscription_forecast_period(self, api_client, db):
        """Test updating subscription forecast_period and fetching corresponding weather."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Paris", country="FR")

        # Create subscription with 'current' forecast_period
        subscription_data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
        }
        create_response = api_client.post("/api/subscriptions/", subscription_data)
        subscription_id = create_response.data["id"]

        # Update subscription to 'today' forecast_period
        update_data = {"forecast_period": "today"}
        update_response = api_client.patch(
            f"/api/subscriptions/{subscription_id}/", update_data
        )

        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.data["forecast_period"] == "today"

        # Fetch weather for 'today' period (unified format)
        with patch(
            "app.services.weather_service.WeatherService.fetch_forecast"
        ) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "dt": 1609459200,
                    "temp": 20.0,
                    "feels_like": 19.5,
                    "humidity": 70,
                    "pressure": 1015,
                    "wind_speed": 4.0,
                    "description": "partly cloudy",
                    "icon": "02d",
                }
            ]

            weather_response = api_client.get(f"/api/weather/{city.id}/?period=today")

            assert weather_response.status_code == status.HTTP_200_OK
            assert weather_response.data["period"] == "today"

        # Verify subscription was updated
        subscription = Subscription.objects.get(id=subscription_id)
        assert subscription.forecast_period == "today"


class TestSubscriptionLifecycleIntegration:
    """Integration tests for complete subscription lifecycle."""

    def test_subscription_full_lifecycle(self, api_client, db):
        """Test complete subscription lifecycle: create → update → delete."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Tokyo", country="JP")

        # Step 1: Create subscription
        subscription_data = {
            "city_id": city.id,
            "period": 6,
            "forecast_period": "current",
            "notification_type": "both",
        }
        create_response = api_client.post("/api/subscriptions/", subscription_data)

        assert create_response.status_code == status.HTTP_201_CREATED
        subscription_id = create_response.data["id"]
        assert create_response.data["period"] == 6
        assert create_response.data["notification_type"] == "both"

        # Verify subscription exists
        assert Subscription.objects.filter(id=subscription_id).exists()

        # Step 2: List subscriptions (should include the new one)
        list_response = api_client.get("/api/subscriptions/")

        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data["count"] == 1
        assert list_response.data["results"][0]["id"] == subscription_id

        # Step 3: Get subscription details
        detail_response = api_client.get(f"/api/subscriptions/{subscription_id}/")

        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data["id"] == subscription_id
        assert detail_response.data["city"]["id"] == city.id

        # Step 4: Update subscription
        update_data = {
            "period": 12,
            "is_active": False,
        }
        update_response = api_client.patch(
            f"/api/subscriptions/{subscription_id}/", update_data
        )

        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.data["period"] == 12
        assert update_response.data["is_active"] is False

        # Verify update in database
        subscription = Subscription.objects.get(id=subscription_id)
        assert subscription.period == 12
        assert subscription.is_active is False

        # Step 5: Delete subscription
        delete_response = api_client.delete(f"/api/subscriptions/{subscription_id}/")

        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deletion
        assert not Subscription.objects.filter(id=subscription_id).exists()

        # Verify it's not in list anymore
        list_response_after = api_client.get("/api/subscriptions/")
        assert list_response_after.status_code == status.HTTP_200_OK
        assert list_response_after.data["count"] == 0

    def test_multiple_subscriptions_different_cities(self, api_client, db):
        """Test user can have multiple subscriptions for different cities."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city1 = CityFactory(name="New York", country="US")
        city2 = CityFactory(name="Los Angeles", country="US")
        city3 = CityFactory(name="Chicago", country="US")

        # Create subscriptions for different cities
        for city in [city1, city2, city3]:
            subscription_data = {
                "city_id": city.id,
                "period": 3,
                "forecast_period": "current",
                "notification_type": "email",
            }
            response = api_client.post("/api/subscriptions/", subscription_data)
            assert response.status_code == status.HTTP_201_CREATED

        # List all subscriptions
        list_response = api_client.get("/api/subscriptions/")

        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data["count"] == 3

        city_ids = [sub["city"]["id"] for sub in list_response.data["results"]]
        assert city1.id in city_ids
        assert city2.id in city_ids
        assert city3.id in city_ids

    def test_subscription_with_city_detail_integration(self, api_client, db):
        """Test subscription includes full city details via nested serializer."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Berlin", country="DE")

        # Create subscription
        subscription_data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
        }
        create_response = api_client.post("/api/subscriptions/", subscription_data)

        assert create_response.status_code == status.HTTP_201_CREATED

        # Verify city details are included in subscription response
        assert "city" in create_response.data
        city_data = create_response.data["city"]
        assert city_data["id"] == city.id
        assert city_data["name"] == city.name
        assert city_data["country"] == city.country
        assert "latitude" in city_data
        assert "longitude" in city_data

        # Get subscription detail and verify city info
        subscription_id = create_response.data["id"]
        detail_response = api_client.get(f"/api/subscriptions/{subscription_id}/")

        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data["city"]["name"] == "Berlin"
        assert detail_response.data["city"]["country"] == "DE"


class TestSubscriptionPermissionsIntegration:
    """Integration tests for subscription permissions across endpoints."""

    def test_user_cannot_access_other_user_subscriptions(self, api_client, db):
        """Test user cannot see or modify other user's subscriptions."""
        user1 = UserFactory()
        user2 = UserFactory()

        city = CityFactory()
        subscription = SubscriptionFactory(user=user2, city=city)

        # User1 tries to access User2's subscription
        api_client.force_authenticate(user=user1)

        # Try to get subscription detail
        detail_response = api_client.get(f"/api/subscriptions/{subscription.id}/")
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # Try to update subscription
        update_response = api_client.patch(
            f"/api/subscriptions/{subscription.id}/", {"period": 12}
        )
        assert update_response.status_code == status.HTTP_404_NOT_FOUND

        # Try to delete subscription
        delete_response = api_client.delete(f"/api/subscriptions/{subscription.id}/")
        assert delete_response.status_code == status.HTTP_404_NOT_FOUND

        # Verify subscription still exists (not deleted)
        assert Subscription.objects.filter(id=subscription.id).exists()

        # User1's subscription list should not include User2's subscription
        list_response = api_client.get("/api/subscriptions/")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data["count"] == 0

    def test_subscription_list_filters_by_user(self, api_client, db):
        """Test subscription list only shows current user's subscriptions."""
        user1 = UserFactory()
        user2 = UserFactory()

        city1 = CityFactory(name="City1")
        city2 = CityFactory(name="City2")
        city3 = CityFactory(name="City3")

        # User1 has 2 subscriptions
        SubscriptionFactory(user=user1, city=city1)
        SubscriptionFactory(user=user1, city=city2)

        # User2 has 1 subscription
        SubscriptionFactory(user=user2, city=city3)

        # User1 should only see their 2 subscriptions
        api_client.force_authenticate(user=user1)
        list_response = api_client.get("/api/subscriptions/")

        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data["count"] == 2
        user1_city_ids = [sub["city"]["id"] for sub in list_response.data["results"]]
        assert city1.id in user1_city_ids
        assert city2.id in user1_city_ids
        assert city3.id not in user1_city_ids

        # User2 should only see their 1 subscription
        api_client.force_authenticate(user=user2)
        list_response = api_client.get("/api/subscriptions/")

        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data["count"] == 1
        assert list_response.data["results"][0]["city"]["id"] == city3.id
