# OpenWeatherMap API Integration Guide

## Overview

This document provides detailed instructions for integrating OpenWeatherMap API into DjangoWeatherReminder project. It covers API registration, endpoints, usage patterns, error handling, and implementation examples.

**Reference:** [OpenWeatherMap API Documentation](https://openweathermap.org/api)

---

## Table of Contents

1. [API Registration](#api-registration)
2. [Available API Plans](#available-api-plans)
3. [API Endpoints](#api-endpoints)
4. [Implementation in WeatherService](#implementation-in-weatherservice)
5. [Error Handling](#error-handling)
6. [Rate Limits and Best Practices](#rate-limits-and-best-practices)
7. [Code Examples](#code-examples)

---

## API Registration

### Step 1: Create Account

1. Go to [OpenWeatherMap Sign Up](https://home.openweathermap.org/users/sign_up)
2. Create a free account
3. Verify your email address

### Step 2: Get API Key

1. Log in to your account
2. Navigate to [API Keys](https://home.openweathermap.org/api_keys)
3. Generate a new API key (or use default key)
4. **Important**: API key activation may take 10-60 minutes

### Step 3: Add API Key to Project

Add to `.env` file:

```env
WEATHER_API_KEY=your-api-key-here
WEATHER_API_URL=https://api.openweathermap.org/data/2.5
```

---

## Available API Plans

### Option 1: Free Tier (Recommended for MVP)

**Limits:**

- 60 calls/minute
- 1,000,000 calls/month
- No credit card required

**Available Endpoints:**

- Current Weather API (`/weather`)
- 5-Day Forecast API (`/forecast`) - 3-hour intervals
- Hourly Forecast API (`/forecast/hourly`) - 48 hours
- Geocoding API (`/geo/1.0/direct`) - City search

**Best for:** Development, testing, small-scale production

### Option 2: One Call API 3.0 (Advanced)

**Subscription:** "One Call by Call" (separate subscription)

- 1,000 calls/day free
- Pay only for calls made
- No other subscription required

**Available Endpoints:**

- Current weather + forecasts (minute, hourly, daily)
- Weather data for timestamp (historical + forecast)
- Daily aggregation
- Weather overview (AI-powered)
- AI Weather Assistant

**Important Notes:**

- **One Call API 3.0 does NOT include city search by name**
- **Requires coordinates (lat, lon) as mandatory parameters**
- **For city search, you MUST use separate Geocoding API** (`/geo/1.0/direct`)
- Geocoding API is available in Free Tier and works with One Call API 3.0

**Workflow with One Call API 3.0:**

1. User searches city name → Use **Geocoding API** to get coordinates
2. Use coordinates → Call **One Call API 3.0** to get weather data

**Best for:** Production with advanced features, historical data

**Note:** One Call API 3.0 requires separate subscription. For this project, we use **Free Tier** endpoints.

**Reference:** [One Call API 3.0 Documentation](https://openweathermap.org/api/one-call-3#concept)

---

## API Endpoints

**Note:** All weather endpoints (Current Weather, Forecast, Hourly Forecast, One Call API 3.0) require **coordinates (lat, lon)** as parameters. They do NOT support city name search directly. For city search, use **Geocoding API** (see section 4 below).

### 1. Current Weather API

**Endpoint:** `GET /data/2.5/weather`

**Purpose:** Get current weather data for a city

**Parameters:**

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `appid` (required): API key
- `units` (optional): `standard`, `metric`, `imperial` (default: `standard`)
- `lang` (optional): Language code (e.g., `en`, `uk`, `ru`)

**Example Request:**

```http
GET https://api.openweathermap.org/data/2.5/weather?lat=50.4501&lon=30.5234&units=metric&appid={API_KEY}
```

**Example Response:**

```json
{
  "coord": {
    "lon": 30.5234,
    "lat": 50.4501
  },
  "weather": [
    {
      "id": 800,
      "main": "Clear",
      "description": "clear sky",
      "icon": "01d"
    }
  ],
  "base": "stations",
  "main": {
    "temp": 15.5,
    "feels_like": 14.8,
    "temp_min": 13.2,
    "temp_max": 17.8,
    "pressure": 1013,
    "humidity": 65
  },
  "visibility": 10000,
  "wind": {
    "speed": 3.2,
    "deg": 180
  },
  "clouds": {
    "all": 0
  },
  "dt": 1699123456,
  "sys": {
    "type": 1,
    "id": 8902,
    "country": "UA",
    "sunrise": 1699081234,
    "sunset": 1699123456
  },
  "timezone": 7200,
  "id": 703448,
  "name": "Kyiv",
  "cod": 200
}
```

**Use Case in Project:**

- `fetch_current_weather(city)` method
- Forecast period: `current`
- Cache TTL: 10 minutes

---

### 2. 5-Day Forecast API

**Endpoint:** `GET /data/2.5/forecast`

**Purpose:** Get 5-day weather forecast with 3-hour intervals

**Parameters:**

- `lat` (required): Latitude
- `lon` (required): Longitude
- `appid` (required): API key
- `units` (optional): `standard`, `metric`, `imperial`
- `lang` (optional): Language code
- `cnt` (optional): Number of timestamps (default: 40, max: 40)

**Example Request:**

```http
GET https://api.openweathermap.org/data/2.5/forecast?lat=50.4501&lon=30.5234&units=metric&appid={API_KEY}
```

**Example Response:**

```json
{
  "cod": "200",
  "message": 0,
  "cnt": 40,
  "list": [
    {
      "dt": 1699123456,
      "main": {
        "temp": 15.5,
        "feels_like": 14.8,
        "temp_min": 13.2,
        "temp_max": 17.8,
        "pressure": 1013,
        "sea_level": 1013,
        "grnd_level": 1005,
        "humidity": 65,
        "temp_kf": 0.5
      },
      "weather": [
        {
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }
      ],
      "clouds": {
        "all": 0
      },
      "wind": {
        "speed": 3.2,
        "deg": 180,
        "gust": 5.1
      },
      "visibility": 10000,
      "pop": 0,
      "sys": {
        "pod": "d"
      },
      "dt_txt": "2024-11-04 12:00:00"
    },
    ...
  ],
  "city": {
    "id": 703448,
    "name": "Kyiv",
    "coord": {
      "lat": 50.4501,
      "lon": 30.5234
    },
    "country": "UA",
    "population": 2967000,
    "timezone": 7200,
    "sunrise": 1699081234,
    "sunset": 1699123456
  }
}
```

**Use Case in Project:**

- `fetch_forecast(city, period)` method
- Forecast periods: `today`, `tomorrow`, `3days`, `week`
- Filter forecast data by period:
  - `today`: Filter by current day
  - `tomorrow`: Filter by next day
  - `3days`: Filter first 3 days
  - `week`: Filter first 7 days (or available days)
- Cache TTL: 30-60 minutes (depending on period)

---

### 3. Hourly Forecast API

**Endpoint:** `GET /data/2.5/forecast/hourly`

**Purpose:** Get 48-hour hourly weather forecast

**Parameters:**

- `lat` (required): Latitude
- `lon` (required): Longitude
- `appid` (required): API key
- `units` (optional): `standard`, `metric`, `imperial`
- `lang` (optional): Language code
- `cnt` (optional): Number of timestamps (default: 48, max: 96)

**Example Request:**

```http
GET https://api.openweathermap.org/data/2.5/forecast/hourly?lat=50.4501&lon=30.5234&units=metric&appid={API_KEY}
```

**Example Response:**

```json
{
  "cod": "200",
  "message": 0,
  "cnt": 48,
  "list": [
    {
      "dt": 1699123456,
      "main": {
        "temp": 15.5,
        "feels_like": 14.8,
        "temp_min": 13.2,
        "temp_max": 17.8,
        "pressure": 1013,
        "humidity": 65
      },
      "weather": [
        {
          "id": 800,
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        }
      ],
      "clouds": {
        "all": 0
      },
      "wind": {
        "speed": 3.2,
        "deg": 180
      },
      "visibility": 10000,
      "pop": 0,
      "dt_txt": "2024-11-04 12:00:00"
    },
    ...
  ]
}
```

**Use Case in Project:**

- `fetch_forecast(city, period='hourly')` method
- Forecast period: `hourly`
- Cache TTL: 15 minutes

---

### 4. Geocoding API

**Endpoint:** `GET /geo/1.0/direct`

**Purpose:** Search cities by name and get coordinates

**Important:** This is a **separate API** that works with both Free Tier and One Call API 3.0. One Call API 3.0 does NOT include city search - you must use Geocoding API.

**Parameters:**

- `q` (required): City name, state code, country code (e.g., "Kyiv", "Kyiv,UA")
- `limit` (optional): Number of results (default: 5, max: 5)
- `appid` (required): API key

**Example Request:**

```http
GET https://api.openweathermap.org/geo/1.0/direct?q=Kyiv&limit=5&appid={API_KEY}
```

**Example Response:**

```json
[
  {
    "name": "Kyiv",
    "local_names": {
      "uk": "Київ",
      "ru": "Киев"
    },
    "lat": 50.4501,
    "lon": 30.5234,
    "country": "UA",
    "state": "Kyiv"
  },
  {
    "name": "Kyiv",
    "lat": 38.1234,
    "lon": -85.5678,
    "country": "US",
    "state": "Kentucky"
  }
]
```

**Use Case in Project:**

- `search_cities(query)` method in WeatherService
- Used by CityService when city not found in database
- Results saved to City model for future use
- **Required for One Call API 3.0** - get coordinates before calling weather endpoint

**Workflow:**

1. User searches "Kyiv" → Geocoding API returns coordinates
2. Use coordinates → Call weather API (Free Tier or One Call API 3.0)

---

## Implementation in WeatherService

### WeatherService Class Structure

```python
# src/app/services/weather_service.py

from typing import Dict, Optional, List
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
import requests
import redis
import json
from app.models import City, WeatherData

class WeatherService:
    """Service for fetching weather data from OpenWeatherMap API."""

    BASE_URL = settings.WEATHER_API_URL  # https://api.openweathermap.org/data/2.5
    API_KEY = settings.WEATHER_API_KEY
    GEOCODING_URL = "https://api.openweathermap.org/geo/1.0/direct"

    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)

    def _get_cache_key(self, city_id: int, period: str) -> str:
        """Generate Redis cache key."""
        return f"weather:{city_id}:{period}"

    def _get_cache_ttl(self, period: str) -> int:
        """Get TTL in seconds based on forecast period."""
        ttl_map = {
            "current": 600,      # 10 minutes
            "today": 1800,       # 30 minutes
            "tomorrow": 1800,    # 30 minutes
            "3days": 3600,       # 60 minutes
            "week": 3600,        # 60 minutes
            "hourly": 900,       # 15 minutes
            "10days": 7200,      # 120 minutes
            "2weeks": 7200,      # 120 minutes
            "month": 7200,       # 120 minutes
        }
        return ttl_map.get(period, 600)

    def _get_from_cache(self, cache_key: str) -> Optional[Dict]:
        """Retrieve data from Redis cache."""
        try:
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            # Log error but don't fail
            print(f"Cache read error: {e}")
        return None

    def _save_to_cache(self, cache_key: str, data: Dict, ttl: int):
        """Save data to Redis cache with TTL."""
        try:
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(data, default=str)
            )
        except Exception as e:
            # Log error but don't fail
            print(f"Cache write error: {e}")

    def fetch_current_weather(self, city: City) -> Dict:
        """
        Fetch current weather for a city.

        Args:
            city: City model instance with coordinates

        Returns:
            Dictionary with weather data
        """
        cache_key = self._get_cache_key(city.id, "current")

        # Check cache first
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        # Fetch from API
        url = f"{self.BASE_URL}/weather"
        params = {
            "lat": float(city.latitude),
            "lon": float(city.longitude),
            "units": "metric",
            "appid": self.API_KEY
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Parse and format response
        weather_data = self._parse_current_response(data)

        # Save to cache
        ttl = self._get_cache_ttl("current")
        self._save_to_cache(cache_key, weather_data, ttl)

        # Save to database
        self._save_to_database(city, "current", weather_data)

        return weather_data

    def fetch_forecast(self, city: City, period: str = "current") -> Dict:
        """
        Fetch weather forecast for a city and period.

        Args:
            city: City model instance
            period: Forecast period (current, today, tomorrow, 3days, week, hourly)

        Returns:
            Dictionary with forecast data
        """
        if period == "current":
            return self.fetch_current_weather(city)

        cache_key = self._get_cache_key(city.id, period)

        # Check cache first
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        # Determine API endpoint based on period
        if period == "hourly":
            url = f"{self.BASE_URL}/forecast/hourly"
            params = {
                "lat": float(city.latitude),
                "lon": float(city.longitude),
                "units": "metric",
                "appid": self.API_KEY,
                "cnt": 48  # 48 hours
            }
        else:
            url = f"{self.BASE_URL}/forecast"
            params = {
                "lat": float(city.latitude),
                "lon": float(city.longitude),
                "units": "metric",
                "appid": self.API_KEY,
                "cnt": 40  # 5 days, 3-hour intervals
            }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Parse and filter by period
        weather_data = self._parse_forecast_response(data, period)

        # Save to cache
        ttl = self._get_cache_ttl(period)
        self._save_to_cache(cache_key, weather_data, ttl)

        # Save to database
        self._save_to_database(city, period, weather_data)

        return weather_data

    def search_cities(self, query: str) -> List[Dict]:
        """
        Search cities via Geocoding API.

        Args:
            query: City name to search

        Returns:
            List of city dictionaries with name, country, lat, lon
        """
        url = self.GEOCODING_URL
        params = {
            "q": query,
            "limit": 5,
            "appid": self.API_KEY
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        return self._parse_geocoding_response(data)

    def _parse_current_response(self, data: Dict) -> Dict:
        """Parse current weather API response."""
        return {
            "temperature": Decimal(str(data["main"]["temp"])),
            "feels_like": Decimal(str(data["main"]["feels_like"])),
            "humidity": data["main"]["humidity"],
            "pressure": data["main"]["pressure"],
            "wind_speed": Decimal(str(data["wind"]["speed"])),
            "description": data["weather"][0]["description"],
            "icon": data["weather"][0]["icon"],
            "fetched_at": timezone.now().isoformat()
        }

    def _parse_forecast_response(self, data: Dict, period: str) -> Dict:
        """Parse forecast API response and filter by period."""
        from datetime import datetime, timedelta
        from django.utils import timezone

        now = timezone.now()
        forecast_list = data.get("list", [])

        # Filter by period
        if period == "today":
            # Get forecasts for today
            filtered = [
                item for item in forecast_list
                if self._is_today(item["dt"])
            ]
        elif period == "tomorrow":
            # Get forecasts for tomorrow
            filtered = [
                item for item in forecast_list
                if self._is_tomorrow(item["dt"])
            ]
        elif period == "3days":
            # Get forecasts for next 3 days
            filtered = forecast_list[:24]  # ~3 days (8 forecasts per day)
        elif period == "week":
            # Get forecasts for next week
            filtered = forecast_list  # All available (5 days)
        elif period == "hourly":
            # Hourly forecast (already hourly)
            filtered = forecast_list[:24]  # First 24 hours
        else:
            filtered = forecast_list

        # Extract main forecast data (average or first item)
        if filtered:
            main_item = filtered[0]
            return {
                "temperature": Decimal(str(main_item["main"]["temp"])),
                "feels_like": Decimal(str(main_item["main"]["feels_like"])),
                "humidity": main_item["main"]["humidity"],
                "pressure": main_item["main"]["pressure"],
                "wind_speed": Decimal(str(main_item["wind"]["speed"])),
                "description": main_item["weather"][0]["description"],
                "icon": main_item["weather"][0]["icon"],
                "forecast_items": filtered,  # Full forecast list
                "fetched_at": timezone.now().isoformat()
            }

        return {}

    def _parse_geocoding_response(self, data: List[Dict]) -> List[Dict]:
        """Parse Geocoding API response."""
        cities = []
        for item in data:
            cities.append({
                "name": item["name"],
                "country": item.get("country", ""),
                "lat": Decimal(str(item["lat"])),
                "lon": Decimal(str(item["lon"]))
            })
        return cities

    def _save_to_database(self, city: City, period: str, weather_data: Dict):
        """Save weather data to database."""
        WeatherData.objects.update_or_create(
            city=city,
            forecast_period=period,
            defaults={
                "temperature": weather_data.get("temperature"),
                "feels_like": weather_data.get("feels_like"),
                "humidity": weather_data.get("humidity"),
                "pressure": weather_data.get("pressure"),
                "wind_speed": weather_data.get("wind_speed"),
                "description": weather_data.get("description", ""),
                "icon": weather_data.get("icon", ""),
                "fetched_at": timezone.now()
            }
        )

    def _is_today(self, timestamp: int) -> bool:
        """Check if timestamp is today."""
        from django.utils import timezone
        from datetime import datetime
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        today = timezone.now().date()
        return dt.date() == today

    def _is_tomorrow(self, timestamp: int) -> bool:
        """Check if timestamp is tomorrow."""
        from django.utils import timezone
        from datetime import datetime, timedelta
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        tomorrow = (timezone.now() + timedelta(days=1)).date()
        return dt.date() == tomorrow
```

---

## Error Handling

### Common API Errors

#### 400 - Bad Request

**Causes:**

- Missing required parameters (`lat`, `lon`, `appid`)
- Invalid parameter format or values out of range
- Invalid date format (for historical data)

**Example Response:**

```json
{
  "cod": 400,
  "message": "Invalid date format",
  "parameters": ["date"]
}
```

**Handling:**

```python
try:
    response = requests.get(url, params=params)
    response.raise_for_status()
except requests.HTTPError as e:
    if response.status_code == 400:
        error_data = response.json()
        logger.error(f"Bad request: {error_data.get('message')}")
        raise ValueError(f"Invalid request: {error_data.get('message')}")
```

---

#### 401 - Unauthorized

**Causes:**

- Missing API key
- Invalid API key
- API key not activated yet (wait 10-60 minutes)

**Example Response:**

```json
{
  "cod": 401,
  "message": "Invalid API key. Please see https://openweathermap.org/faq#error401 for more info."
}
```

**Handling:**

```python
except requests.HTTPError as e:
    if response.status_code == 401:
        logger.error("Invalid API key")
        # Notify admin
        raise ValueError("API authentication failed. Check WEATHER_API_KEY in settings.")
```

---

#### 404 - Not Found

**Causes:**

- City not found (invalid coordinates)
- Historical data not available for requested date

**Example Response:**

```json
{
  "cod": "404",
  "message": "city not found"
}
```

**Handling:**

```python
except requests.HTTPError as e:
    if response.status_code == 404:
        logger.warning(f"City not found: {city.name}")
        raise ValueError(f"Weather data not found for {city.name}")
```

---

#### 429 - Too Many Requests

**Causes:**

- Rate limit exceeded (60 calls/minute for free tier)
- Monthly quota exceeded

**Example Response:**

```json
{
  "cod": 429,
  "message": "Your account is temporary blocked due to exceeding of requests limitation of your subscription type."
}
```

**Handling:**

```python
except requests.HTTPError as e:
    if response.status_code == 429:
        logger.warning("Rate limit exceeded, using cached data")
        # Return cached data if available
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        # Retry with exponential backoff
        raise Exception("Rate limit exceeded, retry later")
```

---

#### 5xx - Server Errors

**Causes:**

- OpenWeatherMap server issues
- Temporary service unavailability

**Handling:**

```python
except requests.HTTPError as e:
    if 500 <= response.status_code < 600:
        logger.error(f"OpenWeatherMap server error: {e}")
        # Use cached data if available
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        # Retry after delay
        raise Exception("Weather service temporarily unavailable")
```

---

### Network Errors

**Handling:**

```python
import requests
from requests.exceptions import RequestException, Timeout

try:
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
except Timeout:
    logger.error("API request timeout")
    # Use cached data
    cached = self._get_from_cache(cache_key)
    if cached:
        return cached
    raise Exception("API request timeout")
except RequestException as e:
    logger.error(f"Network error: {e}")
    # Use cached data
    cached = self._get_from_cache(cache_key)
    if cached:
        return cached
    raise Exception(f"Network error: {e}")
```

---

## Rate Limits and Best Practices

### Free Tier Limits

- **60 calls/minute** - Maximum requests per minute
- **1,000,000 calls/month** - Monthly quota

### Rate Limit Strategy

1. **Use Redis Caching** (Required)

   - Cache current weather: 10 minutes
   - Cache forecasts: 30-60 minutes
   - Reduces API calls by 70-90%

2. **Database-First City Search**

   - Search local database first
   - Only call Geocoding API if city not found
   - Cities cached after first search

3. **Batch Processing**

   - Process multiple subscriptions together
   - Share cached weather data for same city/period

4. **Error Handling**
   - Use cached data when API unavailable
   - Implement exponential backoff for retries
   - Log rate limit warnings

### Best Practices

1. **Always use caching** - Check Redis before API calls
2. **Handle errors gracefully** - Fallback to cached data
3. **Monitor API usage** - Track calls per minute/day
4. **Use appropriate TTL** - Balance freshness vs API calls
5. **Respect rate limits** - Implement backoff on 429 errors
6. **Log API calls** - Track cache hits/misses for optimization

---

## Code Examples

### Example 1: Fetch Current Weather

```python
from app.models import City
from app.services.weather_service import WeatherService

# Get city
city = City.objects.get(name="Kyiv", country="UA")

# Fetch current weather
service = WeatherService()
weather = service.fetch_current_weather(city)

print(f"Temperature: {weather['temperature']}°C")
print(f"Description: {weather['description']}")
```

### Example 2: Fetch Forecast for Period

```python
# Fetch tomorrow's forecast
forecast = service.fetch_forecast(city, period="tomorrow")

print(f"Tomorrow's temperature: {forecast['temperature']}°C")
print(f"Forecast items: {len(forecast.get('forecast_items', []))}")
```

### Example 3: Search Cities

```python
# Search cities
cities = service.search_cities("Kyiv")

for city_data in cities:
    print(f"{city_data['name']}, {city_data['country']}")
    print(f"Coordinates: {city_data['lat']}, {city_data['lon']}")
```

### Example 4: Using in Celery Task

```python
# src/app/tasks.py
from celery import shared_task
from app.models import City
from app.services.weather_service import WeatherService

@shared_task(autoretry_for=(Exception,), max_retries=3)
def fetch_weather_data(city_id: int, forecast_period: str = "current"):
    """Fetch weather data for a city."""
    try:
        city = City.objects.get(pk=city_id)
        service = WeatherService()
        weather = service.fetch_forecast(city, forecast_period)
        return weather
    except City.DoesNotExist:
        logger.error(f"City {city_id} not found")
        raise
    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        raise
```

---

## Units of Measurement

OpenWeatherMap supports three unit systems:

- **standard**: Kelvin temperature, meters/second wind speed
- **metric**: Celsius temperature, meters/second wind speed (recommended)
- **imperial**: Fahrenheit temperature, miles/hour wind speed

**Project uses:** `metric` (Celsius, m/s)

---

## Language Support

Use `lang` parameter to get weather descriptions in different languages:

- `en` - English (default)
- `uk` - Ukrainian
- `ru` - Russian
- `de` - German
- `fr` - French
- [Full list](https://openweathermap.org/api/one-call-3#multi)

**Example:**

```http
GET /weather?lat=50.4501&lon=30.5234&lang=uk&appid={API_KEY}
```

**Response:**

```json
{
  "weather": [
    {
      "description": "ясне небо" // Ukrainian
    }
  ]
}
```

---

## Weather Icons

OpenWeatherMap provides weather icons:

**Icon URL format:**

```text
https://openweathermap.org/img/wn/{icon}@2x.png
```

**Icon codes:**

- `01d`, `01n` - Clear sky
- `02d`, `02n` - Few clouds
- `03d`, `03n` - Scattered clouds
- `04d`, `04n` - Broken clouds
- `09d`, `09n` - Shower rain
- `10d`, `10n` - Rain
- `11d`, `11n` - Thunderstorm
- `13d`, `13n` - Snow
- `50d`, `50n` - Mist

**Use in project:**

- Store icon code in WeatherData.icon field
- Display icon in frontend using OpenWeatherMap CDN or local assets

---

## Migration to One Call API 3.0 (Optional)

If you need advanced features, consider migrating to One Call API 3.0:

**Advantages:**

- Single endpoint for all forecast types
- Minute-by-minute forecast (1 hour)
- Daily forecast (8 days)
- Weather alerts
- Historical data access

**Important:** One Call API 3.0 does NOT provide city search functionality. You still need to use Geocoding API for city search.

**Migration Steps:**

1. Subscribe to "One Call by Call" plan
2. Update API endpoint: `/data/3.0/onecall`
3. Update WeatherService to use new endpoint
4. Adjust response parsing for new format
5. **Keep Geocoding API integration** for city search (unchanged)

**Example Workflow:**

```python
# Step 1: Search city (still uses Geocoding API)
cities = weather_service.search_cities("Kyiv")  # Uses /geo/1.0/direct
city = cities[0]

# Step 2: Get weather (uses One Call API 3.0)
weather = weather_service.fetch_forecast_onecall(city)  # Uses /data/3.0/onecall
```

**Reference:** [One Call API 3.0 Documentation](https://openweathermap.org/api/one-call-3#concept)

---

## Troubleshooting

### API Key Not Working

1. Wait 10-60 minutes after registration (activation delay)
2. Verify API key in account settings
3. Check API key is correctly set in `.env`
4. Verify key has access to required endpoints

### Rate Limit Exceeded

1. Check Redis caching is working
2. Verify cache TTL settings
3. Monitor API calls per minute
4. Consider upgrading to paid plan if needed

### City Not Found

1. Verify coordinates are correct
2. Try different city name variations
3. Use country code in search: "Kyiv,UA"
4. Check Geocoding API response

### Network Timeouts

1. Increase timeout value (default: 10 seconds)
2. Implement retry logic with backoff
3. Use cached data as fallback
4. Check network connectivity

---

## Additional Resources

- [OpenWeatherMap API Documentation](https://openweathermap.org/api)
- [One Call API 3.0 Documentation](https://openweathermap.org/api/one-call-3#concept)
- [Geocoding API Documentation](https://openweathermap.org/api/geocoding-api)
- [API Pricing](https://openweathermap.org/price)
- [FAQ](https://openweathermap.org/faq)
- [Support](https://openweathermap.org/appid)

---

## Summary

This guide covers:

✅ API registration and key setup
✅ Available endpoints and their usage
✅ Implementation in WeatherService
✅ Error handling strategies
✅ Rate limits and caching
✅ Code examples
✅ Best practices

**Key Points:**

- Always use Redis caching to reduce API calls
- Handle all error codes gracefully
- Use database-first approach for city search
- Monitor API usage to stay within limits
- Cache weather data with appropriate TTL based on period
