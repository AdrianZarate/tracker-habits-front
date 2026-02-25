import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, PowerOff, Trash2 } from 'lucide-react';
import { getHabitLogs, incompleteHabit, toggleHabit } from '../api/habits.api';
import type { Habit, HabitLog } from '../api/habits.api';
import { markIncomplete } from '../utils/dailyCompletions';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';

export default function HabitDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const habit = (location.state as { habit: Habit } | null)?.habit ?? null;

  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeactivate = async () => {
    if (!id) return;
    setIsDeactivating(true);
    try {
      await toggleHabit(id);
      navigate('/dashboard');
    } catch {
      setIsDeactivating(false);
      setShowConfirm(false);
    }
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr.slice(0, 10) === today;
  };

  const handleDeleteLog = async (log: HabitLog) => {
    if (!id) return;
    setDeletingLogId(log._id);
    try {
      await incompleteHabit(id);
      setLogs((prev) => prev.filter((l) => l._id !== log._id));
      if (isToday(log.date)) markIncomplete(id);
    } catch {
      // silencioso — el log permanece en la lista
    } finally {
      setDeletingLogId(null);
    }
  };

  useEffect(() => {
    if (!id) return;
    getHabitLogs(id)
      .then(({ data }) => setLogs(data))
      .catch(() => setError('No se pudieron cargar los registros.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!habit) {
    return (
      <div className='flex h-screen flex-col items-center justify-center bg-dark-bg gap-4'>
        <p className='text-dark-muted'>Hábito no encontrado.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className='text-primary hover:underline text-sm'
        >
          Volver al dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className='min-h-screen bg-dark-bg px-4 py-8'>
        <div className='mx-auto max-w-2xl'>
          {/* Header */}
          <div className='mb-6 flex items-center'>
            <button
              onClick={() => navigate('/dashboard')}
              className='flex items-center gap-2 text-dark-muted transition hover:text-dark-text'
            >
              <ArrowLeft size={18} />
              Volver
            </button>
          </div>

          {/* Info del hábito */}
          <div className='mb-6 rounded-2xl bg-dark-card p-6 shadow'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h1 className='mb-1 text-2xl font-bold text-dark-text'>
                  {habit.title}
                </h1>
                {habit.slug && (
                  <p className='text-sm text-dark-muted'>/{habit.slug}</p>
                )}
              </div>

              {/* Botón desactivar */}
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  title='Desactivar hábito'
                  className='flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300'
                >
                  <PowerOff size={13} />
                  Desactivar
                </button>
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='text-xs text-dark-muted'>¿Seguro?</span>
                  <button
                    onClick={handleDeactivate}
                    disabled={isDeactivating}
                    className='rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50'
                  >
                    {isDeactivating ? 'Desactivando...' : 'Sí, desactivar'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isDeactivating}
                    className='rounded-lg px-3 py-1.5 text-xs text-dark-muted transition hover:text-dark-text'
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Historial de logs */}
          <h2 className='mb-3 text-lg font-semibold text-dark-text'>
            Historial
          </h2>

          {isLoading && (
            <div className='flex justify-center py-8'>
              <Spinner />
            </div>
          )}

          {error && <p className='text-center text-red-400'>{error}</p>}

          {!isLoading && !error && logs.length === 0 && (
            <p className='text-center text-dark-muted py-8'>
              Aún no hay registros para este hábito.
            </p>
          )}

          {!isLoading && !error && logs.length > 0 && (
            <ul className='space-y-2'>
              {logs
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .map((log) => (
                  <li
                    key={log._id}
                    className='flex items-center justify-between rounded-xl bg-dark-card px-5 py-3 shadow'
                  >
                    <span className='text-sm text-dark-text'>
                      {new Date(log.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <div className='flex items-center gap-3'>
                      <span className='text-success text-sm font-semibold'>
                        ✓
                      </span>
                      <button
                        onClick={() => handleDeleteLog(log)}
                        disabled={deletingLogId === log._id}
                        title='Eliminar registro'
                        className='text-dark-muted hover:text-red-400 transition disabled:opacity-40'
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
