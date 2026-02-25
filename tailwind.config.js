/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dark: {
          bg: '#121212', // Fondo principal
          card: '#1E1E1E', // Fondo de tarjetas/modales
          text: '#F3F4F6', // Texto principal
          muted: '#9CA3AF', // Texto secundario
        },
        primary: {
          DEFAULT: '#6366F1', // Indigo
          hover: '#4F46E5',
        },
        success: {
          DEFAULT: '#10B981', // Esmeralda para hábitos completados
          hover: '#059669',
        },
      },
    },
  },
  plugins: [],
};
