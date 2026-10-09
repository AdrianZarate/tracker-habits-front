import type { Habit } from '../../api/habits.api';
import HabitCard from './HabitCard';

interface HabitListProps {
  habits: Habit[];
  hasHidden: boolean;
  pendingIds: ReadonlySet<string>;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitList({ habits, hasHidden, pendingIds, onLog }: HabitListProps) {
  if (habits.length === 0) {
    return (
      <p className='state-panel text-sm text-dark-muted'>
        {hasHidden ? 'No tienes hábitos activos. Puedes restaurar uno desde Hábitos ocultos.'
          : 'No tienes hábitos todavía. ¡Crea uno con el botón +!'}
      </p>
    );
  }

  return (
    <section aria-labelledby='today-habits-title' className='surface p-4 sm:p-6'>
      <h2 id='today-habits-title' className='mb-5 text-lg font-semibold'>Tus hábitos de hoy</h2>
      <ul className='space-y-3'>
        {habits.map((habit) => (
          <HabitCard key={habit.habitId} habit={habit} pending={pendingIds.has(habit.habitId)} onLog={onLog} />
        ))}
      </ul>
    </section>
  );
}
