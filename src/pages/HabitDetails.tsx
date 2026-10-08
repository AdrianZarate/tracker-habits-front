import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ArrowLeft } from 'lucide-react';
import { checkHabit, getHabitById, getHabitLogs, incompleteHabit, isHabitActive, updateHabitLifecycle } from '../api/habits.api';
import type { HabitDetail, HabitLog } from '../api/habits.api';
import { markCompleted, markIncomplete } from '../utils/dailyCompletions';
import { calendarDay, calendarLabel, formatCalendarLabel } from '../utils/calendar';
import { useAuth } from '../hooks/useAuth';
import { useCalendarDay } from '../hooks/useCalendarDay';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';
import EditHabitForm from '../components/habits/EditHabitForm';

export default function HabitDetails() {
  const { id = '' } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const timeZone = user?.timeZone ?? 'UTC';
  const today = useCalendarDay(timeZone);
  // Remount before paint: no previous route/account/day data can flash.
  return <HabitDetailView key={JSON.stringify([id, user?.email, token, timeZone, today])}
    id={id} email={user?.email ?? ''} token={token} timeZone={timeZone} today={today} />;
}

function HabitDetailView({ id, email, token, timeZone, today }: {
  id: string; email: string; token: string | null; timeZone: string; today: string;
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
  const [showConfirm, setShowConfirm] = useState<'active' | 'archived' | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const current = (request: AbortController) => requestRef.current === request && !request.signal.aborted
    && window.location.pathname === `/habits/${id}` && localStorage.getItem('email') === email
    && localStorage.getItem('token') === token && calendarDay(new Date(), timeZone) === today;

  useEffect(() => {
    const request = new AbortController();
    requestRef.current = request;
    const valid = () => !request.signal.aborted && window.location.pathname === `/habits/${id}`
      && localStorage.getItem('email') === email && localStorage.getItem('token') === token
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
        if (!valid()) return;
        history.forEach(log => calendarLabel(log.date));
        setLogs(history);
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
  }, [id, email, token, timeZone, today, attempt]);

  const retry = () => {
    const request = requestRef.current;
    if (!request || !current(request) || pending) return;
    setHabit(null);
    setLogs([]);
    setError(null);
    setMutationError(null);
    setShowConfirm(null);
    setShowEdit(false);
    setRefreshFailed(false);
    setIsLoading(true);
    setAttempt(value => value + 1);
  };
  const isToday = (date: string) => calendarLabel(date) === today;
  const active = habit ? isHabitActive(habit) : false;
  const completedToday = logs.find(log => isToday(log.date))?.completed ?? false;
  const readable = !!habit && !missing && !isLoading && !error && !refreshFailed;
  const ready = readable && active && !showConfirm && !showEdit;
  const lifecycleTarget = active ? 'archived' : 'active';
  const confirmVerb = showConfirm === 'active' ? 'restaurar' : 'ocultar';

  const refreshDefinition = async () => {
    const request = requestRef.current;
    if (!request || !current(request) || pending) return;
    setPending('refresh');
    setMutationError(null);
    try {
      const { data } = await getHabitById(id, request.signal);
      if (!current(request)) return;
      setHabit(data);
      setRefreshFailed(false);
    } catch (cause) {
      if (!current(request)) return;
      if (isAxiosError(cause) && cause.response?.status === 404) setMissing(true);
      else {
        setMutationError('Los cambios se guardaron, pero no se pudo recargar la definición.');
        setRefreshFailed(true);
      }
    } finally {
      if (current(request)) setPending(null);
    }
  };
  const changeLifecycle = async () => {
    const request = requestRef.current;
    if (!request || !current(request) || !readable || !showConfirm || showEdit || pending
      || showConfirm !== lifecycleTarget) return;
    setPending('lifecycle');
    setMutationError(null);
    try {
      const { data } = await updateHabitLifecycle(id, showConfirm, request.signal);
      if (!current(request)) return;
      // Legacy associations may omit title/slug: preserve the owned detail and logs.
      setHabit(previous => previous ? { ...previous, ...data } : previous);
    } catch (cause) {
      if (!current(request)) return;
      setMutationError(isAxiosError(cause) && cause.response?.status === 404
        ? 'Hábito no encontrado. No se cambió el estado.'
        : 'No se pudo cambiar el estado. Inténtalo de nuevo.');
    } finally {
      if (current(request)) {
        setPending(null);
        setShowConfirm(null);
      }
    }
  };
  const toggleToday = async () => {
    const request = requestRef.current;
    if (!request || !current(request) || !ready || pending) return;
    setPending('today');
    setMutationError(null);
    try {
      if (completedToday) {
        await incompleteHabit(id, request.signal);
        if (!current(request)) return;
        setLogs(previous => previous.filter(log => !isToday(log.date)));
        markIncomplete(id, timeZone);
      } else {
        const { data } = await checkHabit(id, request.signal);
        if (!current(request)) return;
        calendarLabel(data.date);
        setLogs(previous => [...previous.filter(log => !isToday(log.date)), data]);
        if (data.completed) markCompleted(id, timeZone);
        else markIncomplete(id, timeZone);
      }
      // The write response is authoritative; no follow-up read can repeat this write.
    } catch {
      if (current(request)) setMutationError('No se pudo actualizar el hábito. Inténtalo de nuevo.');
    } finally {
      if (current(request)) setPending(null);
    }
  };

  if (missing) {
    return <div className='flex h-screen flex-col items-center justify-center bg-dark-bg gap-4'>
      <p className='text-dark-muted'>Hábito no encontrado.</p>
      <button onClick={() => navigate('/dashboard')} className='ui-action text-dark-accent hover:underline'>Volver al dashboard</button>
    </div>;
  }

  return (
    <>
      <Navbar />
      <main className='page-shell'>
        <div className='mx-auto max-w-2xl'>
          <button onClick={() => navigate('/dashboard')}
            className='ui-action mb-6 px-0 text-dark-muted hover:text-dark-text'>
            <ArrowLeft size={18} aria-hidden='true' />Volver
          </button>
          {habit && <div className='surface mb-8 min-w-0 p-5 sm:p-6'>
            <h1 className='mb-5 min-w-0 break-words text-2xl font-bold leading-snug tracking-tight text-dark-text sm:text-3xl'>{habit.title}</h1>
            <div className='flex flex-wrap gap-3'>
              <button onClick={() => {
                const request = requestRef.current;
                if (request && current(request) && readable && !pending && !showConfirm) setShowEdit(true);
              }} disabled={!readable || pending !== null || !!showConfirm}
                className='secondary-action text-dark-accent disabled:opacity-60'>Editar hábito</button>
              <button onClick={() => { setMutationError(null); setShowConfirm(lifecycleTarget); }}
                disabled={!readable || pending !== null || !!showConfirm || showEdit}
                className='secondary-action disabled:opacity-60'>{active ? 'Ocultar hábito' : 'Restaurar hábito'}</button>
            </div>
            {showConfirm && <div role='dialog' aria-labelledby='lifecycle-heading'
              className='mt-5 space-y-3 break-words rounded-xl border border-dark-border bg-dark-bg p-4'
              onKeyDown={event => { if (event.key === 'Escape' && !pending) setShowConfirm(null); }}>
              <h2 id='lifecycle-heading' className='font-semibold text-dark-text'>
                {showConfirm === 'active' ? 'Restaurar hábito' : 'Ocultar hábito'}
              </h2>
              <p className='text-sm text-dark-muted'>¿Quieres {confirmVerb} «{habit.title}»? El historial se conserva.</p>
              <button onClick={() => void changeLifecycle()} disabled={pending !== null}
                className='ui-action mr-3 bg-primary text-white hover:bg-primary-hover disabled:opacity-60'>{pending === 'lifecycle' ? 'Guardando...' : `Sí, ${confirmVerb}`}</button>
              <button autoFocus onClick={() => setShowConfirm(null)} disabled={pending !== null}
                className='secondary-action disabled:opacity-60'>Cancelar</button>
            </div>}
            <section aria-labelledby='today-heading' aria-busy={pending === 'today'}
              className='mt-6 space-y-3 border-t border-dark-border pt-6 text-sm text-dark-text'>
              <h2 id='today-heading' className='text-lg font-semibold'>Hoy</h2>
              <p className='text-dark-muted'>Fecha de la cuenta: {today}</p>
              <label className={`today-toggle border ${completedToday ? 'border-[#3f7763] bg-[#152b2b]' : 'border-dark-border bg-dark-bg'}`}>
                <input type='checkbox' checked={completedToday} onChange={() => void toggleToday()}
                  disabled={!ready || pending !== null} />
                Completado hoy
              </label>
            </section>
          </div>}
          {mutationError && <div role='alert' className='state-panel mb-4 text-sm text-red-300'>
            <p>{mutationError}</p>
            {refreshFailed && <button onClick={() => void refreshDefinition()} disabled={pending !== null}
              className='ui-action mt-2 text-dark-accent disabled:opacity-60'>Reintentar actualización</button>}
          </div>}
          <h2 className='mb-3 text-lg font-semibold text-dark-text'>Historial del mes actual de la cuenta</h2>
          {isLoading && <div role='status' aria-label='Cargando historial' className='state-panel flex items-center justify-center gap-3 text-sm text-dark-muted'><Spinner />Cargando historial...</div>}
          {error && <div role='alert' className='state-panel text-red-300'>
            <p>{error}</p>
            <button onClick={retry} className='ui-action mt-2 text-dark-accent hover:underline'>Reintentar</button>
          </div>}
          {!isLoading && !error && (logs.length === 0
            ? <p className='state-panel text-sm text-dark-muted'>Aún no hay registros para este hábito.</p>
            : <ul className='space-y-2'>
              {logs.slice().sort((a, b) => calendarLabel(b.date).localeCompare(calendarLabel(a.date))).map(log => (
                <li key={log._id} className='history-row'>
                  <span className='text-sm text-dark-text'>{formatCalendarLabel(log.date)}</span>
                  <span className='text-sm text-dark-muted'>{log.completed ? 'Completado' : 'Sin completar'}</span>
                </li>
              ))}
            </ul>)}
        </div>
      </main>
      {showEdit && readable && habit && <EditHabitForm habit={habit}
        onClose={() => setShowEdit(false)}
        onUpdated={() => { setShowEdit(false); void refreshDefinition(); }} />}
    </>
  );
}
