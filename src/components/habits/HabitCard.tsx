import { Link } from 'react-router-dom';
import type { Habit } from '../../api/habits.api';

interface HabitCardProps {
  habit: Habit;
  pending: boolean;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitCard({ habit, pending, onLog }: HabitCardProps) {
  return (
    <li aria-busy={pending}
      className={`surface flex min-w-0 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between
        ${habit.completedToday ? 'border-[#3f7763] bg-[#152b2b]' : ''}`}>
      <Link to={`/habits/${habit.habitId}`} className='block min-h-11 min-w-0 flex-1 break-words py-2 text-base font-semibold leading-relaxed text-dark-text hover:underline'>
        {habit.title}
      </Link>
      <label className='today-toggle shrink-0 self-start bg-dark-bg/30 text-dark-muted sm:self-auto'>
        <input type='checkbox' checked={!!habit.completedToday} disabled={pending}
          onChange={() => onLog(habit.habitId, !!habit.completedToday)} />
        Completado hoy
      </label>
    </li>
  );
}
