# Contexto del Proyecto Frontend: Tracker de Hábitos

## Objetivo

Crear una aplicación web SPA en React (usando Vite) para gestionar hábitos de usuarios. La aplicación debe consumir una API REST existente (NestJS), manejar autenticación con JWT, y tener una interfaz oscura (Dark Mode) moderna, responsiva y personalizable.

## Stack Tecnológico Requerido

- **Framework:** React 19+ (Vite)
- **Routing:** React Router DOM v6+
- **Styling:** Tailwind CSS (configurado con tema oscuro personalizable)
- **HTTP Client:** Axios (con interceptores para JWT)
- **State Management:** React Context API (para estado global de usuario/sesión)
- **Tipografías:** Google Fonts (ej. 'Inter' o 'Poppins')
- **Iconos:** Lucide React o Heroicons

## 1. Configuración Base y Estilos (UI/UX)

La aplicación debe usar una paleta de colores oscura mediante Tailwind.

**Requisitos para Tailwind y CSS:**

- Configurar en `tailwind.config.js` la extensión de colores usando variables CSS para que sean fácilmente modificables.
- Paleta sugerida (modificable en `index.css`):
  - Fondo principal: `#121212` (Gris muy oscuro)
  - Superficies (Cards, Modals): `#1E1E1E`
  - Color Primario: `#6366F1` (Índigo) o `#10B981` (Esmeralda para éxito/completado)
  - Texto principal: `#F3F4F6`
  - Texto secundario: `#9CA3AF`
- Incluir la importación de la fuente de Google Fonts en el `index.html` y configurarla en el `tailwind.config.js` como `font-sans`.

## 2. Estructura de Carpetas Sugerida

Por favor, organiza el código generado en la siguiente estructura:

```text
src/
├── api/
│   ├── axios.js          # Instancia de Axios con interceptores de Auth
│   ├── auth.api.js       # Peticiones de /auth
│   └── habits.api.js     # Peticiones de /habits
├── components/
│   ├── layout/           # Navbar, Sidebar, ProtectedRoute
│   ├── auth/             # Formularios de Login/Register
│   ├── habits/           # HabitCard, HabitList, CreateHabitForm
│   └── ui/               # Botones, Inputs, Spinners reutilizables
├── context/
│   └── AuthContext.jsx   # Estado de la sesión (user, token, login, logout)
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx     # Vista principal de hábitos de hoy
│   └── HabitDetails.jsx  # Historial y logs de un hábito
├── App.jsx
└── main.jsx
```
