import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  getHabits,
  getUserLogs,
  completeHabit,
  incompleteHabit,
  isHabitActive,
  LEGACY_CONFIGURATION,
} from '../api/habits.api';
import type { Habit, HabitStatusFilter } from '../api/habits.api';
import Navbar from '../components/layout/Navbar';
import HabitList from '../components/habits/HabitList';
import CreateHabitForm from '../components/habits/CreateHabitForm';
import Spinner from '../components/ui/Spinner';
import { markCompleted, markIncomplete } from '../utils/dailyCompletions';
import { useAuth } from '../hooks/useAuth';
import { useCalendarDay } from '../hooks/useCalendarDay';
import { calendarDay } from '../utils/calendar';

export default function Dashboard() {
  const { user, token } = useAuth();
  const timeZone = user?.timeZone ?? 'UTC';
  const today = useCalendarDay(timeZone);
  const [status, setStatus] = useState<HabitStatusFilter>('active');
  // Retira la lista anterior antes de pintar otro filtro, cuenta o día.
  return <DashboardView key={JSON.stringify([user?.email, token, timeZone, today, status])}
    email={user?.email ?? ''} token={token} timeZone={timeZone} today={today} status={status} onStatus={setStatus} />;
}

function DashboardView({ email, token, timeZone, today, status, onStatus }: {
  email: string; token: string | null; timeZone: string; today: string;
  status: HabitStatusFilter; onStatus: (status: HabitStatusFilter) => void;
}) {
  const requestRef = useRef<AbortController | null>(null);
  const habitsRef = useRef<Habit[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Una sola petición trae los logs; se enriquece sólo el filtro vigente.
    Promise.all([getHabits(status, request.signal), getUserLogs(request.signal)])
      .then(([{ data: habits }, { data: logs }]) => {
        if (!currentRequest(request)) return;
        // Set de habitIds completados HOY
        const completedIds = new Set(
          logs
            .filter((l) => l.date.startsWith(today) && l.completed)
            .map((l) => l.habitId),
        );

        const enriched = habits.map((h) => {
          const done = completedIds.has(h.habitId);
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
  }, [status, currentRequest, timeZone, today]);

  useEffect(() => {
    fetchHabits();
    return () => requestRef.current?.abort();
  }, [fetchHabits]);

  const handleLog = async (id: string, completedToday: boolean) => {
    const request = requestRef.current;
    const trackable = () => {
      const habit = habitsRef.current.find(h => h.habitId === id);
      return request && currentRequest(request) && habit && isHabitActive(habit)
        && (habit.configuration ?? LEGACY_CONFIGURATION).goal.kind === 'checkbox';
    };
    // La protección del callback es independiente del botón de la tarjeta.
    if (!request || !trackable()) return;
    try {
      let done: boolean;
      if (completedToday) {
        await incompleteHabit(id, request.signal);
        done = false;
      } else {
        const { data } = await completeHabit(id, undefined, request.signal);
        done = data.completed;
      }
      if (!trackable()) return;
      if (done) markCompleted(id, timeZone);
      else markIncomplete(id, timeZone);
      habitsRef.current = habitsRef.current.map(h => h.habitId === id ? { ...h, completedToday: done } : h);
      setHabits(habitsRef.current);
    } catch {
      if (trackable()) setError('Error al actualizar el hábito.');
    }
  };

  return (
    <>
      <Navbar />

      <div className='min-h-screen bg-dark-bg px-4 py-8'>
        {/* Saludo */}
        <div className='mx-auto mb-6 max-w-2xl'>
          <h1 className='text-2xl font-bold text-dark-text'>
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
          <p className='text-sm text-dark-muted'>
            Estos son tus hábitos diarios
          </p>
        </div>

        {/* Content */}
        <main className='mx-auto max-w-2xl'>
          <div className='mb-4 text-sm text-dark-text'>
            <label htmlFor='habit-status'>Estado de los hábitos</label>
            <select id='habit-status' value={status} onChange={event => onStatus(event.target.value as HabitStatusFilter)}
              className='ml-3 rounded-lg border border-dark-muted bg-dark-card p-2'>
              <option value='active'>Activos</option>
              <option value='paused'>Pausados</option>
              <option value='archived'>Archivados</option>
              <option value='all'>Todos</option>
            </select>
          </div>
          {isLoading && (
            <div className='flex justify-center py-12'>
              <Spinner />
            </div>
          )}

          {error && <p className='text-center text-red-400'>{error}</p>}

          {!isLoading && !error && (
            habits.length ? <HabitList habits={habits} onLog={handleLog} />
              : <p className='py-12 text-center text-dark-muted'>No hay hábitos en este estado.</p>
          )}

          {/* FAB */}
          <button
            onClick={() => setShowForm(true)}
            className='fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition hover:bg-primary-hover'
            title='Nuevo hábito'
          >
            <Plus size={24} className='text-white' />
          </button>
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
