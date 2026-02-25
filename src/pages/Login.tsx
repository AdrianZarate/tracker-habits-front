import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch {
      setError('Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-dark-bg px-4'>
      <div className='w-full max-w-md rounded-2xl bg-dark-card p-8 shadow-lg'>
        <h1 className='mb-2 text-2xl font-bold text-dark-text'>
          Iniciar sesión
        </h1>
        <p className='mb-6 text-sm text-dark-muted'>Bienvenido de nuevo 👋</p>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='mb-1 block text-sm text-dark-muted'>Email</label>
            <input
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='w-full rounded-lg bg-dark-bg px-4 py-2.5 text-dark-text outline-none ring-1 ring-dark-muted focus:ring-primary'
              placeholder='tu@email.com'
            />
          </div>

          <div>
            <label className='mb-1 block text-sm text-dark-muted'>
              Contraseña
            </label>
            <input
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full rounded-lg bg-dark-bg px-4 py-2.5 text-dark-text outline-none ring-1 ring-dark-muted focus:ring-primary'
              placeholder='••••••••'
            />
          </div>

          {error && <p className='text-sm text-red-400'>{error}</p>}

          <button
            type='submit'
            disabled={isLoading}
            className='w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50'
          >
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className='mt-6 text-center text-sm text-dark-muted'>
          ¿No tienes cuenta?{' '}
          <Link to='/register' className='text-primary hover:underline'>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
