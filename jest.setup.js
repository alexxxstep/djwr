// Jest setup file
// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
// Set both global.localStorage and window.localStorage
global.localStorage = localStorageMock;
global.window.localStorage = localStorageMock;
// Export for use in tests
global.localStorageMock = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock window methods
global.window = {
  location: {
    href: '',
    reload: jest.fn(),
    pathname: '/',
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
};

// Mock document methods - use jest.fn() for all methods
global.document = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn(),
  createElementNS: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
};

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
  }
  global.window.location.href = '';
  if (global.window.location.reload && typeof global.window.location.reload.mockClear === 'function') {
    global.window.location.reload.mockClear();
  }
  if (global.document.getElementById && typeof global.document.getElementById.mockClear === 'function') {
    global.document.getElementById.mockClear();
  }
  if (global.document.querySelector && typeof global.document.querySelector.mockClear === 'function') {
    global.document.querySelector.mockClear();
  }
  if (global.document.querySelectorAll && typeof global.document.querySelectorAll.mockClear === 'function') {
    global.document.querySelectorAll.mockClear();
  }
  if (global.document.createElement && typeof global.document.createElement.mockClear === 'function') {
    global.document.createElement.mockClear();
  }
  if (global.document.createElementNS && typeof global.document.createElementNS.mockClear === 'function') {
    global.document.createElementNS.mockClear();
  }
});

