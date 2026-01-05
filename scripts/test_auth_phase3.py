#!/usr/bin/env python
"""
Script for testing Phase 3: Authentication endpoints in Debug Mode.

This script performs manual testing of authentication endpoints
and can be used to verify runtime behavior with debug logging.
"""

import json
import sys
import time

import requests

BASE_URL = "http://localhost:8000/api"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_step(step_num, description):
    """Print test step header."""
    print(f"\n{BLUE}=== Step {step_num}: {description} ==={RESET}")


def print_success(message):
    """Print success message."""
    print(f"{GREEN}✓ {message}{RESET}")


def print_error(message):
    """Print error message."""
    print(f"{RED}✗ {message}{RESET}")


def print_info(message):
    """Print info message."""
    print(f"{YELLOW}ℹ {message}{RESET}")


def test_registration():
    """Test user registration."""
    print_step(1, "User Registration")

    # Generate unique email and username using timestamp
    timestamp = int(time.time() * 1000)  # milliseconds
    unique_id = timestamp % 1000000  # Last 6 digits for readability

    data = {
        "email": f"debugtest{unique_id}@example.com",
        "username": f"debugtest{unique_id}",
        "password": "DebugTest123",
        "password2": "DebugTest123",
        "first_name": "Debug",
        "last_name": "Test",
    }

    print_info(f"POST {BASE_URL}/auth/register/")
    print_info(f"Data: {json.dumps(data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/register/",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 201:
            print_success("Registration successful!")
            return response.json()
        else:
            print_error(f"Registration failed: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None


def test_login(email, password):
    """Test user login."""
    print_step(2, "User Login")

    data = {"email": email, "password": password}

    print_info(f"POST {BASE_URL}/auth/login/")
    print_info(f"Data: {json.dumps(data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login/",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 200:
            print_success("Login successful!")
            return response.json()
        else:
            print_error(f"Login failed: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None


def test_profile(access_token):
    """Test getting user profile."""
    print_step(3, "Get User Profile")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    print_info(f"GET {BASE_URL}/auth/me/")
    print_info(f"Headers: Authorization: Bearer {access_token[:20]}...")

    try:
        response = requests.get(f"{BASE_URL}/auth/me/", headers=headers, timeout=10)

        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 200:
            print_success("Profile retrieved successfully!")
            return response.json()
        else:
            print_error(f"Profile retrieval failed: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None


def test_refresh_token(refresh_token):
    """Test token refresh."""
    print_step(4, "Refresh Access Token")

    data = {"refresh": refresh_token}

    print_info(f"POST {BASE_URL}/auth/refresh/")
    print_info(f"Data: {json.dumps(data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/refresh/",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print_info(f"Status Code: {response.status_code}")
        response_data = response.json()
        print_info(f"Response: {json.dumps(response_data, indent=2)}")

        if response.status_code == 200:
            print_success("Token refresh successful!")
            # Note: If ROTATE_REFRESH_TOKENS is True, a new refresh token is returned
            return response_data
        else:
            print_error(f"Token refresh failed: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None


def test_logout(refresh_token):
    """Test token logout."""
    print_step(5, "Logout (Blacklist Token)")

    data = {"refresh": refresh_token}

    print_info(f"POST {BASE_URL}/auth/logout/")
    print_info(f"Data: {json.dumps(data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/logout/",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 200:
            print_success("Logout successful!")
            return True
        else:
            print_error(f"Logout failed: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return False


def main():
    """Run all authentication tests."""
    print(f"{BLUE}{'=' * 60}")
    print("Phase 3: Authentication - Debug Mode Testing")
    print(f"{'=' * 60}{RESET}\n")

    # Test 1: Registration
    reg_result = test_registration()
    if not reg_result:
        print_error("Registration failed. Cannot continue.")
        sys.exit(1)

    email = reg_result["user"]["email"]
    password = "DebugTest123"
    access_token = reg_result["tokens"]["access"]
    refresh_token = reg_result["tokens"]["refresh"]

    print_success(f"Registered user: {email}")
    print_success(f"Access Token: {access_token[:30]}...")
    print_success(f"Refresh Token: {refresh_token[:30]}...")

    # Test 2: Login
    login_result = test_login(email, password)
    if not login_result:
        print_error("Login failed.")
    else:
        print_success("Login successful!")

    # Test 3: Get Profile
    profile_result = test_profile(access_token)
    if not profile_result:
        print_error("Profile retrieval failed.")

    # Test 4: Refresh Token
    refresh_result = test_refresh_token(refresh_token)
    new_refresh_token = refresh_token  # Keep original for logout test
    if refresh_result:
        new_access_token = refresh_result.get("access")
        # Get new refresh token if rotation is enabled
        new_refresh_token = refresh_result.get("refresh", refresh_token)
        print_success(f"New Access Token: {new_access_token[:30]}...")
        if new_refresh_token != refresh_token:
            print_info("Refresh token was rotated (new token received)")

    # Test 5: Logout
    # Note: If ROTATE_REFRESH_TOKENS is True, the original refresh_token
    # is blacklisted after refresh, so we need to use a fresh token
    # For testing logout, we'll use a token from login (not from refresh)
    logout_token = (
        login_result.get("tokens", {}).get("refresh", refresh_token)
        if login_result
        else refresh_token
    )
    logout_success = test_logout(logout_token)
    if logout_success:
        # Verify token is blacklisted
        print_info("Verifying token is blacklisted...")
        verify_result = test_refresh_token(refresh_token)
        if verify_result is None or verify_result.get("access") is None:
            print_success("Token successfully blacklisted!")
        else:
            print_error("Token was NOT blacklisted!")

    print(f"\n{BLUE}{'=' * 60}")
    print("Testing Complete!")
    print(f"{'=' * 60}{RESET}\n")
    print_info("Check debug.log file for detailed runtime logs")
    print_info(
        "Log path: h:\\DEV\\Projects\\_FOXMIND\\Python_Web\\task16_weather\\_djwr\\.cursor\\debug.log"
    )


if __name__ == "__main__":
    main()
