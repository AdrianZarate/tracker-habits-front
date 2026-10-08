import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ArrowLeft, PowerOff, Trash2 } from 'lucide-react';
import { completeHabit, getHabitById, getHabitLogs, incompleteHabit, toggleHabit } from '../api/habits.api';
import type { HabitDetail, HabitLog } from '../api/habits.api';
import { markCompleted, markIncomplete } from '../utils/dailyCompletions';
import { calendarDay, calendarLabel, formatCalendarLabel } from '../utils/calendar';
import { useAuth } from '../hooks/useAuth';
import { useCalendarDay } from '../hooks/useCalendarDay';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';

export default function HabitDetails() {
  const { id = '' } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const timeZone = user?.timeZone ?? 'UTC';
  const today = useCalendarDay(timeZone);
  // Remount before paint: no previous route/account/day data can flash.
  return <HabitDetailView key={JSON.stringify([id, user?.email, token, timeZone, today])}
    id={id} token={token} timeZone={timeZone} today={today} />;
}

function HabitDetailView({ id, token, timeZone, today }: {
  id: string; token: string | null; timeZone: string; today: string;
}) {
  const navigate = useNavigate();
  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const lifecycle = useRef<AbortController | null>(null);
  const current = (request: AbortController) => !request.signal.aborted
    && localStorage.getItem('token') === token && calendarDay(new Date(), timeZone) === today;

  useEffect(() => {
    const request = new AbortController();
    lifecycle.current = request;
    const valid = () => !request.signal.aborted && localStorage.getItem('token') === token
      && calendarDay(new Date(), timeZone) === today;
    let detailLoaded = false;
    async function load() {
      try {
        const { data } = await getHabitById(id, request.signal);
        if (!valid()) return;
        detailLoaded = true;
        setHabit(data);
        // History alone does not prove ownership; request only after owned detail.
        const { data: history } = await getHabitLogs(id, undefined, request.signal);
        history.forEach(log => calendarLabel(log.date));
        if (valid()) setLogs(history);
      } catch (cause) {
        if (!valid()) return;
        if (!detailLoaded && isAxiosError(cause) && cause.response?.status === 404) setMissing(true);
        else setError(detailLoaded ? 'No se pudieron cargar los registros.' : 'No se pudo cargar el hábito.');
      } finally {
        if (valid()) setIsLoading(false);
      }
    }
    void load();
    return () => request.abort();
  }, [id, token, timeZone, today, attempt]);

  const retry = () => {
    setHabit(null);
    setLogs([]);
    setError(null);
    setMutationError(null);
    setShowConfirm(false);
    setIsLoading(true);
    setAttempt(value => value + 1);
  };
  const isToday = (date: string) => calendarLabel(date) === today;
  const ready = habit?.active && !isLoading && !error;
  const completedToday = logs.some(log => isToday(log.date) && log.completed);
  const handleMutation = async (action: 'complete' | 'undo' | 'deactivate') => {
    const request = lifecycle.current;
    if (!request || !current(request) || !ready || pending) return;
    setPending(action);
    setMutationError(null);
    try {
      if (action === 'deactivate') {
        await toggleHabit(id);
        if (current(request)) navigate('/dashboard');
      } else if (action === 'undo') {
        await incompleteHabit(id);
        if (!current(request)) return;
        setLogs(previous => previous.filter(log => !isToday(log.date)));
        markIncomplete(id, timeZone);
      } else {
        const { data } = await completeHabit(id);
        calendarLabel(data.date);
        if (!current(request)) return;
        setLogs(previous => [...previous.filter(log => !isToday(log.date)), data]);
        markCompleted(id, timeZone);
      }
    } catch {
      if (current(request)) setMutationError('No se pudo actualizar el hábito. Inténtalo de nuevo.');
    } finally {
      if (current(request)) {
        setPending(null);
        setShowConfirm(false);
      }
    }
  };

  if (missing) {
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
          {habit && (
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

              <span className='text-sm text-dark-muted'>{habit.active ? 'Activo' : 'Inactivo'}</span>
              {/* Sólo la asociación activa permite controles de seguimiento. */}
              {habit.active && (!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!ready || pending !== null}
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
                    onClick={() => handleMutation('deactivate')}
                    disabled={pending !== null}
                    className='rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50'
                  >
                    {pending === 'deactivate' ? 'Desactivando...' : 'Sí, desactivar'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={pending !== null}
                    className='rounded-lg px-3 py-1.5 text-xs text-dark-muted transition hover:text-dark-text'
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
            {ready && !completedToday && (
              <button onClick={() => handleMutation('complete')} disabled={pending !== null}
                className='mt-4 text-primary disabled:opacity-50'>
                {pending === 'complete' ? 'Completando...' : 'Completar hoy'}
              </button>
            )}
          </div>
          )}
          {mutationError && <p role='alert' className='mb-4 text-red-400'>{mutationError}</p>}

          {/* Historial de logs */}
          <h2 className='mb-3 text-lg font-semibold text-dark-text'>
            Historial
          </h2>

          {isLoading && (
            <div className='flex justify-center py-8'>
              <Spinner />
            </div>
          )}

          {error && (
            <div role='alert' className='text-center text-red-400'>
              <p>{error}</p>
              <button onClick={retry} className='mt-2 text-primary hover:underline'>Reintentar</button>
            </div>
          )}

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
                      {formatCalendarLabel(log.date)}
                    </span>
                    <div className='flex items-center gap-3'>
                      <span className='text-success text-sm font-semibold'>
                        ✓
                      </span>
                      {habit?.active && isToday(log.date) && (
                      <button
                        onClick={() => handleMutation('undo')}
                        disabled={pending !== null}
                        title='Eliminar registro'
                        className='text-dark-muted hover:text-red-400 transition disabled:opacity-40'
                      >
                        <Trash2 size={15} />
                      </button>
                      )}
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
