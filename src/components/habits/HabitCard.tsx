import { useNavigate } from 'react-router-dom';
import type { Habit } from '../../api/habits.api';
import Button from '../ui/Button';

interface HabitCardProps {
  habit: Habit;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitCard({ habit, onLog }: HabitCardProps) {
  const navigate = useNavigate();

  return (
    <li className='flex items-center justify-between rounded-xl bg-dark-card px-5 py-4 shadow transition hover:ring-1 hover:ring-dark-muted'>
      {/* Info */}
      <button
        onClick={() =>
          navigate(`/habits/${habit.habitId}`, { state: { habit } })
        }
        className='flex flex-col text-left'
      >
        <span className='font-medium text-dark-text'>{habit.title}</span>
        {habit.description && (
          <span className='text-xs text-dark-muted line-clamp-1'>
            {habit.description}
          </span>
        )}
        <span className='mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs capitalize text-primary'>
          {habit.frequency}
        </span>
      </button>

      {/* Acción */}
      <Button
        variant={habit.completedToday ? 'success' : 'primary'}
        onClick={() => onLog(habit.habitId, !!habit.completedToday)}
        className='ml-4 shrink-0'
        title={habit.completedToday ? 'Desmarcar' : 'Completar'}
      >
        {habit.completedToday ? '✓ Hecho' : 'Completar'}
      </Button>
    </li>
  );
}
