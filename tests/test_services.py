"""
Tests for WeatherService and CityService.

This module tests:
- WeatherService: caching, API calls, parsing, error handling
- CityService: database-first search, API fallback, city creation
"""

import json
from decimal import Decimal
from unittest.mock import MagicMock, Mock, patch

import pytest
import requests
from freezegun import freeze_time

from app.models import City, WeatherData
from app.services.city_service import CityService
from app.services.weather_service import WeatherService
from tests.factories import CityFactory


class TestWeatherService:
    """Tests for WeatherService."""

    @pytest.fixture
    def weather_service(self):
        """Create WeatherService instance."""
        return WeatherService()

    @pytest.fixture
    def city(self, db):
        """Create a test city."""
        return CityFactory(
            name="Kyiv",
            country="UA",
            latitude=Decimal("50.4501"),
            longitude=Decimal("30.5234"),
        )

    @pytest.fixture
    def mock_redis_client(self):
        """Create a mock Redis client."""
        return MagicMock()

    @pytest.fixture
    def mock_api_response_current(self):
        """Mock OpenWeatherMap One Call API 3.0 current weather response."""
        return {
            "lat": 50.4501,
            "lon": 30.5234,
            "timezone": "Europe/Kiev",
            "timezone_offset": 7200,
            "current": {
                "dt": 1609459200,
                "sunrise": 1609434000,
                "sunset": 1609466400,
                "temp": 15.5,
                "feels_like": 14.8,
                "pressure": 1013,
                "humidity": 65,
                "dew_point": 8.5,
                "uvi": 0.5,
                "clouds": 0,
                "visibility": 10000,
                "wind_speed": 3.2,
                "wind_deg": 180,
                "weather": [
                    {
                        "id": 800,
                        "main": "Clear",
                        "description": "clear sky",
                        "icon": "01d",
                    }
                ],
            },
        }

    @pytest.fixture
    def mock_api_response_forecast(self):
        """Mock OpenWeatherMap One Call API 3.0 forecast response."""
        base_time = 1609459200  # 2021-01-01 00:00:00 UTC

        # Hourly forecast (48 hours)
        hourly_list = []
        for i in range(48):
            hourly_list.append(
                {
                    "dt": base_time + (i * 3600),  # Every hour
                    "temp": 15.0 + (i % 10),
                    "feels_like": 14.0 + (i % 10),
                    "pressure": 1013,
                    "humidity": 65,
                    "dew_point": 8.5,
                    "uvi": 0.5,
                    "clouds": 0,
                    "visibility": 10000,
                    "wind_speed": 3.2,
                    "wind_deg": 180,
                    "pop": 0.1,
                    "weather": [
                        {
                            "id": 800,
                            "main": "Clear",
                            "description": "clear sky",
                            "icon": "01d",
                        }
                    ],
                }
            )

        # Daily forecast (8 days)
        daily_list = []
        for i in range(8):
            daily_list.append(
                {
                    "dt": base_time + (i * 86400),  # Every day
                    "sunrise": base_time + (i * 86400) + 25200,
                    "sunset": base_time + (i * 86400) + 57600,
                    "temp": {
                        "day": 15.0 + i,
                        "min": 10.0 + i,
                        "max": 20.0 + i,
                        "night": 12.0 + i,
                        "eve": 14.0 + i,
                        "morn": 11.0 + i,
                    },
                    "feels_like": {
                        "day": 14.0 + i,
                        "night": 11.0 + i,
                        "eve": 13.0 + i,
                        "morn": 10.0 + i,
                    },
                    "pressure": 1013,
                    "humidity": 65,
                    "dew_point": 8.5,
                    "wind_speed": 3.2,
                    "wind_deg": 180,
                    "clouds": 0,
                    "pop": 0.1,
                    "uvi": 0.5,
                    "weather": [
                        {
                            "id": 800,
                            "main": "Clear",
                            "description": "clear sky",
                            "icon": "01d",
                        }
                    ],
                }
            )

        return {
            "lat": 50.4501,
            "lon": 30.5234,
            "timezone": "Europe/Kiev",
            "timezone_offset": 7200,
            "hourly": hourly_list,
            "daily": daily_list,
        }

    @pytest.fixture
    def mock_api_response_geocoding(self):
        """Mock OpenWeatherMap Geocoding API response."""
        return [
            {
                "name": "Kyiv",
                "local_names": {"uk": "Київ"},
                "lat": 50.4501,
                "lon": 30.5234,
                "country": "UA",
                "state": "Kyiv",
            },
            {
                "name": "Kiev",
                "lat": 50.4501,
                "lon": 30.5234,
                "country": "US",
                "state": "Texas",
            },
        ]

    # Cache Tests
    def test_get_cache_key(self, weather_service):
        """Test cache key generation."""
        key = weather_service._get_cache_key(city_id=1, period="current")
        assert key == "weather:1:current"

        key = weather_service._get_cache_key(city_id=42, period="today")
        assert key == "weather:42:today"

    def test_get_cache_ttl(self, weather_service):
        """Test TTL calculation for different periods."""
        assert weather_service._get_cache_ttl("current") == 600  # 10 min
        assert weather_service._get_cache_ttl("hourly") == 900  # 15 min
        assert weather_service._get_cache_ttl("today") == 1800  # 30 min
        assert weather_service._get_cache_ttl("tomorrow") == 1800  # 30 min
        assert weather_service._get_cache_ttl("3days") == 3600  # 60 min
        assert weather_service._get_cache_ttl("week") == 3600  # 60 min
        assert weather_service._get_cache_ttl("invalid") == 600  # default

    @patch("app.services.weather_service.redis.from_url")
    def test_get_from_cache_hit(self, mock_redis_from_url):
        """Test cache hit scenario."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        cached_data = {"temperature": 15.5, "humidity": 65}
        mock_redis.get.return_value = json.dumps(cached_data)

        weather_service = WeatherService()  # Initialize with mock Redis
        result = weather_service._get_from_cache("weather:1:current")

        assert result == cached_data
        mock_redis.get.assert_called_once_with("weather:1:current")

    @patch("app.services.weather_service.redis.from_url")
    def test_get_from_cache_miss(self, mock_redis_from_url):
        """Test cache miss scenario."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        mock_redis.get.return_value = None

        weather_service = WeatherService()  # Initialize with mock Redis
        result = weather_service._get_from_cache("weather:1:current")

        assert result is None
        mock_redis.get.assert_called_once_with("weather:1:current")

    @patch("app.services.weather_service.redis.from_url")
    def test_save_to_cache(self, mock_redis_from_url):
        """Test saving data to cache."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        data = {"temperature": 15.5, "humidity": 65}
        weather_service = WeatherService()  # Initialize with mock Redis
        weather_service._save_to_cache("weather:1:current", data, ttl=600)

        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "weather:1:current"
        assert call_args[0][1] == 600
        assert json.loads(call_args[0][2]) == data

    # API Call Tests
    @patch("app.services.weather_service.requests.get")
    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_current_weather_cache_hit(
        self,
        mock_redis_from_url,
        mock_requests_get,
        city,
        mock_api_response_current,
    ):
        """Test fetch_current_weather returns cached data (list format) with timezone."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        # Cached data is now a list
        cached_data = [{"temp": 15.5, "humidity": 65, "description": "clear sky"}]
        mock_redis.get.return_value = json.dumps(cached_data)

        # Mock the API call for timezone_offset
        mock_response = Mock()
        mock_response.json.return_value = {"timezone_offset": 7200}
        mock_response.raise_for_status = Mock()
        mock_requests_get.return_value = mock_response

        weather_service = WeatherService()  # Initialize with mock Redis
        result, timezone_offset = weather_service.fetch_current_weather(city)

        assert result == cached_data
        assert isinstance(result, list)
        assert timezone_offset == 7200

    @patch("app.services.weather_service.requests.get")
    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_current_weather_cache_miss(
        self,
        mock_redis_from_url,
        mock_requests_get,
        city,
        mock_api_response_current,
    ):
        """Test fetch_current_weather fetches from API on cache miss."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        mock_redis.get.return_value = None  # Cache miss

        mock_response = Mock()
        mock_response.json.return_value = mock_api_response_current
        mock_response.raise_for_status = Mock()
        mock_requests_get.return_value = mock_response

        weather_service = WeatherService()  # Initialize with mock Redis
        result, timezone_offset = weather_service.fetch_current_weather(city)

        # Result is now a list, timezone_offset is returned separately
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["temp"] == 15.5
        assert result[0]["humidity"] == 65
        assert result[0]["description"] == "clear sky"
        assert result[0]["icon"] == "01d"
        assert timezone_offset == 7200  # From mock_api_response_current

        # Verify API was called
        mock_requests_get.assert_called_once()
        # Verify cache was saved
        mock_redis.setex.assert_called_once()
        # Verify database was updated with JSONField
        weather_data = WeatherData.objects.get(city=city, forecast_period="current")
        assert isinstance(weather_data.data, list)
        assert weather_data.data[0]["temp"] == 15.5

    @patch("app.services.weather_service.requests.get")
    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_current_weather_api_error(
        self,
        mock_redis_from_url,
        mock_requests_get,
        city,
    ):
        """Test fetch_current_weather handles API errors."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        mock_redis.get.return_value = None  # Cache miss

        mock_requests_get.side_effect = requests.RequestException("API Error")

        weather_service = WeatherService()  # Initialize with mock Redis

        with pytest.raises(requests.RequestException):
            weather_service.fetch_current_weather(city)

    @patch("app.services.weather_service.requests.get")
    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_forecast_cache_hit(
        self,
        mock_redis_from_url,
        mock_requests_get,
        city,
    ):
        """Test fetch_forecast returns cached data (list format) with timezone."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        cached_data = [{"temp": 15.0, "dt": 1609459200, "description": "clear sky"}]
        mock_redis.get.return_value = json.dumps(cached_data)

        # Mock the API call for timezone_offset
        mock_response = Mock()
        mock_response.json.return_value = {"timezone_offset": 7200}
        mock_response.raise_for_status = Mock()
        mock_requests_get.return_value = mock_response

        weather_service = WeatherService()  # Initialize with mock Redis
        result, timezone_offset = weather_service.fetch_forecast(city, "hourly")

        assert result == cached_data
        assert isinstance(result, list)
        assert timezone_offset == 7200

    @patch("app.services.weather_service.requests.get")
    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_forecast_cache_miss(
        self,
        mock_redis_from_url,
        mock_requests_get,
        city,
        mock_api_response_forecast,
    ):
        """Test fetch_forecast fetches from API on cache miss."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        mock_redis.get.return_value = None  # Cache miss

        mock_response = Mock()
        mock_response.json.return_value = mock_api_response_forecast
        mock_response.raise_for_status = Mock()
        mock_requests_get.return_value = mock_response

        weather_service = WeatherService()  # Initialize with mock Redis
        result, timezone_offset = weather_service.fetch_forecast(city, "hourly")

        assert isinstance(result, list)
        assert len(result) <= 48  # Hourly forecast limited to 48 hours (now 12)
        assert "temp" in result[0]
        assert "dt" in result[0]
        assert timezone_offset == 7200  # From mock_api_response_forecast
        mock_requests_get.assert_called_once()
        mock_redis.setex.assert_called_once()

        # Verify database was updated with JSONField
        weather_data = WeatherData.objects.get(city=city, forecast_period="hourly")
        assert isinstance(weather_data.data, list)

    @patch("app.services.weather_service.redis.from_url")
    def test_fetch_forecast_invalid_period(
        self,
        mock_redis_from_url,
        city,
    ):
        """Test fetch_forecast raises ValueError for invalid period."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        weather_service = WeatherService()  # Initialize with mock Redis

        with pytest.raises(ValueError, match="Invalid period"):
            weather_service.fetch_forecast(city, "invalid_period")

        # Also test removed periods
        with pytest.raises(ValueError, match="Invalid period"):
            weather_service.fetch_forecast(city, "10days")

        with pytest.raises(ValueError, match="Invalid period"):
            weather_service.fetch_forecast(city, "2weeks")

        with pytest.raises(ValueError, match="Invalid period"):
            weather_service.fetch_forecast(city, "month")

    # Parsing Tests
    def test_parse_current_response(self, weather_service, mock_api_response_current):
        """Test parsing of current weather API response (One Call API 3.0)."""
        result = weather_service._parse_current_response(mock_api_response_current)

        # Result is now a list
        assert isinstance(result, list)
        assert len(result) == 1

        item = result[0]
        assert item["temp"] == 15.5
        assert item["feels_like"] == 14.8
        assert item["humidity"] == 65
        assert item["pressure"] == 1013
        assert item["wind_speed"] == 3.2
        assert item["wind_deg"] == 180
        assert item["visibility"] == 10000
        assert item["clouds"] == 0
        assert item["description"] == "clear sky"
        assert item["icon"] == "01d"
        assert item["dt"] == 1609459200
        assert item["uvi"] == 0.5

    def test_parse_forecast_response_hourly(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for hourly period."""
        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "hourly"
        )

        assert isinstance(result, list)
        assert len(result) <= 48
        assert "temp" in result[0]
        assert "dt" in result[0]
        assert "humidity" in result[0]
        assert "description" in result[0]

    @freeze_time("2021-01-01 12:00:00")
    def test_parse_forecast_response_today(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for today period (always list)."""
        # Add timezone_offset to mock response (required for today filtering)
        mock_api_response_forecast["timezone_offset"] = 0  # UTC

        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "today"
        )

        # Now always returns list - filtered by target hours [2, 5, 8, 11, 14, 17, 20, 23]
        assert isinstance(result, list)
        # With freezegun at 2021-01-01 12:00:00 UTC, we should get hours matching target
        # Mock data has hourly items starting from base_time (1609459200 = 2021-01-01 00:00:00 UTC)
        # Target hours: 2, 5, 8, 11, 14, 17, 20, 23
        # Available hours in mock: 0, 1, 2, ..., 47 (48 hours)
        # Today's hours: 0-23, matching targets: 2, 5, 8, 11, 14, 17, 20, 23 = 8 items
        assert len(result) >= 1
        for item in result:
            assert "temp" in item
            assert "dt" in item

    def test_parse_forecast_response_3days(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for 3days period."""
        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "3days"
        )

        assert isinstance(result, list)
        assert len(result) == 3
        for item in result:
            assert "temp" in item
            assert "dt" in item

    def test_parse_forecast_response_week(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for week period."""
        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "week"
        )

        assert isinstance(result, list)
        assert len(result) == 7
        for item in result:
            assert "temp" in item
            assert "dt" in item

    def test_parse_forecast_response_empty(self, weather_service):
        """Test parsing empty forecast response."""
        result = weather_service._parse_forecast_response({}, "today")

        assert isinstance(result, list)
        assert len(result) == 0

    def test_parse_geocoding_response(
        self, weather_service, mock_api_response_geocoding
    ):
        """Test parsing of geocoding API response."""
        result = weather_service._parse_geocoding_response(mock_api_response_geocoding)

        assert len(result) == 2
        assert result[0]["name"] == "Kyiv"
        assert result[0]["country"] == "UA"
        assert result[0]["lat"] == 50.4501
        assert result[0]["lon"] == 30.5234

    # Search Cities Tests
    @patch("app.services.weather_service.requests.get")
    def test_search_cities_success(
        self, mock_requests_get, weather_service, mock_api_response_geocoding
    ):
        """Test successful city search via API."""
        mock_response = Mock()
        mock_response.json.return_value = mock_api_response_geocoding
        mock_response.raise_for_status = Mock()
        mock_requests_get.return_value = mock_response

        result = weather_service.search_cities("Kyiv")

        assert len(result) == 2
        assert result[0]["name"] == "Kyiv"
        assert result[0]["country"] == "UA"
        mock_requests_get.assert_called_once()

    @patch("app.services.weather_service.requests.get")
    def test_search_cities_empty_query(self, mock_requests_get, weather_service):
        """Test search_cities with empty query."""
        result = weather_service.search_cities("")

        assert result == []
        mock_requests_get.assert_not_called()

    @patch("app.services.weather_service.requests.get")
    def test_search_cities_api_error(self, mock_requests_get, weather_service):
        """Test search_cities handles API errors."""
        mock_requests_get.side_effect = requests.RequestException("API Error")

        with pytest.raises(requests.RequestException):
            weather_service.search_cities("Kyiv")


class TestCityService:
    """Tests for CityService."""

    @pytest.fixture
    def city_service(self):
        """Create CityService instance."""
        return CityService()

    @pytest.fixture
    def existing_city(self, db):
        """Create an existing city in database."""
        return CityFactory(name="Kyiv", country="UA")

    # Database-First Search Tests
    def test_search_cities_database_first(self, city_service, existing_city):
        """Test database-first search returns city from DB."""
        result = city_service.search_cities("Kyiv")

        assert len(result) == 1
        assert result[0].id == existing_city.id
        assert result[0].name == "Kyiv"

    def test_search_cities_database_partial_match(self, city_service, db):
        """Test database search with partial match."""
        CityFactory(name="Kyiv", country="UA")
        CityFactory(name="Kyiv Oblast", country="UA")

        result = city_service.search_cities("Kyiv")

        assert len(result) >= 1
        assert all("Kyiv" in city.name for city in result)

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_search_cities_api_fallback(self, mock_weather_search, city_service, db):
        """Test API fallback when city not in database (returns dict by default)."""
        mock_weather_search.return_value = [
            {"name": "London", "country": "GB", "lat": 51.5074, "lon": -0.1278}
        ]

        # By default, create_in_db=False, so returns dicts
        result = city_service.search_cities("London")

        assert len(result) == 1
        assert result[0]["name"] == "London"
        assert result[0]["country"] == "GB"
        # City NOT created in database (create_in_db=False by default)
        assert not City.objects.filter(name="London", country="GB").exists()

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_search_cities_api_fallback_creates_city(
        self, mock_weather_search, city_service, db
    ):
        """Test API fallback creates new city in database when create_in_db=True."""
        mock_weather_search.return_value = [
            {"name": "Paris", "country": "FR", "lat": 48.8566, "lon": 2.3522}
        ]

        initial_count = City.objects.count()
        # With create_in_db=True, cities are created in DB
        result = city_service.search_cities("Paris", create_in_db=True)

        assert City.objects.count() == initial_count + 1
        assert result[0].name == "Paris"
        assert result[0].country == "FR"
        assert float(result[0].latitude) == 48.8566
        assert float(result[0].longitude) == 2.3522

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_search_cities_api_fallback_no_results(
        self, mock_weather_search, city_service, db
    ):
        """Test API fallback returns empty list when no results."""
        mock_weather_search.return_value = []

        result = city_service.search_cities("NonexistentCity")

        assert result == []

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_search_cities_api_error_handling(
        self, mock_weather_search, city_service, db
    ):
        """Test search_cities handles API errors gracefully."""
        mock_weather_search.side_effect = Exception("API Error")

        result = city_service.search_cities("Kyiv")

        assert result == []

    def test_search_cities_empty_query(self, city_service):
        """Test search_cities with empty query."""
        result = city_service.search_cities("")

        assert result == []

    def test_search_cities_whitespace_query(self, city_service):
        """Test search_cities with whitespace-only query."""
        result = city_service.search_cities("   ")

        assert result == []

    # City Creation Tests
    def test_get_or_create_city_new(self, city_service, db):
        """Test get_or_create_city creates new city."""
        city, created = city_service.get_or_create_city(
            name="Berlin", country="DE", lat=52.5200, lon=13.4050
        )

        assert created is True
        assert city.name == "Berlin"
        assert city.country == "DE"
        assert float(city.latitude) == 52.5200
        assert float(city.longitude) == 13.4050

    def test_get_or_create_city_existing(self, city_service, existing_city):
        """Test get_or_create_city returns existing city."""
        city, created = city_service.get_or_create_city(
            name="Kyiv", country="UA", lat=50.4501, lon=30.5234
        )

        assert created is False
        assert city.id == existing_city.id
        assert city.name == "Kyiv"

    def test_get_or_create_city_duplicate_prevention(self, city_service, db):
        """Test get_or_create_city prevents duplicates."""
        city1, created1 = city_service.get_or_create_city(
            name="Tokyo", country="JP", lat=35.6762, lon=139.6503
        )
        city2, created2 = city_service.get_or_create_city(
            name="Tokyo", country="JP", lat=35.6762, lon=139.6503
        )

        assert created1 is True
        assert created2 is False
        assert city1.id == city2.id
        assert City.objects.filter(name="Tokyo", country="JP").count() == 1
