"""
Test authentication flow manually.
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_auth():
    """Test authentication flow."""
    print("=" * 60)
    print("AUTHENTICATION DEBUG TEST")
    print("=" * 60)

    # Test 1: Registration
    print("\n1. Testing Registration...")
    register_data = {
        "email": "testauth@example.com",
        "username": "testauth",
        "password": "TestPass123",
        "password2": "TestPass123",
        "first_name": "Test",
        "last_name": "User",
    }

    try:
        response = requests.post(
            f"{BASE_URL}/auth/register/",
            json=register_data,
            headers={"Content-Type": "application/json"},
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 201:
            data = response.json()
            print(f"   ✅ Registration successful")
            print(f"   User ID: {data.get('user', {}).get('id')}")
            print(f"   Has tokens: {bool(data.get('tokens'))}")
            access_token = data.get("tokens", {}).get("access")
            refresh_token = data.get("tokens", {}).get("refresh")
            print(f"   Access token length: {len(access_token) if access_token else 0}")
            print(f"   Refresh token length: {len(refresh_token) if refresh_token else 0}")
        else:
            print(f"   ❌ Registration failed: {response.text}")
            return
    except Exception as e:
        print(f"   ❌ Registration error: {e}")
        return

    # Test 2: Login
    print("\n2. Testing Login...")
    login_data = {
        "email": "testauth@example.com",
        "password": "TestPass123",
    }

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login/",
            json=login_data,
            headers={"Content-Type": "application/json"},
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Login successful")
            access_token = data.get("tokens", {}).get("access")
            refresh_token = data.get("tokens", {}).get("refresh")
            print(f"   Access token length: {len(access_token) if access_token else 0}")
            print(f"   Refresh token length: {len(refresh_token) if refresh_token else 0}")

            # Test 3: Get user profile with token
            print("\n3. Testing Get User Profile (with token)...")
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            response = requests.get(
                f"{BASE_URL}/auth/me/",
                headers=headers,
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Profile retrieved successfully")
                print(f"   User email: {data.get('email')}")
                print(f"   User ID: {data.get('id')}")
            else:
                print(f"   ❌ Profile retrieval failed: {response.text}")
        else:
            print(f"   ❌ Login failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Login error: {e}")

    # Test 4: Login with invalid credentials
    print("\n4. Testing Login with invalid password...")
    login_data_invalid = {
        "email": "testauth@example.com",
        "password": "WrongPassword",
    }

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login/",
            json=login_data_invalid,
            headers={"Content-Type": "application/json"},
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            print(f"   ✅ Correctly rejected invalid password")
        else:
            print(f"   ❌ Should return 401, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_auth()

