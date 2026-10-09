import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Habit } from '../../api/habits.api';

interface HabitCardProps {
  habit: Habit;
  pending: boolean;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitCard({ habit, pending, onLog }: HabitCardProps) {
  return (
    <li aria-busy={pending} className={`habit-row ${habit.completedToday ? 'habit-row-done' : ''}`}>
      <label className='today-toggle habit-toggle'>
        <input type='checkbox' aria-label='Completado hoy' checked={!!habit.completedToday} disabled={pending}
          onChange={() => onLog(habit.habitId, !!habit.completedToday)} />
        <span aria-hidden='true' className='habit-circle'>
          {habit.completedToday && <Check size={17} />}
        </span>
      </label>
      <div className='min-w-0 flex-1'>
        <Link to={`/habits/${habit.habitId}`} className='flex min-h-11 min-w-0 items-center py-2 text-sm font-semibold leading-relaxed text-dark-text hover:underline'>
          <span className='min-w-0 break-words'>{habit.title}</span>
        </Link>
        <p aria-live='polite' className={`habit-status ${habit.completedToday && !pending ? 'habit-status-done' : ''}`}>
          {pending ? 'Guardando...' : habit.completedToday ? 'Completado hoy' : 'Sin completar hoy'}
        </p>
      </div>
    </li>
  );
}
