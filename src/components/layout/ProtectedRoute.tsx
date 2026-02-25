import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Protege rutas que requieren sesión iniciada.
 * Si el usuario no está autenticado lo redirige a /login.
 * Mientras se verifica el token muestra un spinner de carga.
 */
export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center bg-dark-bg'>
        <span className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to='/login' replace />;
}
