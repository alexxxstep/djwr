#!/usr/bin/env python
"""
Script to verify DjangoWeatherReminder setup.
Run this script to check if all components are configured correctly.
"""
import os
import sys
from pathlib import Path

# Add project root to Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

def check_python_version():
    """Check Python version."""
    print("✓ Checking Python version...")
    if sys.version_info < (3, 12):
        print(f"  ✗ Python 3.12+ required, found {sys.version}")
        return False
    print(f"  ✓ Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    return True

def check_django_import():
    """Check if Django can be imported."""
    print("\n✓ Checking Django import...")
    try:
        import django
        print(f"  ✓ Django {django.get_version()}")
        return True
    except ImportError:
        print("  ✗ Django not installed")
        return False

def check_settings():
    """Check Django settings."""
    print("\n✓ Checking Django settings...")
    try:
        from django.conf import settings
        print(f"  ✓ SECRET_KEY: {'Set' if settings.SECRET_KEY else 'Not set'}")
        print(f"  ✓ DEBUG: {settings.DEBUG}")
        print(f"  ✓ INSTALLED_APPS: {len(settings.INSTALLED_APPS)} apps")
        print(f"  ✓ DATABASES: {settings.DATABASES['default'].get('ENGINE', 'Not configured')}")
        return True
    except Exception as e:
        print(f"  ✗ Error loading settings: {e}")
        return False

def check_structure():
    """Check project structure."""
    print("\n✓ Checking project structure...")
    required_dirs = [
        "src/config",
        "src/app",
        "src/templates",
        "tests",
        "frontend/src/js",
        "frontend/src/css",
    ]
    all_exist = True
    for dir_path in required_dirs:
        full_path = BASE_DIR / dir_path
        if full_path.exists():
            print(f"  ✓ {dir_path}/")
        else:
            print(f"  ✗ {dir_path}/ (missing)")
            all_exist = False
    return all_exist

def check_files():
    """Check required files."""
    print("\n✓ Checking required files...")
    required_files = [
        "manage.py",
        "pyproject.toml",
        "docker-compose.yml",
        "src/config/settings.py",
        "src/config/urls.py",
        "src/config/celery.py",
        "src/app/urls.py",
        "tests/conftest.py",
    ]
    all_exist = True
    for file_path in required_files:
        full_path = BASE_DIR / file_path
        if full_path.exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} (missing)")
            all_exist = False
    return all_exist

def main():
    """Run all checks."""
    print("=" * 60)
    print("DjangoWeatherReminder - Setup Verification")
    print("=" * 60)

    checks = [
        check_python_version(),
        check_django_import(),
        check_settings(),
        check_structure(),
        check_files(),
    ]

    print("\n" + "=" * 60)
    if all(checks):
        print("✓ All checks passed! Setup looks good.")
        print("\nNext steps:")
        print("  1. Install dependencies: uv pip install .")
        print("  2. Run migrations: python manage.py migrate")
        print("  3. Create superuser: python manage.py createsuperuser")
        print("  4. Start services: docker-compose up")
        return 0
    else:
        print("✗ Some checks failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

