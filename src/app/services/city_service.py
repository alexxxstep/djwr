"""
CityService: Business logic for city search and management.

This service implements database-first city search:
1. First searches local database (fast)
2. Falls back to API if not found
3. Creates new City records from API results
"""

import logging
from decimal import Decimal

from app.models import City
from app.services.weather_service import WeatherService

logger = logging.getLogger(__name__)


class CityService:
    """Service for city search and management."""

    def __init__(self):
        """Initialize CityService with WeatherService."""
        self.weather_service = WeatherService()

    def search_cities(self, query: str) -> list[City]:
        """
        Search cities using database-first approach.

        Strategy:
        1. First query local database (City.objects.filter(name__icontains=query))
        2. If cities found: Return database results immediately
        3. If not found: Call WeatherService.search_cities(query)
        4. For each city from API:
           - Check if city exists in database (by name + country)
           - If not exists: Create new City record using get_or_create
           - If exists: Use existing record
        5. Return list of City objects (all from database)

        Args:
            query: Search query (city name)

        Returns:
            List of City objects from database
        """
        if not query or not query.strip():
            return []

        query = query.strip()

        # Step 1: Search in local database first
        db_cities = City.objects.filter(name__icontains=query).order_by("name")
        if db_cities.exists():
            logger.info(f"Found {db_cities.count()} cities in DB for '{query}'")
            return list(db_cities)

        # Step 2: Not found in DB - search via API
        logger.info(f"City '{query}' not in DB, searching via API")
        try:
            api_cities = self.weather_service.search_cities(query)
        except Exception as e:
            logger.error(f"API search failed for '{query}': {e}")
            return []

        if not api_cities:
            logger.info(f"No cities found for '{query}'")
            return []

        # Step 3: Create City records from API results
        result_cities = []
        for city_data in api_cities:
            city, created = self.get_or_create_city(
                name=city_data["name"],
                country=city_data["country"],
                lat=city_data["lat"],
                lon=city_data["lon"],
            )
            result_cities.append(city)
            if created:
                logger.debug(f"Created new city: {city.name}, {city.country}")

        logger.info(f"Created/retrieved {len(result_cities)} cities for '{query}'")
        return result_cities

    def get_or_create_city(
        self, name: str, country: str, lat: float, lon: float
    ) -> tuple[City, bool]:
        """
        Get existing city or create new one.

        Uses unique_together constraint (name, country) to prevent duplicates.

        Args:
            name: City name
            country: Country name or code
            lat: Latitude
            lon: Longitude

        Returns:
            Tuple of (City object, created boolean)
        """
        city, created = City.objects.get_or_create(
            name=name,
            country=country,
            defaults={
                "latitude": Decimal(str(lat)),
                "longitude": Decimal(str(lon)),
            },
        )
        return city, created
