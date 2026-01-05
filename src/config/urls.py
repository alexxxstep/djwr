"""
URL configuration for DjangoWeatherReminder project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.shortcuts import render
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from app.views import WeatherView

urlpatterns = [
    # Main weather page (must be before social_django.urls)
    path("", WeatherView.as_view(), name="weather"),
    path("admin/", admin.site.urls),
    path("api/", include("app.urls")),
    # Frontend test page
    path(
        "test-frontend/",
        lambda request: render(request, "test_frontend.html"),
        name="test_frontend",
    ),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    # Social Auth URLs (must be after main page)
    path("", include("social_django.urls", namespace="social")),
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # Django Debug Toolbar
    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [
            path("__debug__/", include("debug_toolbar.urls")),
        ]
