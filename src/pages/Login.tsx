import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Landing from './Landing';

export default function Login() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role='status' className='state-panel'>Validando sesión...</p>;
  if (user) return <Navigate to='/dashboard' replace />;
  return <Landing initialLoginOpen />;
}
