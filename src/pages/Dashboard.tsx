import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getHabits,
  getUserLogs,
  checkHabit,
  incompleteHabit,
  isHabitActive,
} from '../api/habits.api';
import type { Habit } from '../api/habits.api';
import Navbar from '../components/layout/Navbar';
import HabitList from '../components/habits/HabitList';
import CreateHabitForm from '../components/habits/CreateHabitForm';
import Spinner from '../components/ui/Spinner';
import { markCompleted, markIncomplete } from '../utils/dailyCompletions';
import { useAuth } from '../hooks/useAuth';
import { useCalendarDay } from '../hooks/useCalendarDay';
import { calendarDay, calendarLabel } from '../utils/calendar';

export default function Dashboard() {
  const { user, token } = useAuth();
  const timeZone = user?.timeZone ?? 'UTC';
  const today = useCalendarDay(timeZone);
  // Retira la lista anterior antes de pintar otra cuenta o día.
  return <DashboardView key={JSON.stringify([user?.email, token, timeZone, today])}
    email={user?.email ?? ''} token={token} timeZone={timeZone} today={today} />;
}

function DashboardView({ email, token, timeZone, today }: {
  email: string; token: string | null; timeZone: string; today: string;
}) {
  const requestRef = useRef<AbortController | null>(null);
  const habitsRef = useRef<Habit[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const currentRequest = useCallback((request: AbortController) => requestRef.current === request
    && !request.signal.aborted && window.location.pathname === '/dashboard'
    && localStorage.getItem('token') === token && localStorage.getItem('email') === email
    && calendarDay(new Date(), timeZone) === today, [email, token, timeZone, today]);

  const fetchHabits = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    habitsRef.current = [];
    pendingRef.current.clear();
    setPendingIds(new Set());
    setHabits([]);
    setIsLoading(true);
    setError(null);
    setMutationError(null);
    // Lee todas las asociaciones una vez; abrir hábitos ocultos no hace peticiones.
    Promise.all([getHabits('all', request.signal), getUserLogs(request.signal)])
      .then(([{ data: habits }, { data: logs }]) => {
        if (!currentRequest(request)) return;
        // Set de habitIds completados HOY
        const completedIds = new Set(
          logs
            .filter((l) => calendarLabel(l.date) === today && l.completed)
            .map((l) => l.habitId),
        );

        const enriched = habits.map((h) => {
          const done = isHabitActive(h) && completedIds.has(h.habitId);
          if (done) markCompleted(h.habitId, timeZone);
          else markIncomplete(h.habitId, timeZone);
          return { ...h, completedToday: done };
        });

        habitsRef.current = enriched;
        setError(null);
        setHabits(enriched);
      })
      .catch(() => { if (currentRequest(request)) setError('No se pudieron cargar los hábitos.'); })
      .finally(() => { if (currentRequest(request)) setIsLoading(false); });
  }, [currentRequest, timeZone, today]);

  useEffect(() => {
    fetchHabits();
    return () => requestRef.current?.abort();
  }, [fetchHabits]);

  const handleLog = async (id: string, completedToday: boolean) => {
    const request = requestRef.current;
    const trackable = () => {
      const habit = habitsRef.current.find(h => h.habitId === id);
      return request && currentRequest(request) && habit && isHabitActive(habit)
        && !!habit.completedToday === completedToday;
    };
    // Protege también callbacks antiguos, registros ocultos y dobles envíos.
    if (!request || !trackable() || pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
    setMutationError(null);
    try {
      let done: boolean;
      if (completedToday) {
        await incompleteHabit(id, request.signal);
        done = false;
      } else {
        const { data } = await checkHabit(id, request.signal);
        done = data.completed;
      }
      if (!trackable()) return;
      if (done) markCompleted(id, timeZone);
      else markIncomplete(id, timeZone);
      habitsRef.current = habitsRef.current.map(h => h.habitId === id ? { ...h, completedToday: done } : h);
      setHabits(habitsRef.current);
    } catch {
      if (trackable()) setMutationError('Error al actualizar el hábito.');
    } finally {
      if (currentRequest(request)) {
        pendingRef.current.delete(id);
        setPendingIds(new Set(pendingRef.current));
      }
    }
  };

  const activeHabits = habits.filter(isHabitActive);
  const hiddenHabits = habits.filter(habit => !isHabitActive(habit));
  const completedCount = activeHabits.filter(habit => habit.completedToday).length;
  const retry = () => {
    const request = requestRef.current;
    if (request && currentRequest(request)) fetchHabits();
  };

  return (
    <>
      <Navbar />

      <div className='page-shell'>
        {/* Saludo y acción principal */}
        <div className='mx-auto mb-8 flex max-w-2xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <h1 className='text-3xl font-bold tracking-tight text-dark-text'>
              {(() => {
                const hour = new Date().getHours();
                const greeting =
                  hour < 12
                    ? 'Buenos días'
                    : hour < 18
                      ? 'Buenas tardes'
                      : 'Buenas noches';
                return `${greeting} 👋`;
              })()}
            </h1>
            <p className='mt-2 text-sm leading-relaxed text-dark-muted'>
              Estos son tus hábitos diarios
            </p>
            {!isLoading && !error && activeHabits.length > 0 && <p className='mt-3 text-sm font-medium text-dark-muted'>
              {completedCount} de {activeHabits.length} completados hoy
            </p>}
          </div>
          <button onClick={() => setShowForm(true)} title='Nuevo hábito'
            className='ui-action shrink-0 self-start bg-primary text-white hover:bg-primary-hover sm:self-auto'>
            <Plus size={18} aria-hidden='true' />Nuevo hábito
          </button>
        </div>

        {/* Content */}
        <main className='mx-auto max-w-2xl'>
          {isLoading && (
            <div role='status' aria-label='Cargando hábitos' className='state-panel flex items-center justify-center gap-3 text-sm text-dark-muted'>
              <Spinner />Cargando hábitos...
            </div>
          )}

          {error && <div role='alert' className='state-panel text-red-300'>
            <p>{error}</p>
            <button onClick={retry} className='ui-action mt-2 text-dark-accent hover:underline'>Reintentar</button>
          </div>}
          {mutationError && <p role='alert' className='state-panel mb-4 text-sm text-red-300'>{mutationError}</p>}

          {!isLoading && !error && <>
            <HabitList habits={activeHabits} hasHidden={hiddenHabits.length > 0} pendingIds={pendingIds} onLog={handleLog} />
            {hiddenHabits.length > 0 && <details className='mt-6 rounded-xl border border-dark-border px-4 py-2 text-sm text-dark-muted'>
              <summary className='min-h-11 cursor-pointer rounded-lg py-3 font-medium hover:text-dark-text'>Hábitos ocultos</summary>
              <ul className='mt-2 border-t border-dark-border pt-2'>
                {hiddenHabits.map(habit => <li key={habit.habitId}>
                  <Link to={`/habits/${habit.habitId}`} className='block min-h-11 min-w-0 break-words rounded-lg px-2 py-3 leading-relaxed hover:text-dark-text hover:underline'>{habit.title}</Link>
                </li>)}
              </ul>
            </details>}
          </>}
        </main>
      </div>

      {showForm && (
        <CreateHabitForm
          onCreated={() => {
            setShowForm(false);
            setIsLoading(true);
            setError(null);
            fetchHabits();
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
