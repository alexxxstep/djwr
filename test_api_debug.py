#!/usr/bin/env python
"""
Test script for API debugging.
Tests both external (OpenWeatherMap) and internal (Django REST) APIs.
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

import requests
from app.models import City
from app.services.weather_service import WeatherService

BASE_URL = "http://localhost:8000/api"


def test_internal_api():
    """Test internal Django REST API endpoints."""
    print("\n" + "=" * 60)
    print("TESTING INTERNAL API (Django REST)")
    print("=" * 60)

    # Get a city from database
    city = City.objects.first()
    if not city:
        print("❌ No cities in database. Please create a subscription first.")
        return

    print(f"\n✅ Using city: {city.name} (ID: {city.id})")

    # Test 1: Current weather
    print("\n1. Testing GET /api/weather/{city_id}/?period=current")
    try:
        response = requests.get(f"{BASE_URL}/weather/{city.id}/?period=current")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('items_count', 0)} items")
            print(f"   Period: {data.get('period')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

    # Test 2: Today forecast
    print("\n2. Testing GET /api/weather/{city_id}/?period=today")
    try:
        response = requests.get(f"{BASE_URL}/weather/{city.id}/?period=today")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('items_count', 0)} items")
            print(f"   Period: {data.get('period')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

    # Test 3: Hourly forecast
    print("\n3. Testing GET /api/weather/{city_id}/?period=hourly")
    try:
        response = requests.get(f"{BASE_URL}/weather/{city.id}/?period=hourly")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('items_count', 0)} items")
            print(f"   Period: {data.get('period')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

    # Test 4: Week forecast
    print("\n4. Testing GET /api/weather/{city_id}/?period=week")
    try:
        response = requests.get(f"{BASE_URL}/weather/{city.id}/?period=week")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('items_count', 0)} items")
            print(f"   Period: {data.get('period')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

    # Test 5: Weather history
    print("\n5. Testing GET /api/weather/{city_id}/history/")
    try:
        response = requests.get(f"{BASE_URL}/weather/{city.id}/history/")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('count', 0)} history entries")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

    # Test 6: City search
    print("\n6. Testing GET /api/cities/search/?q=Kyiv")
    try:
        response = requests.get(f"{BASE_URL}/cities/search/?q=Kyiv")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            count = data.get("count", len(data.get("results", [])))
            print(f"   ✅ Success: {count} cities found")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")


def test_external_api():
    """Test external OpenWeatherMap API via WeatherService."""
    print("\n" + "=" * 60)
    print("TESTING EXTERNAL API (OpenWeatherMap One Call API 3.0)")
    print("=" * 60)

    # Get a city from database
    city = City.objects.first()
    if not city:
        print("❌ No cities in database. Please create a subscription first.")
        return

    print(f"\n✅ Using city: {city.name} (ID: {city.id})")
    print(f"   Coordinates: {city.latitude}, {city.longitude}")

    weather_service = WeatherService()

    # Test 1: Current weather
    print("\n1. Testing fetch_current_weather()")
    try:
        data = weather_service.fetch_current_weather(city)
        print(f"   ✅ Success: {len(data)} items")
        if data:
            print(f"   Temperature: {data[0].get('temp', 'N/A')}°C")
            print(f"   Description: {data[0].get('description', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Test 2: Today forecast
    print("\n2. Testing fetch_forecast(city, 'today')")
    try:
        data = weather_service.fetch_forecast(city, "today")
        print(f"   ✅ Success: {len(data)} items")
        if data:
            print(f"   First item temp: {data[0].get('temp', 'N/A')}°C")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Test 3: Hourly forecast
    print("\n3. Testing fetch_forecast(city, 'hourly')")
    try:
        data = weather_service.fetch_forecast(city, "hourly")
        print(f"   ✅ Success: {len(data)} items")
        if data:
            print(f"   First item temp: {data[0].get('temp', 'N/A')}°C")
            print(f"   Last item temp: {data[-1].get('temp', 'N/A')}°C")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Test 4: Week forecast
    print("\n4. Testing fetch_forecast(city, 'week')")
    try:
        data = weather_service.fetch_forecast(city, "week")
        print(f"   ✅ Success: {len(data)} items")
        if data:
            print(f"   First item temp: {data[0].get('temp', 'N/A')}°C")
    except Exception as e:
        print(f"   ❌ Error: {e}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("API DEBUG TESTING SCRIPT")
    print("=" * 60)
    print("\nThis script tests both internal and external APIs.")
    print("All API calls will be logged to .cursor/debug.log")
    print("\nMake sure Django server is running on http://localhost:8000")

    try:
        test_internal_api()
        test_external_api()

        print("\n" + "=" * 60)
        print("TESTING COMPLETE")
        print("=" * 60)
        print("\n✅ Check .cursor/debug.log for detailed API call logs")
        print("   - INT_API: Internal Django REST API calls")
        print("   - EXT_API: External OpenWeatherMap API calls")
    except KeyboardInterrupt:
        print("\n\n❌ Testing interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Testing failed: {e}")
        import traceback

        traceback.print_exc()

