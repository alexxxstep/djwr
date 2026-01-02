"""
WeatherService: Business logic for weather data fetching and caching.

This service implements multi-layer caching:
1. Redis cache (fastest, ~1ms)
2. Database (WeatherData model)
3. OpenWeatherMap API (fallback)

Cache-first approach reduces API calls by 70-90%.
"""

import json
import logging
from datetime import UTC
from decimal import Decimal

import redis
import requests
from django.conf import settings
from django.utils import timezone

from app.models import City, WeatherData

# Debug log path
DEBUG_LOG_PATH = settings.BASE_DIR / ".cursor" / "debug.log"

logger = logging.getLogger(__name__)


class WeatherService:
    """Service for fetching weather data from OpenWeatherMap API."""

    # https://api.openweathermap.org/data/2.5
    BASE_URL = settings.WEATHER_API_URL
    API_KEY = settings.WEATHER_API_KEY
    GEOCODING_URL = "https://api.openweathermap.org/geo/1.0/direct"

    def __init__(self):
        """Initialize WeatherService with Redis connection."""
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Cache will be disabled.")
            self.redis_client = None

    def _get_cache_key(self, city_id: int, period: str) -> str:
        """
        Generate Redis cache key.

        Format: weather:{city_id}:{period}

        Args:
            city_id: City ID
            period: Forecast period (current, today, tomorrow, etc.)

        Returns:
            Cache key string
        """
        return f"weather:{city_id}:{period}"

    def _get_cache_ttl(self, period: str) -> int:
        """
        Get TTL in seconds based on forecast period.

        TTL strategy:
        - current: 10 min (600s) - changes frequently
        - today/tomorrow: 30 min (1800s) - updates every hour
        - 3days/week: 60 min (3600s) - updates every few hours
        - hourly: 15 min (900s) - detailed forecast
        - 10days/2weeks/month: 120 min (7200s) - long-term forecast

        Args:
            period: Forecast period

        Returns:
            TTL in seconds (default: 600 if period not found)
        """
        ttl_map = {
            "current": 600,  # 10 minutes
            "today": 1800,  # 30 minutes
            "tomorrow": 1800,  # 30 minutes
            "3days": 3600,  # 60 minutes
            "week": 3600,  # 60 minutes
            "hourly": 900,  # 15 minutes
            "10days": 7200,  # 120 minutes
            "2weeks": 7200,  # 120 minutes
            "month": 7200,  # 120 minutes
        }
        return ttl_map.get(period, 600)  # Default: 10 minutes

    def _get_from_cache(self, cache_key: str) -> dict | list | None:
        """
        Retrieve data from Redis cache.

        Args:
            cache_key: Redis cache key

        Returns:
            Cached data (dict for single forecasts, list for hourly forecasts)
            or None if not found/error
        """
        # #region agent log
        import json as json_module

        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "C",
                        "location": "weather_service.py:98",
                        "message": "_get_from_cache entry",
                        "data": {
                            "cache_key": cache_key,
                            "has_redis": self.redis_client is not None,
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion
        if not self.redis_client:
            return None

        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                # #region agent log
                with open(DEBUG_LOG_PATH, "a") as f:
                    f.write(
                        json_module.dumps(
                            {
                                "sessionId": "debug-session",
                                "runId": "run1",
                                "hypothesisId": "C",
                                "location": "weather_service.py:107",
                                "message": "cache hit - data type check",
                                "data": {
                                    "cache_key": cache_key,
                                    "data_type": type(data).__name__,
                                    "is_list": isinstance(data, list),
                                    "is_dict": isinstance(data, dict),
                                },
                                "timestamp": int(timezone.now().timestamp() * 1000),
                            }
                        )
                        + "\n"
                    )
                # #endregion
                logger.debug(f"Cache hit: {cache_key}")
                return data
            logger.debug(f"Cache miss: {cache_key}")
            return None
        except (redis.RedisError, json.JSONDecodeError) as e:
            # #region agent log
            with open(DEBUG_LOG_PATH, "a") as f:
                f.write(
                    json_module.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "D",
                            "location": "weather_service.py:111",
                            "message": "cache read error",
                            "data": {
                                "cache_key": cache_key,
                                "error": str(e),
                                "error_type": type(e).__name__,
                            },
                            "timestamp": int(timezone.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
            # #endregion
            logger.warning(f"Cache read error for {cache_key}: {e}")
            return None

    def _save_to_cache(self, cache_key: str, data: dict | list, ttl: int) -> None:
        """
        Save data to Redis cache.

        Args:
            cache_key: Redis cache key
            data: Data to cache (dict for single forecasts, list for hourly forecasts)
            ttl: Time to live in seconds
        """
        # #region agent log
        import json as json_module

        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "B",
                        "location": "weather_service.py:113",
                        "message": "_save_to_cache entry",
                        "data": {
                            "cache_key": cache_key,
                            "data_type": type(data).__name__,
                            "is_list": isinstance(data, list),
                            "is_dict": isinstance(data, dict),
                            "ttl": ttl,
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion
        if not self.redis_client:
            logger.debug("Redis not available, skipping cache save")
            return

        try:
            serialized_data = json.dumps(data)
            self.redis_client.setex(cache_key, ttl, serialized_data)
            # #region agent log
            with open(DEBUG_LOG_PATH, "a") as f:
                f.write(
                    json_module.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "B",
                            "location": "weather_service.py:125",
                            "message": "cache save success",
                            "data": {
                                "cache_key": cache_key,
                                "data_type": type(data).__name__,
                            },
                            "timestamp": int(timezone.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
            # #endregion
            logger.debug(f"Cached data: {cache_key} (TTL: {ttl}s)")
        except (redis.RedisError, TypeError) as e:
            # TypeError if data is not JSON-serializable
            # #region agent log
            with open(DEBUG_LOG_PATH, "a") as f:
                f.write(
                    json_module.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "B",
                            "location": "weather_service.py:130",
                            "message": "cache save error",
                            "data": {
                                "cache_key": cache_key,
                                "data_type": type(data).__name__,
                                "error": str(e),
                                "error_type": type(e).__name__,
                            },
                            "timestamp": int(timezone.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
            # #endregion
            logger.warning(f"Cache save error for {cache_key}: {e}")
            # Don't raise - cache is optional, continue without it

    def fetch_current_weather(self, city: City) -> dict:
        """
        Fetch current weather for a city with Redis caching.

        Flow:
        1. Check Redis cache first
        2. If cached: Return cached data
        3. If not cached: Call OpenWeatherMap API
        4. Parse response and save to cache + database
        5. Return weather data

        Args:
            city: City object with latitude and longitude

        Returns:
            Weather data dict with temperature, feels_like, humidity, etc.

        Raises:
            requests.RequestException: If API call fails
        """
        period = "current"
        cache_key = self._get_cache_key(city.id, period)

        # Step 1: Check Redis cache
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            logger.info(f"Cache hit for city {city.id} ({city.name})")
            return cached_data

        # Step 2: Cache miss - fetch from API
        logger.info(f"Fetching current weather for {city.name} from API")
        url = f"{self.BASE_URL}/weather"
        params = {
            "lat": float(city.latitude),
            "lon": float(city.longitude),
            "units": "metric",
            "appid": self.API_KEY,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            api_data = response.json()
        except requests.RequestException as e:
            logger.error(f"API request failed for {city.name}: {e}")
            raise

        # Step 3: Parse response (simple parsing, detailed parser in next step)
        weather_data = self._parse_current_response(api_data)

        # Step 4: Save to Redis cache
        ttl = self._get_cache_ttl(period)
        self._save_to_cache(cache_key, weather_data, ttl)

        # Step 5: Save to database
        WeatherData.objects.update_or_create(
            city=city,
            forecast_period=period,
            defaults={
                "temperature": Decimal(str(weather_data["temperature"])),
                "feels_like": Decimal(str(weather_data["feels_like"])),
                "humidity": weather_data["humidity"],
                "pressure": weather_data["pressure"],
                "wind_speed": Decimal(str(weather_data["wind_speed"])),
                "wind_deg": weather_data.get("wind_deg"),
                "visibility": weather_data.get("visibility"),
                "clouds": weather_data.get("clouds"),
                "description": weather_data["description"],
                "icon": weather_data["icon"],
                "fetched_at": timezone.now(),
            },
        )

        logger.info(f"Successfully fetched and cached weather for {city.name}")
        return weather_data

    def _parse_current_response(self, api_data: dict) -> dict:
        """
        Parse OpenWeatherMap current weather API response.

        Transforms API response to our internal format.

        Args:
            api_data: Raw API response JSON

        Returns:
            Parsed weather data dictionary
        """
        main = api_data.get("main", {})
        # First weather condition
        weather = api_data.get("weather", [{}])[0]
        wind = api_data.get("wind", {})

        return {
            "temperature": main.get("temp", 0),
            "feels_like": main.get("feels_like", 0),
            "humidity": main.get("humidity", 0),
            "pressure": main.get("pressure", 0),
            "wind_speed": wind.get("speed", 0),
            "wind_deg": wind.get("deg"),
            "visibility": api_data.get("visibility"),
            "clouds": api_data.get("clouds", {}).get("all"),
            "description": weather.get("description", ""),
            "icon": weather.get("icon", ""),
        }

    def _parse_forecast_response(self, api_data: dict, period: str) -> dict | list:
        """
        Parse OpenWeatherMap forecast API response.

        Handles both /forecast (5-day) and /forecast/hourly (48-hour).
        Filters data based on requested period.

        Args:
            api_data: Raw API response JSON
            period: Forecast period (today, tomorrow, 3days, week, hourly)

        Returns:
            Parsed weather data (dict for single, list for multi-hour)
        """
        from datetime import datetime, timedelta

        forecast_list = api_data.get("list", [])
        # #region agent log
        import json as json_module

        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "E",
                        "location": "weather_service.py:257",
                        "message": "_parse_forecast_response entry",
                        "data": {
                            "period": period,
                            "forecast_list_length": len(forecast_list)
                            if forecast_list
                            else 0,
                            "has_list": "list" in api_data,
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion
        if not forecast_list:
            return {}

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)

        parsed_items = []
        for item in forecast_list:
            # Parse timestamp
            dt = datetime.fromtimestamp(item["dt"], tz=UTC)

            main = item.get("main", {})
            weather = item.get("weather", [{}])[0]
            wind = item.get("wind", {})

            parsed_item = {
                "dt": dt.isoformat(),
                "temperature": main.get("temp", 0),
                "feels_like": main.get("feels_like", 0),
                "humidity": main.get("humidity", 0),
                "pressure": main.get("pressure", 0),
                "wind_speed": wind.get("speed", 0),
                "wind_deg": wind.get("deg"),
                "visibility": item.get("visibility"),
                "clouds": item.get("clouds", {}).get("all"),
                "description": weather.get("description", ""),
                "icon": weather.get("icon", ""),
            }
            parsed_items.append(parsed_item)

        # Filter by period
        result = None
        if period == "hourly":
            # Return all hourly forecasts (up to 48 hours)
            result = parsed_items[:48]
        elif period == "today":
            # Today's forecasts (until midnight)
            filtered = [
                p
                for p in parsed_items
                if datetime.fromisoformat(p["dt"]) < tomorrow_start
            ]
            result = filtered[0] if filtered else parsed_items[0]
        elif period == "tomorrow":
            # Tomorrow's forecasts
            day_after = tomorrow_start + timedelta(days=1)
            filtered = [
                p
                for p in parsed_items
                if tomorrow_start <= datetime.fromisoformat(p["dt"]) < day_after
            ]
            result = filtered[0] if filtered else parsed_items[0]
        elif period == "3days":
            # Next 3 days
            three_days = today_start + timedelta(days=3)
            filtered = [
                p for p in parsed_items if datetime.fromisoformat(p["dt"]) < three_days
            ]
            result = filtered
        elif period == "week":
            # Next 7 days (first forecast per day)
            week_start = today_start + timedelta(days=7)
            filtered = [
                p for p in parsed_items if datetime.fromisoformat(p["dt"]) < week_start
            ]
            # Return first forecast per day (simplified)
            result = filtered[:7] if len(filtered) >= 7 else filtered
        else:
            # Default: return first item
            result = parsed_items[0] if parsed_items else {}
        # #region agent log
        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "weather_service.py:327",
                        "message": "_parse_forecast_response return type",
                        "data": {
                            "period": period,
                            "return_type": type(result).__name__,
                            "is_list": isinstance(result, list),
                            "is_dict": isinstance(result, dict),
                            "result_length": len(result)
                            if isinstance(result, list)
                            else 1,
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion
        return result

    def fetch_forecast(self, city: City, period: str) -> dict | list:
        """
        Fetch weather forecast for a city with Redis caching.

        Flow:
        1. Check Redis cache first
        2. If cached: Return cached data
        3. If not cached: Determine API endpoint based on period
        4. Call OpenWeatherMap API
        5. Parse and filter response by period
        6. Save to cache + database
        7. Return weather data

        Args:
            city: City object with latitude and longitude
            period: Forecast period (today, tomorrow, 3days, week, hourly)

        Returns:
            Weather data: dict for single forecasts (today, tomorrow, etc.),
            list for hourly forecasts

        Raises:
            requests.RequestException: If API call fails
            ValueError: If period is invalid
        """
        # #region agent log
        import json as json_module

        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "weather_service.py:329",
                        "message": "fetch_forecast entry",
                        "data": {
                            "city_id": city.id,
                            "city_name": city.name,
                            "period": period,
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion
        # Validate period
        valid_periods = [
            "today",
            "tomorrow",
            "3days",
            "week",
            "hourly",
            "10days",
            "2weeks",
            "month",
        ]
        if period not in valid_periods:
            raise ValueError(f"Invalid period: {period}")

        cache_key = self._get_cache_key(city.id, period)

        # Step 1: Check Redis cache
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            # #region agent log
            with open(DEBUG_LOG_PATH, "a") as f:
                f.write(
                    json_module.dumps(
                        {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "A",
                            "location": "weather_service.py:373",
                            "message": "fetch_forecast cache hit - return type check",
                            "data": {
                                "city_id": city.id,
                                "period": period,
                                "return_type": type(cached_data).__name__,
                                "is_list": isinstance(cached_data, list),
                                "is_dict": isinstance(cached_data, dict),
                            },
                            "timestamp": int(timezone.now().timestamp() * 1000),
                        }
                    )
                    + "\n"
                )
            # #endregion
            logger.info(f"Cache hit for {city.name} ({period})")
            return cached_data

        # Step 2: Determine API endpoint
        if period == "hourly":
            url = f"{self.BASE_URL}/forecast/hourly"
        else:
            url = f"{self.BASE_URL}/forecast"

        # Step 3: Call API
        logger.info(f"Fetching {period} forecast for {city.name} from API")
        params = {
            "lat": float(city.latitude),
            "lon": float(city.longitude),
            "units": "metric",
            "appid": self.API_KEY,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            api_data = response.json()
        except requests.RequestException as e:
            logger.error(f"API request failed for {city.name}: {e}")
            raise

        # Step 4: Parse response based on period
        weather_data = self._parse_forecast_response(api_data, period)
        # #region agent log
        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json_module.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "A",
                        "location": "weather_service.py:405",
                        "message": "fetch_forecast after parse - return type check",
                        "data": {
                            "city_id": city.id,
                            "period": period,
                            "return_type": type(weather_data).__name__,
                            "is_list": isinstance(weather_data, list),
                            "is_dict": isinstance(weather_data, dict),
                        },
                        "timestamp": int(timezone.now().timestamp() * 1000),
                    }
                )
                + "\n"
            )
        # #endregion

        # Step 5: Save to Redis cache
        ttl = self._get_cache_ttl(period)
        self._save_to_cache(cache_key, weather_data, ttl)

        # Step 6: Save to database (for current period summary)
        # For forecasts, we save the first/main entry
        main_data = weather_data[0] if isinstance(weather_data, list) else weather_data

        WeatherData.objects.update_or_create(
            city=city,
            forecast_period=period,
            defaults={
                "temperature": Decimal(str(main_data["temperature"])),
                "feels_like": Decimal(str(main_data["feels_like"])),
                "humidity": main_data["humidity"],
                "pressure": main_data["pressure"],
                "wind_speed": Decimal(str(main_data["wind_speed"])),
                "wind_deg": main_data.get("wind_deg"),
                "visibility": main_data.get("visibility"),
                "clouds": main_data.get("clouds"),
                "description": main_data["description"],
                "icon": main_data["icon"],
                "fetched_at": timezone.now(),
            },
        )

        logger.info(f"Successfully fetched and cached {period} for {city.name}")
        return weather_data

    def search_cities(self, query: str) -> list[dict]:
        """
        Search cities via OpenWeatherMap Geocoding API.

        Calls /geo/1.0/direct endpoint to search cities by name.
        Returns list of matching cities with coordinates.

        Args:
            query: Search query (city name, e.g., "Kyiv", "New York")

        Returns:
            List of city dictionaries with keys:
            - name: City name
            - country: Country code (e.g., "UA", "US")
            - lat: Latitude
            - lon: Longitude

        Raises:
            requests.RequestException: If API call fails after retries
        """
        if not query or not query.strip():
            return []

        url = self.GEOCODING_URL
        params = {
            "q": query.strip(),
            "limit": 5,  # Limit to 5 results
            "appid": self.API_KEY,
        }

        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                logger.info(f"Searching cities: '{query}' (attempt {attempt + 1})")
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                api_data = response.json()

                # Parse response
                cities = self._parse_geocoding_response(api_data)
                logger.info(f"Found {len(cities)} cities for '{query}'")
                return cities

            except requests.HTTPError as e:
                if e.response.status_code == 429:  # Rate limit
                    if attempt < max_retries - 1:
                        # Exponential backoff
                        wait_time = retry_delay * (2**attempt)
                        logger.warning(f"Rate limit hit, retrying in {wait_time}s...")
                        import time

                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Rate limit exceeded for '{query}'")
                        raise
                else:
                    logger.error(f"API error for '{query}': {e}")
                    raise

            except requests.RequestException as e:
                logger.error(f"Request failed for '{query}': {e}")
                if attempt < max_retries - 1:
                    import time

                    time.sleep(retry_delay)
                    continue
                raise

        return []  # Should not reach here, but just in case

    def _parse_geocoding_response(self, api_data: list) -> list[dict]:
        """
        Parse OpenWeatherMap Geocoding API response.

        Transforms API response to our internal format.

        Args:
            api_data: Raw API response (list of city objects)

        Returns:
            List of city dictionaries with name, country, lat, lon
        """
        cities = []
        for item in api_data:
            city_data = {
                "name": item.get("name", ""),
                "country": item.get("country", ""),
                "lat": item.get("lat", 0),
                "lon": item.get("lon", 0),
            }
            cities.append(city_data)

        return cities
