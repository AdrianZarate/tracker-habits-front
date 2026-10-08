import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  getHabits,
  getUserLogs,
  completeHabit,
  incompleteHabit,
} from '../api/habits.api';
import type { Habit } from '../api/habits.api';
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
  const currentRequest = () => localStorage.getItem('token') === token && calendarDay(new Date(), timeZone) === today;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchHabits = useCallback(() => {
    // Una sola petición trae todos los logs del usuario de hoy
    Promise.all([getHabits(), getUserLogs()])
      .then(([{ data: habits }, { data: logs }]) => {
        if (localStorage.getItem('token') !== token || calendarDay(new Date(), timeZone) !== today) return;
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

        setError(null);
        setHabits(enriched);
      })
      .catch(() => setError('No se pudieron cargar los hábitos.'))
      .finally(() => setIsLoading(false));
  }, [today, timeZone, token]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const handleLog = async (id: string, completedToday: boolean) => {
    try {
      if (completedToday) {
        await incompleteHabit(id);
        if (!currentRequest()) return;
        markIncomplete(id, timeZone);
        setHabits((prev) =>
          prev.map((h) =>
            h.habitId === id ? { ...h, completedToday: false } : h,
          ),
        );
      } else {
        await completeHabit(id);
        if (!currentRequest()) return;
        markCompleted(id, timeZone);
        setHabits((prev) =>
          prev.map((h) =>
            h.habitId === id ? { ...h, completedToday: true } : h,
          ),
        );
      }
    } catch {
      setError('Error al actualizar el hábito.');
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
          {isLoading && (
            <div className='flex justify-center py-12'>
              <Spinner />
            </div>
          )}

          {error && <p className='text-center text-red-400'>{error}</p>}

          {!isLoading && !error && (
            <HabitList habits={habits} onLog={handleLog} />
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
            fetchHabits();
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
