"""
URL configuration for app.
"""

from django.urls import path

from . import views
from .views import (
    CityDetailView,
    CityListView,
    SubscriptionDetailUpdateDeleteView,
    SubscriptionListCreateView,
    city_search_view,
    weather_history_view,
    weather_view,
)

app_name = "app"

urlpatterns = [
    # Authentication URLs
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/refresh/", views.RefreshTokenView.as_view(), name="refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.UserProfileView.as_view(), name="profile"),
    # OAuth URLs
    path(
        "auth/oauth/callback/<str:provider>/",
        views.oauth_callback,
        name="oauth-callback",
    ),
    path(
        "auth/oauth/providers/",
        views.oauth_providers,
        name="oauth-providers",
    ),
    path(
        "auth/oauth/link/<str:provider>/",
        views.oauth_link,
        name="oauth-link",
    ),
    path(
        "auth/oauth/disconnect/<str:provider>/",
        views.oauth_disconnect,
        name="oauth-disconnect",
    ),
    # City URLs
    path("cities/", CityListView.as_view(), name="city-list"),
    path("cities/<int:pk>/", CityDetailView.as_view(), name="city-detail"),
    path("cities/search/", city_search_view, name="city-search"),
    # Weather URLs
    path("weather/<int:city_id>/", weather_view, name="weather"),
    path(
        "weather/<int:city_id>/history/",
        weather_history_view,
        name="weather-history",
    ),
    # Subscription URLs
    path(
        "subscriptions/",
        SubscriptionListCreateView.as_view(),
        name="subscription-list-create",
    ),
    path(
        "subscriptions/<int:pk>/",
        SubscriptionDetailUpdateDeleteView.as_view(),
        name="subscription-detail-update-delete",
    ),
]
