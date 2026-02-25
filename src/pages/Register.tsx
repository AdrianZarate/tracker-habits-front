import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await register({ fullName, email, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '';
      if (message.toLowerCase().includes('email')) {
        setError('Este correo ya está registrado.');
      } else if (message) {
        setError(message);
      } else {
        setError('No se pudo crear la cuenta. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-dark-bg px-4'>
      <div className='w-full max-w-md rounded-2xl bg-dark-card p-8 shadow-lg'>
        <h1 className='mb-2 text-2xl font-bold text-dark-text'>Crear cuenta</h1>
        <p className='mb-6 text-sm text-dark-muted'>
          Comienza a trackear tus hábitos
        </p>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='mb-1 block text-sm text-dark-muted'>Nombre</label>
            <input
              type='text'
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className='w-full rounded-lg bg-dark-bg px-4 py-2.5 text-dark-text outline-none ring-1 ring-dark-muted focus:ring-primary'
              placeholder='Tu nombre'
            />
          </div>

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
            <div className='relative'>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='w-full rounded-lg bg-dark-bg px-4 py-2.5 pr-11 text-dark-text outline-none ring-1 ring-dark-muted focus:ring-primary'
                placeholder='Mínimo 6 caracteres'
              />
              <button
                type='button'
                onClick={() => setShowPassword((v) => !v)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition'
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className='text-sm text-red-400'>{error}</p>}

          <button
            type='submit'
            disabled={isLoading}
            className='w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50'
          >
            {isLoading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p className='mt-6 text-center text-sm text-dark-muted'>
          ¿Ya tienes cuenta?{' '}
          <Link to='/login' className='text-primary hover:underline'>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
