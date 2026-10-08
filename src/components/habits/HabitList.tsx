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
    <ul className='space-y-3'>
      {habits.map((habit) => (
        <HabitCard key={habit.habitId} habit={habit} pending={pendingIds.has(habit.habitId)} onLog={onLog} />
      ))}
    </ul>
  );
}
