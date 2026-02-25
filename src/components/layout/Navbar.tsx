import { useNavigate } from 'react-router-dom';
import { LogOut, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className='sticky top-0 z-40 border-b border-dark-card bg-dark-bg/80 backdrop-blur'>
      <div className='mx-auto flex max-w-2xl items-center justify-between px-4 py-4'>
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          className='flex items-center gap-2 font-bold text-dark-text'
        >
          <CheckSquare size={20} className='text-primary' />
          HabitTracker
        </button>

        {/* Usuario y logout */}
        {user && (
          <div className='flex items-center gap-4'>
            <span className='hidden text-sm text-dark-muted sm:block'>
              {user.fullName}
            </span>
            <button
              onClick={handleLogout}
              title='Cerrar sesión'
              className='flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-sm text-dark-muted transition hover:text-dark-text'
            >
              <LogOut size={15} />
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
