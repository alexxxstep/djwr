# Frontend Tests

Цей каталог містить unit-тести для всіх JavaScript модулів frontend.

## Структура тестів

- `api.test.js` - Тести для API client (JWT authentication, token management, error handling)
- `auth.test.js` - Тести для authentication модуля (login, register, logout, refresh token)
- `search.test.js` - Тести для пошуку міст (debounce, results display, subscription creation)
- `subscriptions.test.js` - Тести для управління підписками (CRUD операції, weather loading)
- `weather.test.js` - Тести для weather API integration (fetching, display updates)
- `ui.test.js` - Тести для UI interactions (sidebar, navigation, city selection)
- `icons.test.js` - Тести для weather icons та formatting utilities

## Запуск тестів

```bash
# Запустити всі тести
npm test

# Запустити тести в watch mode
npm run test:watch

# Запустити тести з coverage
npm run test:coverage
```

## Покриття тестами

Тести покривають:
- ✅ JWT token management
- ✅ API requests з error handling
- ✅ Authentication flow (login, register, logout)
- ✅ City search з debounce
- ✅ Subscription CRUD operations
- ✅ Weather data fetching та display
- ✅ UI interactions та navigation
- ✅ Weather icons та formatting

## Технології

- **Jest** - тестовий фреймворк
- **jsdom** - DOM environment для тестів
- **babel-jest** - трансформація ES6+ код
- **identity-obj-proxy** - mock для CSS modules

## Mocking

Всі зовнішні залежності мокуються:
- `api.js` - API requests
- `weather.js` - Weather API calls
- `icons.js` - Icon utilities
- `localStorage` - Browser storage
- `fetch` - HTTP requests
- `document` - DOM manipulation

## Приклад тесту

```javascript
test('creates subscription successfully', async () => {
  const mockResponse = {
    id: 1,
    city_id: 1,
    period: 6,
  };

  api.apiRequest.mockResolvedValueOnce(mockResponse);

  const result = await createSubscription(1, 6, 'current', 'email');

  expect(api.apiRequest).toHaveBeenCalledWith('subscriptions/', {
    method: 'POST',
    body: JSON.stringify({
      city_id: 1,
      period: 6,
      forecast_period: 'current',
      notification_type: 'email',
      is_active: true,
    }),
  });
  expect(result).toEqual(mockResponse);
});
```

