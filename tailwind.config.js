/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        dark: {
          bg: '#0D1220', // Midnight
          card: '#171E30', // Superficies
          border: '#34415B',
          accent: '#A5B4FC', // Enlaces y foco sobre superficies oscuras
          text: '#F3F4F6',
          muted: '#ABB7D0',
        },
        primary: {
          DEFAULT: '#4F46E5', // Indigo: contraste con texto blanco
          hover: '#4338CA',
        },
        success: {
          DEFAULT: '#047857',
          hover: '#065F46',
        },
      },
    },
  },
  plugins: [],
};
