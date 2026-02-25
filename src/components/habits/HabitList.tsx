import type { Habit } from '../../api/habits.api';
import HabitCard from './HabitCard';

interface HabitListProps {
  habits: Habit[];
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitList({ habits, onLog }: HabitListProps) {
  if (habits.length === 0) {
    return (
      <p className='py-12 text-center text-dark-muted'>
        No tienes hábitos todavía. ¡Crea uno con el botón +!
      </p>
    );
  }

  return (
    <ul className='space-y-3'>
      {habits.map((habit) => (
        <HabitCard key={habit.habitId} habit={habit} onLog={onLog} />
      ))}
    </ul>
  );
}
