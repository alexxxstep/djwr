"""
Tests for Subscription API endpoints.

This module tests:
- Subscription listing, creation, detail, update, and deletion
- Validation of subscription fields
- Permission checks (user can only access own subscriptions)
- Unique constraint (user cannot subscribe to same city twice)
"""

from rest_framework import status

from app.models import Subscription
from tests.factories import CityFactory, SubscriptionFactory, UserFactory


class TestSubscriptionListCreateView:
    """Tests for Subscription list and create endpoint (GET/POST /api/subscriptions/)."""

    def test_list_subscriptions_success(self, api_client, db):
        """Test listing user's subscriptions."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city1 = CityFactory(name="Kyiv", country="UA")
        city2 = CityFactory(name="London", country="GB")

        # Create subscriptions for the user
        SubscriptionFactory(user=user, city=city1, period=1)
        SubscriptionFactory(user=user, city=city2, period=3)

        # Create subscription for another user (should not appear)
        other_user = UserFactory()
        other_city = CityFactory(name="Paris", country="FR")
        SubscriptionFactory(user=other_user, city=other_city)

        response = api_client.get("/api/subscriptions/")

        assert response.status_code == status.HTTP_200_OK
        # DRF pagination returns {'count', 'next', 'previous', 'results'}
        assert response.data["count"] == 2
        assert len(response.data["results"]) == 2
        assert all(sub["user"] == user.id for sub in response.data["results"])

    def test_list_subscriptions_empty(self, api_client, db):
        """Test listing subscriptions when user has none."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        response = api_client.get("/api/subscriptions/")

        assert response.status_code == status.HTTP_200_OK
        # DRF pagination returns {'count', 'next', 'previous', 'results'}
        assert response.data["count"] == 0
        assert response.data["results"] == []

    def test_list_subscriptions_unauthenticated(self, api_client, db):
        """Test listing subscriptions without authentication."""
        response = api_client.get("/api/subscriptions/")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_subscription_success(self, api_client, db):
        """Test creating a new subscription."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Kyiv", country="UA")

        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
            "is_active": True,
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["city"]["id"] == city.id
        assert response.data["period"] == 1
        assert response.data["forecast_period"] == "current"
        assert response.data["notification_type"] == "email"
        assert response.data["user"] == user.id

        # Verify subscription was created in database
        assert Subscription.objects.filter(user=user, city=city).exists()

    def test_create_subscription_duplicate(self, api_client, db):
        """Test creating duplicate subscription (same user + city)."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Kyiv", country="UA")
        SubscriptionFactory(user=user, city=city)

        data = {
            "city_id": city.id,
            "period": 3,
            "forecast_period": "today",
            "notification_type": "webhook",
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already subscribed" in str(response.data["city_id"][0]).lower()

    def test_create_subscription_invalid_city(self, api_client, db):
        """Test creating subscription with invalid city ID."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        data = {
            "city_id": 99999,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "not found" in str(response.data["city_id"][0]).lower()

    def test_create_subscription_invalid_period(self, api_client, db):
        """Test creating subscription with invalid period."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()

        data = {
            "city_id": city.id,
            "period": 5,  # Invalid: must be 1, 3, 6, or 12
            "forecast_period": "current",
            "notification_type": "email",
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "period" in response.data

    def test_create_subscription_invalid_forecast_period(self, api_client, db):
        """Test creating subscription with invalid forecast_period."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()

        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "invalid",  # Invalid
            "notification_type": "email",
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "forecast_period" in response.data

    def test_create_subscription_invalid_notification_type(self, api_client, db):
        """Test creating subscription with invalid notification_type."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()

        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "invalid",  # Invalid
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "notification_type" in response.data

    def test_create_subscription_unauthenticated(self, api_client, db):
        """Test creating subscription without authentication."""
        city = CityFactory()

        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "email",
        }

        response = api_client.post("/api/subscriptions/", data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestSubscriptionDetailUpdateDeleteView:
    """Tests for Subscription detail, update, delete endpoint (GET/PATCH/DELETE /api/subscriptions/{id}/)."""

    def test_subscription_detail_success(self, api_client, db):
        """Test retrieving subscription details."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory(name="Kyiv", country="UA")
        subscription = SubscriptionFactory(
            user=user, city=city, period=1, forecast_period="current"
        )

        response = api_client.get(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == subscription.id
        assert response.data["city"]["id"] == city.id
        assert response.data["period"] == 1

    def test_subscription_detail_not_found(self, api_client, db):
        """Test retrieving non-existent subscription."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        response = api_client.get("/api/subscriptions/99999/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_subscription_detail_other_user(self, api_client, db):
        """Test retrieving another user's subscription (should fail)."""
        user1 = UserFactory()
        user2 = UserFactory()
        api_client.force_authenticate(user=user1)

        city = CityFactory()
        subscription = SubscriptionFactory(user=user2, city=city)

        response = api_client.get(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_subscription_detail_unauthenticated(self, api_client, db):
        """Test retrieving subscription without authentication."""
        user = UserFactory()
        city = CityFactory()
        subscription = SubscriptionFactory(user=user, city=city)

        response = api_client.get(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_subscription_update_success(self, api_client, db):
        """Test updating subscription."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()
        subscription = SubscriptionFactory(
            user=user, city=city, period=1, forecast_period="current"
        )

        data = {
            "period": 3,
            "forecast_period": "today",
            "notification_type": "both",
            "is_active": False,
        }

        response = api_client.patch(f"/api/subscriptions/{subscription.id}/", data)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["period"] == 3
        assert response.data["forecast_period"] == "today"
        assert response.data["notification_type"] == "both"
        assert response.data["is_active"] is False

        # Verify changes in database
        subscription.refresh_from_db()
        assert subscription.period == 3
        assert subscription.forecast_period == "today"
        assert subscription.notification_type == "both"
        assert subscription.is_active is False

    def test_subscription_update_partial(self, api_client, db):
        """Test partial update of subscription."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()
        subscription = SubscriptionFactory(
            user=user, city=city, period=1, is_active=True
        )

        data = {"period": 6}  # Only update period

        response = api_client.patch(f"/api/subscriptions/{subscription.id}/", data)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["period"] == 6
        assert response.data["is_active"] is True  # Should remain unchanged

    def test_subscription_update_other_user(self, api_client, db):
        """Test updating another user's subscription (should fail)."""
        user1 = UserFactory()
        user2 = UserFactory()
        api_client.force_authenticate(user=user1)

        city = CityFactory()
        subscription = SubscriptionFactory(user=user2, city=city)

        data = {"period": 3}

        response = api_client.patch(f"/api/subscriptions/{subscription.id}/", data)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_subscription_update_invalid_period(self, api_client, db):
        """Test updating subscription with invalid period."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()
        subscription = SubscriptionFactory(user=user, city=city)

        data = {"period": 5}  # Invalid

        response = api_client.patch(f"/api/subscriptions/{subscription.id}/", data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "period" in response.data

    def test_subscription_delete_success(self, api_client, db):
        """Test deleting subscription."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()
        subscription = SubscriptionFactory(user=user, city=city)

        subscription_id = subscription.id

        response = api_client.delete(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify subscription was deleted
        assert not Subscription.objects.filter(id=subscription_id).exists()

    def test_subscription_delete_other_user(self, api_client, db):
        """Test deleting another user's subscription (should fail)."""
        user1 = UserFactory()
        user2 = UserFactory()
        api_client.force_authenticate(user=user1)

        city = CityFactory()
        subscription = SubscriptionFactory(user=user2, city=city)

        response = api_client.delete(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Verify subscription still exists
        assert Subscription.objects.filter(id=subscription.id).exists()

    def test_subscription_delete_unauthenticated(self, api_client, db):
        """Test deleting subscription without authentication."""
        user = UserFactory()
        city = CityFactory()
        subscription = SubscriptionFactory(user=user, city=city)

        response = api_client.delete(f"/api/subscriptions/{subscription.id}/")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestSubscriptionValidation:
    """Tests for subscription field validation."""

    def test_period_choices_validation(self, api_client, db):
        """Test period must be one of: 1, 3, 6, 12."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        # Create separate cities for each period to avoid unique_together constraint
        # (user can only have one subscription per city)
        valid_periods = [1, 3, 6, 12]
        cities = [CityFactory() for _ in valid_periods]

        for period, city in zip(valid_periods, cities, strict=True):
            data = {
                "city_id": city.id,
                "period": period,
                "forecast_period": "current",
                "notification_type": "email",
            }
            response = api_client.post("/api/subscriptions/", data)
            assert response.status_code == status.HTTP_201_CREATED

        # Test invalid period (use a new city to avoid unique constraint)
        invalid_city = CityFactory()
        data = {
            "city_id": invalid_city.id,
            "period": 2,  # Invalid
            "forecast_period": "current",
            "notification_type": "email",
        }
        response = api_client.post("/api/subscriptions/", data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_forecast_period_choices_validation(self, api_client, db):
        """Test forecast_period must be one of valid choices."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()

        valid_periods = ["current", "today", "tomorrow", "3days", "week"]
        for forecast_period in valid_periods:
            data = {
                "city_id": city.id,
                "period": 1,
                "forecast_period": forecast_period,
                "notification_type": "email",
            }
            response = api_client.post("/api/subscriptions/", data)
            assert response.status_code == status.HTTP_201_CREATED
            # Delete to avoid duplicate constraint
            Subscription.objects.filter(user=user, city=city).delete()

        # Test invalid forecast_period
        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "invalid",
            "notification_type": "email",
        }
        response = api_client.post("/api/subscriptions/", data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_notification_type_choices_validation(self, api_client, db):
        """Test notification_type must be one of: email, webhook, both."""
        user = UserFactory()
        api_client.force_authenticate(user=user)

        city = CityFactory()

        valid_types = ["email", "webhook", "both"]
        for notification_type in valid_types:
            data = {
                "city_id": city.id,
                "period": 1,
                "forecast_period": "current",
                "notification_type": notification_type,
            }
            response = api_client.post("/api/subscriptions/", data)
            assert response.status_code == status.HTTP_201_CREATED
            # Delete to avoid duplicate constraint
            Subscription.objects.filter(user=user, city=city).delete()

        # Test invalid notification_type
        data = {
            "city_id": city.id,
            "period": 1,
            "forecast_period": "current",
            "notification_type": "invalid",
        }
        response = api_client.post("/api/subscriptions/", data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
