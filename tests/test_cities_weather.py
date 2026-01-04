"""
Tests for City and Weather API endpoints.

This module tests:
- City listing, detail, and search endpoints
- Weather data retrieval with different periods
- Weather history endpoint
- Error handling and edge cases
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from app.models import City
from tests.factories import CityFactory, WeatherDataFactory


class TestCityListView:
    """Tests for City list endpoint (GET /api/cities/)."""

    def test_city_list_success(self, api_client, db):
        """Test successful city listing."""
        # Create test cities
        CityFactory(name="Kyiv", country="UA")
        CityFactory(name="London", country="GB")
        CityFactory(name="Paris", country="FR")

        response = api_client.get("/api/cities/")

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data or len(response.data) > 0

        # Check if paginated or list
        if "results" in response.data:
            cities_data = response.data["results"]
        else:
            cities_data = response.data

        assert len(cities_data) >= 3
        city_names = [city["name"] for city in cities_data]
        assert "Kyiv" in city_names
        assert "London" in city_names
        assert "Paris" in city_names

    def test_city_list_empty(self, api_client, db):
        """Test city listing with no cities."""
        response = api_client.get("/api/cities/")

        assert response.status_code == status.HTTP_200_OK
        # Should return empty list or empty results
        if "results" in response.data:
            assert len(response.data["results"]) == 0
        else:
            assert len(response.data) == 0

    def test_city_list_ordering(self, api_client, db):
        """Test city listing is ordered by name."""
        CityFactory(name="Zebra", country="US")
        CityFactory(name="Alpha", country="US")
        CityFactory(name="Beta", country="US")

        response = api_client.get("/api/cities/")

        assert response.status_code == status.HTTP_200_OK

        if "results" in response.data:
            cities_data = response.data["results"]
        else:
            cities_data = response.data

        # Check ordering (should be alphabetical)
        city_names = [city["name"] for city in cities_data]
        # Find our test cities in the list
        alpha_idx = city_names.index("Alpha") if "Alpha" in city_names else -1
        beta_idx = city_names.index("Beta") if "Beta" in city_names else -1
        zebra_idx = city_names.index("Zebra") if "Zebra" in city_names else -1

        if alpha_idx >= 0 and beta_idx >= 0:
            assert alpha_idx < beta_idx
        if beta_idx >= 0 and zebra_idx >= 0:
            assert beta_idx < zebra_idx


class TestCityDetailView:
    """Tests for City detail endpoint (GET /api/cities/{id}/)."""

    def test_city_detail_success(self, api_client, db):
        """Test successful city detail retrieval."""
        city = CityFactory(name="Kyiv", country="UA")

        response = api_client.get(f"/api/cities/{city.id}/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == city.id
        assert response.data["name"] == "Kyiv"
        assert response.data["country"] == "UA"
        assert "latitude" in response.data
        assert "longitude" in response.data

    def test_city_detail_not_found(self, api_client, db):
        """Test city detail with invalid ID."""
        response = api_client.get("/api/cities/99999/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("app.views.WeatherService")
    def test_city_detail_with_weather(self, mock_weather_service, api_client, db):
        """Test city detail includes current weather from JSONField."""
        from django.utils import timezone
        from app.models import WeatherData

        # Mock WeatherService to not make real API calls
        mock_service_instance = mock_weather_service.return_value
        mock_service_instance.fetch_current_weather.return_value = [
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

        # Use unique city name to avoid conflicts with other tests
        city = CityFactory(name="TestCityWeather", country="TC")

        # Delete any existing weather data for this city (in case of test pollution)
        WeatherData.objects.filter(city=city).delete()

        # Create weather data directly (not via factory) to control exact values
        weather_data = WeatherData.objects.create(
            city=city,
            forecast_period="current",
            data=[
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
            ],
            fetched_at=timezone.now(),
        )

        # Verify data was saved correctly
        assert weather_data.data[0]["temp"] == 15.5

        response = api_client.get(f"/api/cities/{city.id}/")

        assert response.status_code == status.HTTP_200_OK
        assert "current_weather" in response.data
        # current_weather should exist since we created it in DB
        assert response.data["current_weather"] is not None
        # Check the response contains our data
        assert response.data["current_weather"]["temp"] == 15.5
        assert response.data["current_weather"]["humidity"] == 65

    @patch("app.services.weather_service.WeatherService.fetch_current_weather")
    def test_city_detail_weather_error_handling(
        self, mock_fetch_weather, api_client, db
    ):
        """Test city detail handles weather fetch errors gracefully."""
        city = CityFactory(name="Kyiv", country="UA")

        # Mock weather service to raise exception
        mock_fetch_weather.side_effect = Exception("Weather API error")

        response = api_client.get(f"/api/cities/{city.id}/")

        # Should still return city data even if weather fails
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == city.id
        # Weather might be None or missing
        assert "current_weather" in response.data


class TestCitySearchView:
    """Tests for City search endpoint (GET /api/cities/search/?q={query})."""

    def test_city_search_success_database_first(self, api_client, db):
        """Test city search finds cities in database first."""
        CityFactory(name="Kyiv", country="UA")
        CityFactory(name="Kyiv", country="US")

        response = api_client.get("/api/cities/search/?q=Kyiv")

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert response.data["count"] >= 2

        city_names = [city["name"] for city in response.data["results"]]
        assert "Kyiv" in city_names

    def test_city_search_empty_query(self, api_client):
        """Test city search with empty query."""
        response = api_client.get("/api/cities/search/?q=")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
        assert "required" in response.data["error"].lower()

    def test_city_search_missing_query(self, api_client):
        """Test city search without query parameter."""
        response = api_client.get("/api/cities/search/")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_city_search_api_fallback(self, mock_weather_search, api_client, db):
        """Test city search falls back to API when not in database.

        Note: City search does NOT create cities in DB by default.
        Cities are created only when user creates a subscription.
        """
        # Mock API response
        mock_weather_search.return_value = [
            {"name": "Tokyo", "country": "JP", "lat": 35.6762, "lon": 139.6503}
        ]

        response = api_client.get("/api/cities/search/?q=Tokyo")

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Tokyo"

        # City is NOT created in database (create_in_db=False by default)
        assert not City.objects.filter(name="Tokyo", country="JP").exists()

    def test_city_search_no_results(self, api_client, db):
        """Test city search with no results."""
        response = api_client.get("/api/cities/search/?q=NonexistentCity12345")

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert response.data["count"] == 0
        assert len(response.data["results"]) == 0


class TestWeatherView:
    """Tests for Weather endpoint (GET /api/weather/{city_id}/?period={period})."""

    @pytest.fixture
    def city(self, db):
        """Create a test city."""
        return CityFactory(name="Kyiv", country="UA")

    def test_weather_current_success(self, api_client, city):
        """Test successful current weather retrieval (unified format)."""
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

            response = api_client.get(f"/api/weather/{city.id}/?period=current")

            assert response.status_code == status.HTTP_200_OK
            # Unified response format
            assert response.data["city"]["id"] == city.id
            assert response.data["period"] == "current"
            assert "data" in response.data
            assert isinstance(response.data["data"], list)
            assert response.data["items_count"] == 1
            assert response.data["data"][0]["temp"] == 15.5
            assert response.data["data"][0]["humidity"] == 65

    def test_weather_default_period(self, api_client, city):
        """Test weather endpoint uses 'current' as default period."""
        with patch(
            "app.services.weather_service.WeatherService.fetch_current_weather"
        ) as mock_fetch:
            mock_fetch.return_value = [{"temp": 15.5, "humidity": 65}]

            response = api_client.get(f"/api/weather/{city.id}/")

            assert response.status_code == status.HTTP_200_OK
            assert response.data["period"] == "current"
            mock_fetch.assert_called_once()

    def test_weather_forecast_today(self, api_client, city):
        """Test weather forecast for today (unified format)."""
        with patch(
            "app.services.weather_service.WeatherService.fetch_forecast"
        ) as mock_fetch:
            # Service now returns list
            mock_fetch.return_value = [
                {
                    "dt": 1609459200,
                    "temp": 16.0,
                    "humidity": 70,
                    "description": "partly cloudy",
                }
            ]

            response = api_client.get(f"/api/weather/{city.id}/?period=today")

            assert response.status_code == status.HTTP_200_OK
            assert response.data["period"] == "today"
            assert "data" in response.data
            assert response.data["items_count"] == 1
            mock_fetch.assert_called_once_with(city, "today")

    def test_weather_forecast_hourly(self, api_client, city):
        """Test hourly weather forecast (unified format)."""
        with patch("app.views.WeatherService.fetch_forecast") as mock_fetch:
            mock_fetch.return_value = [
                {"dt": 1609459200, "temp": 15.0},
                {"dt": 1609470000, "temp": 16.0},
            ]

            response = api_client.get(f"/api/weather/{city.id}/?period=hourly")

            assert response.status_code == status.HTTP_200_OK
            # Unified response format (always dict with data array)
            assert response.data["city"]["id"] == city.id
            assert response.data["period"] == "hourly"
            assert "data" in response.data
            assert isinstance(response.data["data"], list)
            assert response.data["items_count"] == 2
            mock_fetch.assert_called_once_with(city, "hourly")

    def test_weather_invalid_city_id(self, api_client, db):
        """Test weather endpoint with invalid city ID."""
        response = api_client.get("/api/weather/99999/?period=current")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_weather_invalid_period(self, api_client, city):
        """Test weather endpoint with invalid period."""
        response = api_client.get(f"/api/weather/{city.id}/?period=invalid_period")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
        assert "Invalid period" in response.data["error"]

    def test_weather_api_error(self, api_client, city):
        """Test weather endpoint handles API errors."""
        with patch(
            "app.services.weather_service.WeatherService.fetch_current_weather"
        ) as mock_fetch:
            mock_fetch.side_effect = Exception("API Error")

            response = api_client.get(f"/api/weather/{city.id}/?period=current")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "error" in response.data
            assert "Failed to fetch weather" in response.data["error"]

    @patch("app.services.weather_service.redis.from_url")
    def test_weather_cache_hit(self, mock_redis_from_url, api_client, city):
        """Test weather endpoint uses cached data when available."""
        import json

        # Mock Redis with cached data (now list format)
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        cached_data = [{"temp": 15.5, "humidity": 65}]
        mock_redis.get.return_value = json.dumps(cached_data)

        # Reinitialize WeatherService with mock Redis
        with patch(
            "app.services.weather_service.WeatherService.__init__",
            lambda self: setattr(self, "redis_client", mock_redis),
        ):
            response = api_client.get(f"/api/weather/{city.id}/?period=current")

            # Should return cached data
            assert response.status_code == status.HTTP_200_OK


class TestWeatherHistoryView:
    """Tests for Weather history endpoint (GET /api/weather/{city_id}/history/)."""

    @pytest.fixture
    def city(self, db):
        """Create a test city with unique name for history tests."""
        return CityFactory(name="HistoryTestCity", country="HT")

    def test_weather_history_success(self, api_client, city):
        """Test successful weather history retrieval with JSONField."""
        from django.utils import timezone
        from app.models import WeatherData

        # Create historical weather data directly to avoid factory issues
        WeatherData.objects.create(
            city=city,
            forecast_period="current",
            data=[{"temp": 15.5, "humidity": 65}],
            fetched_at=timezone.now() - timezone.timedelta(hours=2),
        )
        WeatherData.objects.create(
            city=city,
            forecast_period="today",
            data=[{"temp": 16.0, "humidity": 70}],
            fetched_at=timezone.now() - timezone.timedelta(hours=1),
        )

        response = api_client.get(f"/api/weather/{city.id}/history/")

        assert response.status_code == status.HTTP_200_OK
        # Should return paginated results
        if "results" in response.data:
            assert len(response.data["results"]) >= 2
        else:
            assert len(response.data) >= 2

    def test_weather_history_empty(self, api_client, city):
        """Test weather history with no historical data."""
        response = api_client.get(f"/api/weather/{city.id}/history/")

        assert response.status_code == status.HTTP_200_OK
        if "results" in response.data:
            assert len(response.data["results"]) == 0
        else:
            assert len(response.data) == 0

    def test_weather_history_invalid_city_id(self, api_client, db):
        """Test weather history with invalid city ID."""
        response = api_client.get("/api/weather/99999/history/")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_weather_history_pagination(self, api_client, city):
        """Test weather history pagination with JSONField."""
        from django.utils import timezone
        from app.models import WeatherData

        # WeatherData has unique_together on (city, forecast_period)
        # So we can only have 7 unique records per city (one per period)
        # For pagination test, we use all available periods
        periods = ["current", "hourly", "today", "tomorrow", "3days", "week", "8days"]
        for i, period in enumerate(periods):
            WeatherData.objects.create(
                city=city,
                forecast_period=period,
                data=[{"temp": 15 + i}],
                fetched_at=timezone.now() - timezone.timedelta(minutes=i),
            )

        response = api_client.get(f"/api/weather/{city.id}/history/")

        assert response.status_code == status.HTTP_200_OK
        # Should return all 7 records
        if "results" in response.data:
            assert len(response.data["results"]) == 7
        else:
            assert len(response.data) == 7

    def test_weather_history_ordered_by_fetched_at(self, api_client, city):
        """Test weather history is ordered by fetched_at descending."""
        from django.utils import timezone
        from app.models import WeatherData

        # Create weather data with different fetched_at times and periods
        old_data = WeatherData.objects.create(
            city=city,
            forecast_period="today",
            data=[{"temp": 15.0}],
            fetched_at=timezone.now() - timezone.timedelta(days=2),
        )
        new_data = WeatherData.objects.create(
            city=city,
            forecast_period="current",
            data=[{"temp": 16.0}],
            fetched_at=timezone.now(),
        )

        response = api_client.get(f"/api/weather/{city.id}/history/")

        assert response.status_code == status.HTTP_200_OK

        if "results" in response.data:
            results = response.data["results"]
        else:
            results = response.data

        # First item should be the newest (ordered by -fetched_at)
        assert results[0]["id"] == new_data.id
        # Old data should be later in the list
        old_ids = [item["id"] for item in results]
        assert old_data.id in old_ids
