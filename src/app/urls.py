"""
URL configuration for app.
"""

from django.urls import path

from . import views

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
]
