import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de REQUEST — adjunta el token JWT a cada petición
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de RESPONSE — redirige al login si el token expira (401)
// Excluye rutas de autenticación para no hacer redirect en credenciales incorrectas
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl: string = error.config?.url ?? '';
    const isAuthRoute = AUTH_ROUTES.some((route) => requestUrl.includes(route));

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
