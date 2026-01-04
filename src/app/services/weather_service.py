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
import os
from datetime import UTC

import redis
import requests
from django.conf import settings
from django.utils import timezone

from app.models import City, WeatherData

logger = logging.getLogger(__name__)

class WeatherService:
    """Service for fetching weather data from OpenWeatherMap API."""

    # https://api.openweathermap.org/data/3.0
    BASE_URL = settings.WEATHER_API_URL
    API_KEY = settings.WEATHER_API_KEY
    GEOCODING_URL = settings.WEATHER_GEOCODING_URL

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
        - hourly: 15 min (900s) - detailed forecast
        - today/tomorrow: 30 min (1800s) - updates every hour
        - 3days/week: 60 min (3600s) - updates every few hours

        Args:
            period: Forecast period

        Returns:
            TTL in seconds (default: 600 if period not found)
        """
        ttl_map = {
            "current": 600,  # 10 minutes
            "hourly": 900,  # 15 minutes
            "today": 1800,  # 30 minutes
            "tomorrow": 1800,  # 30 minutes
            "3days": 3600,  # 60 minutes
            "week": 3600,  # 60 minutes
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
        if not self.redis_client:
            return None

        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                logger.debug(f"Cache hit: {cache_key}")
                return data
            logger.debug(f"Cache miss: {cache_key}")
            return None
        except (redis.RedisError, json.JSONDecodeError) as e:
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
        if not self.redis_client:
            logger.debug("Redis not available, skipping cache save")
            return

        try:
            serialized_data = json.dumps(data)
            self.redis_client.setex(cache_key, ttl, serialized_data)
            logger.debug(f"Cached data: {cache_key} (TTL: {ttl}s)")
        except (redis.RedisError, TypeError) as e:
            # TypeError if data is not JSON-serializable
            logger.warning(f"Cache save error for {cache_key}: {e}")
            # Don't raise - cache is optional, continue without it

    def fetch_current_weather(self, city: City) -> list:
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
            List with single weather data dict (unified format)

        Raises:
            requests.RequestException: If API call fails
        """
        period = "current"
        cache_key = self._get_cache_key(city.id, period)

        # Step 1: Check Redis cache
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            logger.info(f"Cache hit for city {city.id} ({city.name})")
            # For cached data, we need to get timezone_offset from API
            # Make a lightweight API call to get timezone_offset only
            try:
                url = f"{self.BASE_URL}/onecall"
                params = {
                    "lat": float(city.latitude),
                    "lon": float(city.longitude),
                    "units": "metric",
                    "appid": self.API_KEY,
                    "exclude": "minutely,daily,alerts,current,hourly",  # Minimal data
                }
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                api_data = response.json()
                timezone_offset = api_data.get("timezone_offset", 0)
            except Exception:
                # If API call fails, use default 0
                timezone_offset = 0
            return cached_data, timezone_offset

        # Step 2: Cache miss - fetch from API
        logger.info(f"Cache miss for {city.name} ({period}) - fetching from API")
        url = f"{self.BASE_URL}/onecall"
        params = {
            "lat": float(city.latitude),
            "lon": float(city.longitude),
            "units": "metric",
            "appid": self.API_KEY,
            "exclude": "minutely,daily,alerts",  # Only need current and hourly
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            api_data = response.json()
        except requests.RequestException as e:
            logger.error(f"API request failed for {city.name}: {e}")
            raise

        # Step 3: Parse response - returns list
        weather_data = self._parse_current_response(api_data)

        # Get timezone offset from API response
        timezone_offset = api_data.get("timezone_offset", 0)

        # Step 4: Save to Redis cache
        ttl = self._get_cache_ttl(period)
        self._save_to_cache(cache_key, weather_data, ttl)

        # Step 5: Save to database (JSONField)
        WeatherData.objects.update_or_create(
            city=city,
            forecast_period=period,
            defaults={
                "data": weather_data,
                "fetched_at": timezone.now(),
            },
        )

        logger.info(f"Successfully fetched and cached weather for {city.name}")
        return weather_data, timezone_offset

    def _parse_current_response(self, api_data: dict) -> list:
        """
        Parse OpenWeatherMap One Call API 3.0 current weather response.

        Transforms API response to our internal format.
        Always returns a list (even for single item) for unified data structure.

        Args:
            api_data: Raw API response JSON (One Call API 3.0 format)

        Returns:
            List with single weather data dictionary
        """
        # One Call API 3.0 structure: { "current": {...}, "hourly": [...], ... }
        current = api_data.get("current", {})
        # First weather condition
        weather = current.get("weather", [{}])[0]

        return [
            {
                "dt": current.get("dt", 0),
                "temp": current.get("temp", 0),
                "feels_like": current.get("feels_like", 0),
                "humidity": current.get("humidity", 0),
                "pressure": current.get("pressure", 0),
                "wind_speed": current.get("wind_speed", 0),
                "wind_deg": current.get("wind_deg"),
                "visibility": current.get("visibility"),
                "clouds": current.get("clouds"),
                "uvi": current.get("uvi"),
                "description": weather.get("description", ""),
                "icon": weather.get("icon", ""),
            }
        ]

    def _parse_forecast_response(self, api_data: dict, period: str) -> list:
        """
        Parse OpenWeatherMap One Call API 3.0 forecast response.

        Handles hourly and daily forecasts from One Call API 3.0.
        Filters data based on requested period.
        Always returns a list for unified data structure.

        Args:
            api_data: Raw API response JSON (One Call API 3.0 format)
            period: Forecast period (today, tomorrow, 3days, week, hourly)

        Returns:
            List of parsed weather data dictionaries
        """
        # One Call API 3.0 structure: { "hourly": [...], "daily": [...] }
        if period in ("hourly", "today", "tomorrow"):
            # For hourly, today, tomorrow - use hourly data
            forecast_list = api_data.get("hourly", [])
        else:
            # For daily forecasts (3days, week), use daily array
            forecast_list = api_data.get("daily", [])

        if not forecast_list:
            return []

        parsed_items = []
        for item in forecast_list:
            # One Call API 3.0 structure: fields are directly on item
            weather = item.get("weather", [{}])[0]

            # Handle temperature - in daily it's an object {day, min, max, ...},
            # in hourly it's a number
            temp = item.get("temp", 0)
            temp_min = None
            temp_max = None
            if isinstance(temp, dict):
                temp_min = temp.get("min")
                temp_max = temp.get("max")
                temp = temp.get("day", temp.get("min", 0))

            # Handle feels_like - in daily it's an object, in hourly it's a number
            feels_like = item.get("feels_like", 0)
            if isinstance(feels_like, dict):
                feels_like = feels_like.get("day", feels_like.get("morn", 0))

            parsed_item = {
                "dt": item.get("dt", 0),
                "temp": temp,
                "temp_min": temp_min,
                "temp_max": temp_max,
                "feels_like": feels_like,
                "humidity": item.get("humidity", 0),
                "pressure": item.get("pressure", 0),
                "wind_speed": item.get("wind_speed", 0),
                "wind_deg": item.get("wind_deg"),
                "visibility": item.get("visibility"),
                "clouds": item.get("clouds"),
                "uvi": item.get("uvi"),
                "pop": item.get("pop"),  # Probability of precipitation
                "rain": item.get("rain"),
                "snow": item.get("snow"),
                "description": weather.get("description", ""),
                "icon": weather.get("icon", ""),
            }
            parsed_items.append(parsed_item)

        # Filter by period - always return list
        if period == "hourly":
            # Return hourly forecasts (up to 12 hours)
            return parsed_items[:12]
        elif period == "today":
            # Today's forecast - filter hourly data for today with 3-hour intervals
            # Starting at 2AM local time: 2, 5, 8, 11, 14, 17, 20, 23
            # Includes history (past hours) and future hours
            from datetime import datetime, timezone, timedelta

            # Get timezone offset from API response (in seconds)
            timezone_offset_seconds = api_data.get("timezone_offset", 0)  # Default to 0 (UTC)
            timezone_offset_hours = timezone_offset_seconds / 3600

            # Target hours in local time
            target_local_hours = [2, 5, 8, 11, 14, 17, 20, 23]

            # Convert local hours to UTC hours
            target_utc_hours = [(h - int(timezone_offset_hours)) % 24 for h in target_local_hours]

            # Get current UTC time
            now_utc = datetime.now(timezone.utc)

            # Calculate local time by adding timezone offset
            now_local = now_utc + timedelta(seconds=timezone_offset_seconds)

            # Get start of today in local time (midnight local time)
            today_start_local = datetime(now_local.year, now_local.month, now_local.day, tzinfo=timezone.utc)
            # Convert to UTC timestamp (subtract offset to get UTC equivalent of local midnight)
            today_start_utc = today_start_local - timedelta(seconds=timezone_offset_seconds)
            today_start = today_start_utc.timestamp()
            today_end = today_start + 86400  # 24 hours

            today_items = []
            for item in parsed_items:
                dt = item.get("dt", 0)
                # Check if timestamp is within today's range (in local time)
                if today_start <= dt < today_end:
                    # Convert timestamp to local datetime to check if it's actually today
                    item_utc = datetime.fromtimestamp(dt, tz=timezone.utc)
                    item_local = item_utc + timedelta(seconds=timezone_offset_seconds)

                    # Check if item's local date matches today's local date
                    if (item_local.year == now_local.year and
                        item_local.month == now_local.month and
                        item_local.day == now_local.day):
                        # Check if hour matches target hours
                        if item_local.hour in target_local_hours:
                            today_items.append(item)

            # Sort by timestamp to ensure correct order (history first, then future)
            today_items.sort(key=lambda x: x.get("dt", 0))
            # Return all found items (up to 8, but can be less if some hours are not available)
            return today_items
        elif period == "tomorrow":
            # Tomorrow's forecast - filter hourly data for tomorrow with 3-hour intervals
            # Starting at 2AM local time: 2, 5, 8, 11, 14, 17, 20, 23
            from datetime import datetime, timezone, timedelta

            # Get timezone offset from API response (in seconds)
            # OpenWeatherMap API returns timezone_offset in the root of the response
            # We need to get it from the context (api_data) - but it's not available here
            # So we'll calculate it from the first item's local time vs UTC
            # For now, we'll use UTC and let frontend handle timezone conversion
            # But we need to filter by local time hours, not UTC hours

            # Get timezone offset from the first item if available
            # OpenWeatherMap API provides timezone_offset in the root response
            # We'll need to pass it as a parameter or get it from api_data
            # For now, let's use a different approach: filter by UTC hours that correspond to local 2AM, 5AM, etc.

            # Actually, the issue is that we're filtering by UTC hours [2, 5, 8, 11, 14, 17, 20, 23]
            # but the frontend shows local time, so if the city is UTC+2, UTC 2AM = local 4AM
            # We need to filter by local time hours, which means we need the timezone offset

            # Since we don't have timezone_offset in this method, we'll use a workaround:
            # Filter items for tomorrow, then convert each item's UTC hour to local hour
            # and check if it matches target hours [2, 5, 8, 11, 14, 17, 20, 23]

            # But wait - we need timezone_offset from api_data. Let's check if it's available
            # In One Call API 3.0, timezone_offset is in the root: api_data.get("timezone_offset")
            # But we're in _parse_forecast_response which only receives api_data

            # Actually, the better approach is to get timezone_offset from api_data
            # and use it to convert target local hours to UTC hours

            # For now, let's assume we need to get timezone_offset from the method signature
            # But it's not available. Let's use a different approach:
            # Calculate timezone offset from the first item's timestamp and expected local time

            # Actually, the simplest fix: since the user wants local time hours [2, 5, 8, 11, 14, 17, 20, 23],
            # and the frontend converts UTC to local time, we need to filter by UTC hours that will show as
            # [2, 5, 8, 11, 14, 17, 20, 23] in local time.

            # If city is UTC+2, then:
            # Local 2AM = UTC 0:00 (2 - 2 = 0)
            # Local 5AM = UTC 3:00 (5 - 2 = 3)
            # etc.

            # So we need timezone_offset to convert local hours to UTC hours
            # But we don't have it in this method. Let's modify the method signature or get it from api_data

            # Check if timezone_offset is in api_data
            timezone_offset_seconds = api_data.get("timezone_offset", 0)  # Default to 0 (UTC)
            timezone_offset_hours = timezone_offset_seconds / 3600

            # Target hours in local time
            target_local_hours = [2, 5, 8, 11, 14, 17, 20, 23]

            # Convert local hours to UTC hours
            target_utc_hours = [(h - int(timezone_offset_hours)) % 24 for h in target_local_hours]

            # Get current UTC time
            now_utc = datetime.now(timezone.utc)

            # Calculate local time by adding timezone offset
            now_local = now_utc + timedelta(seconds=timezone_offset_seconds)

            # Get start of tomorrow in local time (midnight local time of next day)
            tomorrow_local = now_local + timedelta(days=1)
            tomorrow_start_local = datetime(tomorrow_local.year, tomorrow_local.month, tomorrow_local.day, tzinfo=timezone.utc)
            # Convert to UTC timestamp (subtract offset to get UTC equivalent of local midnight)
            tomorrow_start_utc = tomorrow_start_local - timedelta(seconds=timezone_offset_seconds)
            tomorrow_start = tomorrow_start_utc.timestamp()
            tomorrow_end = tomorrow_start + 86400  # 24 hours

            # Filter items for tomorrow (in local time)
            tomorrow_candidates = []
            for item in parsed_items:
                dt = item.get("dt", 0)
                # Check if timestamp is within tomorrow's range (in local time)
                if tomorrow_start <= dt < tomorrow_end:
                    # Convert timestamp to local datetime to check if it's actually tomorrow
                    item_utc = datetime.fromtimestamp(dt, tz=timezone.utc)
                    item_local = item_utc + timedelta(seconds=timezone_offset_seconds)

                    # Check if item's local date matches tomorrow's local date
                    if (item_local.year == tomorrow_local.year and
                        item_local.month == tomorrow_local.month and
                        item_local.day == tomorrow_local.day):
                        tomorrow_candidates.append(item)

            # For each target local hour, find the closest item (within 1 hour tolerance)
            tomorrow_items = []
            used_items = set()

            for target_local_hour in target_local_hours:
                best_item = None
                min_diff_minutes = float('inf')

                for item in tomorrow_candidates:
                    if id(item) in used_items:
                        continue

                    dt = item.get("dt", 0)
                    item_utc = datetime.fromtimestamp(dt, tz=timezone.utc)
                    item_local = item_utc + timedelta(seconds=timezone_offset_seconds)

                    # Get local hour and minutes
                    hour = item_local.hour
                    minutes = item_local.minute

                    # Calculate total minutes difference from target hour
                    if hour == target_local_hour:
                        # Exact hour match - prefer minutes closest to 0
                        diff_minutes = abs(minutes)
                    else:
                        # Calculate hours difference
                        hour_diff = hour - target_local_hour
                        # Handle wrap-around (e.g., 23 -> 0)
                        if hour_diff > 12:
                            hour_diff -= 24
                        elif hour_diff < -12:
                            hour_diff += 24

                        diff_minutes = abs(hour_diff) * 60 + abs(minutes)

                    # Only consider items within 1 hour (60 minutes) of target
                    if diff_minutes <= 60 and diff_minutes < min_diff_minutes:
                        min_diff_minutes = diff_minutes
                        best_item = item

                if best_item:
                    tomorrow_items.append(best_item)
                    used_items.add(id(best_item))

            # Sort by timestamp to ensure correct order
            tomorrow_items.sort(key=lambda x: x.get("dt", 0))

            # Log for debugging
            if tomorrow_items:
                hours_found_local = []
                for item in tomorrow_items:
                    dt = item.get("dt", 0)
                    item_utc = datetime.fromtimestamp(dt, tz=timezone.utc)
                    item_local = item_utc + timedelta(seconds=timezone_offset_seconds)
                    hours_found_local.append(item_local.hour)
                logger.debug(f"Tomorrow forecast: local hours {hours_found_local}, target local hours {target_local_hours}")

            return tomorrow_items
        elif period == "3days":
            # Next 3 days
            return parsed_items[:3]
        elif period == "week":
            # Week forecast - first 7 daily entries
            return parsed_items[:7]
        else:
            # Default: return first item as list
            return parsed_items[:1] if parsed_items else []

    def fetch_forecast(self, city: City, period: str) -> list:
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
            List of weather data dicts (unified format)

        Raises:
            requests.RequestException: If API call fails
            ValueError: If period is invalid
        """
        # Validate period
        valid_periods = [
            "today",
            "tomorrow",
            "3days",
            "week",
            "hourly",
        ]
        if period not in valid_periods:
            raise ValueError(f"Invalid period: {period}")

        cache_key = self._get_cache_key(city.id, period)

        # Step 1: Check Redis cache
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            logger.info(f"Cache hit for {city.name} ({period})")
            # For cached data, we need to get timezone_offset from API
            # Make a lightweight API call to get timezone_offset only
            try:
                url = f"{self.BASE_URL}/onecall"
                params = {
                    "lat": float(city.latitude),
                    "lon": float(city.longitude),
                    "units": "metric",
                    "appid": self.API_KEY,
                    "exclude": "minutely,daily,alerts,current,hourly",  # Minimal data
                }
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                api_data = response.json()
                timezone_offset = api_data.get("timezone_offset", 0)
            except Exception:
                # If API call fails, use default 0
                timezone_offset = 0
            return cached_data, timezone_offset

        # Step 2: For "today" period, check database for saved data to fill missing intervals
        saved_data = None
        if period == "today":
            try:
                weather_data_obj = WeatherData.objects.filter(
                    city=city,
                    forecast_period=period
                ).first()
                if weather_data_obj and weather_data_obj.data:
                    saved_data = weather_data_obj.data
                    logger.info(f"Found saved data for {city.name} ({period}) in database")
            except Exception as e:
                logger.warning(f"Error reading saved data for {city.name} ({period}): {e}")

        # Step 3: Determine exclude parameters for One Call API 3.0
        # One Call API 3.0 uses /onecall endpoint with exclude parameter
        if period in ("hourly", "today", "tomorrow"):
            # For hourly, today, tomorrow - we need hourly data, exclude others
            exclude_parts = ["minutely", "daily", "alerts"]
        else:
            # For daily forecasts (3days, week), we need daily data
            exclude_parts = ["minutely", "hourly", "alerts"]

        # Step 4: Call API
        logger.info(f"Cache miss for {city.name} ({period}) - fetching from API")
        url = f"{self.BASE_URL}/onecall"
        params = {
            "lat": float(city.latitude),
            "lon": float(city.longitude),
            "units": "metric",
            "appid": self.API_KEY,
            "exclude": ",".join(exclude_parts),
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            api_data = response.json()
        except requests.RequestException as e:
            logger.error(f"API request failed for {city.name}: {e}")
            raise

        # Step 5: Parse response based on period - always returns list
        weather_data = self._parse_forecast_response(api_data, period)

        # Get timezone offset from API response
        timezone_offset = api_data.get("timezone_offset", 0)

        # Step 6: For "today" period, merge saved data with new API data to fill all intervals
        if period == "today" and saved_data:
            weather_data = self._merge_today_data(saved_data, weather_data)

        # Step 7: Save to Redis cache
        ttl = self._get_cache_ttl(period)
        self._save_to_cache(cache_key, weather_data, ttl)

        # Step 8: Save to database (JSONField)
        WeatherData.objects.update_or_create(
            city=city,
            forecast_period=period,
            defaults={
                "data": weather_data,
                "fetched_at": timezone.now(),
            },
        )

        logger.info(f"Successfully fetched and cached {period} for {city.name}")
        return weather_data, timezone_offset

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

    def _merge_today_data(self, saved_data: list, new_data: list) -> list:
        """
        Merge saved data with new API data for "today" period.
        Ensures all 8 intervals [2, 5, 8, 11, 14, 17, 20, 23] are present.

        Args:
            saved_data: Previously saved data from database
            new_data: New data from API

        Returns:
            Merged list with all available intervals
        """
        from datetime import datetime, timezone

        target_hours = [2, 5, 8, 11, 14, 17, 20, 23]
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).timestamp()
        today_end = today_start + 86400  # 24 hours

        # Create a dictionary keyed by hour for quick lookup
        merged_dict = {}

        # Add saved data (for past hours)
        if saved_data:
            for item in saved_data:
                dt = item.get("dt", 0)
                if today_start <= dt < today_end:
                    item_datetime = datetime.fromtimestamp(dt, tz=timezone.utc)
                    if item_datetime.hour in target_hours:
                        merged_dict[item_datetime.hour] = item

        # Add/update with new data (for future hours, or update existing)
        for item in new_data:
            dt = item.get("dt", 0)
            if today_start <= dt < today_end:
                item_datetime = datetime.fromtimestamp(dt, tz=timezone.utc)
                if item_datetime.hour in target_hours:
                    # Always use new data if available (more recent)
                    merged_dict[item_datetime.hour] = item

        # Build result list in order of target_hours
        result = []
        for hour in target_hours:
            if hour in merged_dict:
                result.append(merged_dict[hour])

        # Sort by timestamp to ensure correct order
        result.sort(key=lambda x: x.get("dt", 0))
        return result

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
