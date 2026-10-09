import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Leaf, X } from 'lucide-react';
import type { InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../api/axios';

const accountRevision = () => JSON.stringify(
  ['token', 'email', 'timeZone'].map(key => localStorage.getItem(key)),
);
const routeRevision = () => window.location.pathname + window.location.search;
const isBackdrop = (event: { currentTarget: HTMLDialogElement; target: EventTarget; clientX: number; clientY: number }) => {
  const box = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (
    event.clientX < box.left || event.clientX > box.right ||
    event.clientY < box.top || event.clientY > box.bottom
  );
};

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const pending = useRef(false);
  const backdropStart = useRef(false);
  const [entry] = useState(() => ({ account: accountRevision(), route: routeRevision() }));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const titleId = useId();
  const subtitleId = useId();
  const currentRoute = () => alive.current && routeRevision() === entry.route;
  const current = () => currentRoute() && accountRevision() === entry.account;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    alive.current = true;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      alive.current = false;
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const close = () => {
    if (!pending.current && currentRoute()) onClose();
  };

  const handleSuccess = async (credential: string) => {
    if (!current() || pending.current) return;
    pending.current = true;
    setIsLoading(true);
    setError(null);
    // Reject stale responses before the existing provider commits session storage.
    // This guard is scoped to this attempt; credential transport remains unchanged.
    let request: InternalAxiosRequestConfig | undefined;
    const capture = apiClient.interceptors.request.use(config => {
      // Ejection cannot remove callbacks from chains Axios already snapshotted.
      if (
        !request && config.method === 'post' && config.url === '/auth/google' &&
        config.data?.idToken === credential
      ) {
        request = config;
        apiClient.interceptors.request.eject(capture);
      }
      return config;
    });
    const guard = apiClient.interceptors.response.use(response => {
      if (response.config === request && !current()) {
        throw new Error('Login attempt is no longer current');
      }
      return response;
    });
    try {
      await loginWithGoogle(credential);
      if (currentRoute()) navigate('/dashboard');
    } catch (err: unknown) {
      if (!current()) return;
      const axiosError = err as {
        code?: string;
        response?: { data?: { message?: string }; status?: number };
      };
      console.error('[Login] Error al iniciar sesión:', axiosError.response ?? err);
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_NETWORK') {
        setError('El servidor está iniciando, espera unos segundos e intenta de nuevo.');
      } else {
        setError(axiosError.response?.data?.message ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      apiClient.interceptors.request.eject(capture);
      apiClient.interceptors.response.eject(guard);
      if (current()) {
        pending.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className='login-dialog'
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
      aria-modal='true'
      aria-busy={isLoading}
      onCancel={event => { event.preventDefault(); close(); }}
      onPointerDown={event => { backdropStart.current = isBackdrop(event); }}
      onClick={event => {
        if (backdropStart.current && isBackdrop(event)) close();
      }}
    >
      <button type='button' className='login-close' aria-label='Cerrar inicio de sesión' disabled={isLoading} onClick={close} autoFocus>
        <X size={20} aria-hidden='true' />
      </button>
      <header className='login-header'>
        <span className='login-mark' aria-hidden='true'><Leaf size={24} /></span>
        <h2 id={titleId} className='login-title'>Iniciar sesión</h2>
        <p id={subtitleId} className='login-subtitle'>Vuelve a tus hábitos.<br />Continúa con tu cuenta de Google.</p>
      </header>
      {error && <p role='alert' className='login-error'>{error}</p>}
      <div className='login-action'>
        {isLoading ? (
          <p role='status' className='login-status'>Ingresando...</p>
        ) : (
          <div className='login-google'>
          <GoogleLogin
            onSuccess={({ credential }) => {
              if (!current() || pending.current) return;
              if (!credential) {
                setError('No se recibió credencial de Google.');
                return;
              }
              void handleSuccess(credential);
            }}
            onError={() => {
              if (current() && !pending.current) setError('Error al autenticar con Google.');
            }}
            theme='outline'
            size='large'
            shape='pill'
            text='signin_with'
            width='240'
            useOneTap={false}
          />
          </div>
        )}
      </div>
      <p className='login-footer'>Sin crear una contraseña nueva.</p>
    </dialog>
  );
}
