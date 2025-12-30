# DjangoWeatherReminder

A weather notification service that allows users to subscribe to weather updates for multiple cities with customizable notification frequencies and forecast periods.

## Features

- 🌍 **City Subscriptions** - Subscribe to weather updates for multiple cities
- ⏰ **Flexible Notifications** - Choose notification frequency (1, 3, 6, or 12 hours)
- 📊 **Multiple Forecast Periods** - Get weather for current, today, tomorrow, 3 days, week, and more
- 📧 **Multiple Notification Types** - Receive notifications via email, webhook, or both
- 🔐 **Authentication** - JWT-based API authentication + OAuth (Google, GitHub)
- 🔄 **Automated Scheduling** - Celery Beat handles periodic weather fetching and notifications
- 🗄️ **Smart Caching** - Database-first city search with API fallback for optimal performance

## Tech Stack

| Component    | Technology                                      |
| ------------ | ----------------------------------------------- |
| Backend      | Python 3.12+, Django 5.x, Django REST Framework |
| Database     | PostgreSQL 16                                   |
| Cache/Broker | Redis                                           |
| Task Queue   | Celery + Celery Beat                            |
| Auth         | JWT (djangorestframework-simplejwt) + OAuth     |
| Frontend     | Webpack, Tailwind CSS, ES6 Modules              |
| Weather API  | OpenWeatherMap (Free tier)                      |
| Container    | Docker + Docker Compose                         |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OpenWeatherMap API key ([Get one here](https://openweathermap.org/api))

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd _djwr
```

2. Create `.env` file with required variables (see [Environment Variables](#environment-variables))

3. Start services with Docker Compose:

```bash
docker-compose up -d
```

4. Run migrations:

```bash
docker-compose exec web python manage.py migrate
```

5. Create superuser (optional):

```bash
docker-compose exec web python manage.py createsuperuser
```

6. Access the application:
   - API: http://localhost:8000/api/
   - Admin: http://localhost:8000/admin/

## Environment Variables

Key environment variables (see full list in [documentation](docs/WEATHER_REMINDER_PLAN.md#environment-variables)):

```env
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=postgres://user:pass@db:5432/weather_reminder
REDIS_URL=redis://redis:6379/0
WEATHER_API_KEY=your-openweathermap-api-key
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

## API Endpoints

### Authentication

- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - Get JWT tokens
- `POST /api/auth/refresh/` - Refresh access token
- `GET /api/auth/me/` - Get current user info

### Cities

- `GET /api/cities/` - List all cities
- `GET /api/cities/search/?q={query}` - Search cities (database-first with API fallback)
- `GET /api/cities/{id}/` - City details with current weather

### Subscriptions

- `GET /api/subscriptions/` - List user's subscriptions
- `POST /api/subscriptions/` - Create subscription
- `PATCH /api/subscriptions/{id}/` - Update subscription
- `DELETE /api/subscriptions/{id}/` - Delete subscription

### Weather

- `GET /api/weather/{city_id}/` - Current weather
- `GET /api/weather/{city_id}/?period={period}` - Weather forecast (current, today, tomorrow, 3days, week, hourly, etc.)

## Project Structure

```
weather_reminder/
├── src/
│   ├── config/              # Django settings, urls, celery
│   ├── app/                 # Main application
│   │   ├── models.py        # All models
│   │   ├── serializers.py   # DRF serializers
│   │   ├── views.py         # API views
│   │   ├── tasks.py         # Celery tasks
│   │   └── services/        # Business logic
├── frontend/                # Frontend build system
├── tests/                   # Pytest tests
├── docker/                  # Docker files
└── docker-compose.yml
```

## Development

### Running Tests

```bash
docker-compose exec web pytest
```

### Running Migrations

```bash
docker-compose exec web python manage.py makemigrations
docker-compose exec web python manage.py migrate
```

### Accessing Services

- **Django Shell**: `docker-compose exec web python manage.py shell`
- **PostgreSQL**: `docker-compose exec db psql -U postgres -d weather_reminder`
- **Redis CLI**: `docker-compose exec redis redis-cli`

## Documentation

For detailed documentation, architecture overview, data models, API specifications, and implementation details, see:

📖 **[Full Implementation Plan](docs/WEATHER_REMINDER_PLAN.md)**

The documentation includes:

- Complete architecture overview
- Database schema and ER diagrams
- API endpoint specifications
- Celery task definitions
- Service layer architecture
- Component interaction flows
- Best practices and implementation phases

## License

[Add your license here]

## Contributing

[Add contributing guidelines here]
