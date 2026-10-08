import { Link } from 'react-router-dom';
import type { Habit } from '../../api/habits.api';

interface HabitCardProps {
  habit: Habit;
  pending: boolean;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitCard({ habit, pending, onLog }: HabitCardProps) {
  return (
    <li className='flex items-center justify-between gap-4 rounded-xl bg-dark-card px-5 py-4 shadow'>
      <Link to={`/habits/${habit.habitId}`} className='min-w-0 break-words font-medium text-dark-text hover:underline'>
        {habit.title}
      </Link>
      <label className='flex shrink-0 items-center gap-2 text-sm text-dark-text'>
        <input type='checkbox' checked={!!habit.completedToday} disabled={pending}
          onChange={() => onLog(habit.habitId, !!habit.completedToday)} />
        Completado hoy
      </label>
    </li>
  );
}
