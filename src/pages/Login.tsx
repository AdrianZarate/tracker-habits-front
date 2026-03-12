import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = async (credential: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle(credential);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as {
        code?: string;
        response?: { data?: { message?: string }; status?: number };
      };
      console.error(
        '[Login] Error al iniciar sesión:',
        axiosError.response ?? err,
      );
      if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ERR_NETWORK'
      ) {
        setError(
          'El servidor está iniciando, espera unos segundos e intenta de nuevo.',
        );
      } else {
        setError(
          axiosError.response?.data?.message ??
            'No se pudo iniciar sesión. Intenta de nuevo.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-dark-bg px-4'>
      <div className='w-full max-w-md rounded-2xl bg-dark-card p-8 shadow-lg text-center'>
        <h1 className='mb-2 text-2xl font-bold text-dark-text'>
          Iniciar sesión
        </h1>
        <p className='mb-8 text-sm text-dark-muted'>Bienvenido de nuevo 👋</p>

        {error && <p className='mb-4 text-sm text-red-400'>{error}</p>}

        {isLoading ? (
          <p className='text-sm text-dark-muted animate-pulse'>Ingresando...</p>
        ) : (
          <div className='flex justify-center'>
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (!credential) {
                  setError('No se recibió credencial de Google.');
                  return;
                }
                handleSuccess(credential);
              }}
              onError={() => setError('Error al autenticar con Google.')}
              theme='filled_black'
              size='large'
              shape='rectangular'
              text='signin_with'
              useOneTap={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
