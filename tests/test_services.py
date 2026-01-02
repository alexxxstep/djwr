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
        """Mock OpenWeatherMap current weather API response."""
        return {
            "coord": {"lon": 30.5234, "lat": 50.4501},
            "weather": [
                {
                    "id": 800,
                    "main": "Clear",
                    "description": "clear sky",
                    "icon": "01d",
                }
            ],
            "base": "stations",
            "main": {
                "temp": 15.5,
                "feels_like": 14.8,
                "temp_min": 13.0,
                "temp_max": 18.0,
                "pressure": 1013,
                "humidity": 65,
            },
            "visibility": 10000,
            "wind": {"speed": 3.2, "deg": 180},
            "clouds": {"all": 0},
            "dt": 1609459200,
            "sys": {
                "type": 1,
                "id": 8904,
                "country": "UA",
                "sunrise": 1609434000,
                "sunset": 1609466400,
            },
            "timezone": 7200,
            "id": 703448,
            "name": "Kyiv",
            "cod": 200,
        }

    @pytest.fixture
    def mock_api_response_forecast(self):
        """Mock OpenWeatherMap forecast API response."""
        base_time = 1609459200  # 2021-01-01 00:00:00 UTC
        forecast_list = []
        for i in range(40):  # 40 forecasts (5 days * 8 per day)
            forecast_list.append(
                {
                    "dt": base_time + (i * 10800),  # Every 3 hours
                    "main": {
                        "temp": 15.0 + i,
                        "feels_like": 14.0 + i,
                        "temp_min": 13.0 + i,
                        "temp_max": 17.0 + i,
                        "pressure": 1013,
                        "humidity": 65,
                    },
                    "weather": [
                        {
                            "id": 800,
                            "main": "Clear",
                            "description": "clear sky",
                            "icon": "01d",
                        }
                    ],
                    "clouds": {"all": 0},
                    "wind": {"speed": 3.2, "deg": 180},
                    "visibility": 10000,
                    "pop": 0,
                    "sys": {"pod": "d"},
                    "dt_txt": "2021-01-01 00:00:00",
                }
            )
        return {"cod": "200", "message": 0, "cnt": 40, "list": forecast_list}

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
        assert weather_service._get_cache_ttl("today") == 1800  # 30 min
        assert weather_service._get_cache_ttl("tomorrow") == 1800  # 30 min
        assert weather_service._get_cache_ttl("3days") == 3600  # 60 min
        assert weather_service._get_cache_ttl("week") == 3600  # 60 min
        assert weather_service._get_cache_ttl("hourly") == 900  # 15 min
        assert weather_service._get_cache_ttl("10days") == 7200  # 120 min
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
        """Test fetch_current_weather returns cached data."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        cached_data = {"temperature": 15.5, "humidity": 65, "description": "clear sky"}
        mock_redis.get.return_value = json.dumps(cached_data)

        weather_service = WeatherService()  # Initialize with mock Redis
        result = weather_service.fetch_current_weather(city)

        assert result == cached_data
        mock_requests_get.assert_not_called()  # API should not be called

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
        result = weather_service.fetch_current_weather(city)

        assert result["temperature"] == 15.5
        assert result["humidity"] == 65
        assert result["description"] == "clear sky"
        assert result["icon"] == "01d"

        # Verify API was called
        mock_requests_get.assert_called_once()
        # Verify cache was saved
        mock_redis.setex.assert_called_once()
        # Verify database was updated
        weather_data = WeatherData.objects.get(city=city, forecast_period="current")
        assert weather_data.temperature == Decimal("15.5")

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
        """Test fetch_forecast returns cached data."""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis

        cached_data = [{"temperature": 15.0, "dt": "2021-01-01T00:00:00+00:00"}]
        mock_redis.get.return_value = json.dumps(cached_data)

        weather_service = WeatherService()  # Initialize with mock Redis
        result = weather_service.fetch_forecast(city, "hourly")

        assert result == cached_data
        mock_requests_get.assert_not_called()

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
        result = weather_service.fetch_forecast(city, "hourly")

        assert isinstance(result, list)
        assert len(result) <= 48  # Hourly forecast limited to 48 hours
        mock_requests_get.assert_called_once()
        mock_redis.setex.assert_called_once()

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

    # Parsing Tests
    def test_parse_current_response(self, weather_service, mock_api_response_current):
        """Test parsing of current weather API response."""
        result = weather_service._parse_current_response(mock_api_response_current)

        assert result["temperature"] == 15.5
        assert result["feels_like"] == 14.8
        assert result["humidity"] == 65
        assert result["pressure"] == 1013
        assert result["wind_speed"] == 3.2
        assert result["wind_deg"] == 180
        assert result["visibility"] == 10000
        assert result["clouds"] == 0
        assert result["description"] == "clear sky"
        assert result["icon"] == "01d"

    def test_parse_forecast_response_hourly(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for hourly period."""
        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "hourly"
        )

        assert isinstance(result, list)
        assert len(result) <= 48
        assert "temperature" in result[0]
        assert "dt" in result[0]

    def test_parse_forecast_response_today(
        self, weather_service, mock_api_response_forecast
    ):
        """Test parsing of forecast response for today period."""
        result = weather_service._parse_forecast_response(
            mock_api_response_forecast, "today"
        )

        assert isinstance(result, dict)
        assert "temperature" in result
        assert "dt" in result

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
        """Test API fallback when city not in database."""
        mock_weather_search.return_value = [
            {"name": "London", "country": "GB", "lat": 51.5074, "lon": -0.1278}
        ]

        result = city_service.search_cities("London")

        assert len(result) == 1
        assert result[0].name == "London"
        assert result[0].country == "GB"
        # Verify city was created in database
        assert City.objects.filter(name="London", country="GB").exists()

    @patch("app.services.city_service.WeatherService.search_cities")
    def test_search_cities_api_fallback_creates_city(
        self, mock_weather_search, city_service, db
    ):
        """Test API fallback creates new city in database."""
        mock_weather_search.return_value = [
            {"name": "Paris", "country": "FR", "lat": 48.8566, "lon": 2.3522}
        ]

        initial_count = City.objects.count()
        result = city_service.search_cities("Paris")

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
