/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/templates/**/*.html",
    "./frontend/src/js/**/*.js",
    "./frontend/src/css/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg-primary': '#1a1a2e',
        'dark-bg-secondary': '#16213e',
        'dark-bg-card': '#0f3460',
        'dark-text-primary': '#ffffff',
        'dark-text-secondary': '#a0a0a0',
        'accent-blue': '#3b82f6',
        'accent-yellow': '#fbbf24',
      },
      backgroundImage: {
        'gradient-card': 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)',
        'gradient-card-alt': 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};

