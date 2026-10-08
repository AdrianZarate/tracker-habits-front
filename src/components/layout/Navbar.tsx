import { useNavigate } from 'react-router-dom';
import { LogOut, CheckSquare } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className='sticky top-0 z-40 border-b border-dark-border bg-dark-bg/95 backdrop-blur'>
      <div className='mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3'>
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          className='flex min-h-11 shrink-0 items-center gap-2 font-bold tracking-tight text-dark-text'
        >
          <CheckSquare size={22} aria-hidden='true' className='text-dark-accent' />
          HabitTracker
        </button>

        {/* Usuario y logout */}
        {user && (
          <div className='flex min-w-0 items-center justify-end gap-3'>
            <span className='hidden min-w-0 truncate text-sm text-dark-muted sm:block'>
              {user.fullName}
            </span>
            <button
              onClick={handleLogout}
              title='Cerrar sesión'
              className='secondary-action shrink-0 px-3'
            >
              <LogOut size={16} aria-hidden='true' />
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
