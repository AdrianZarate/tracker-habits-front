import { useNavigate } from 'react-router-dom';
import { BookOpen, CircleCheck, Dumbbell, Droplet, Heart, Star } from 'lucide-react';
import { isHabitActive, LEGACY_CONFIGURATION } from '../../api/habits.api';
import type { Habit, HabitConfiguration, PersonalHabitDefinition } from '../../api/habits.api';
import Button from '../ui/Button';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Elementos estáticos importados explícitamente, nunca búsqueda de componentes arbitrarios.
const ICONS = new Map([
  ['book', <BookOpen size={18} aria-hidden='true' data-habit-icon='book' />],
  ['heart', <Heart size={18} aria-hidden='true' data-habit-icon='heart' />],
  ['dumbbell', <Dumbbell size={18} aria-hidden='true' data-habit-icon='dumbbell' />],
  ['droplet', <Droplet size={18} aria-hidden='true' data-habit-icon='droplet' />],
  ['star', <Star size={18} aria-hidden='true' data-habit-icon='star' />],
]);
const FALLBACK_ICON = <CircleCheck size={18} aria-hidden='true' data-habit-icon='fallback' />;

export function HabitConfigurationSummary({ configuration }: { configuration: HabitConfiguration }) {
  const { schedule, goal } = configuration;
  const frequency = schedule.kind === 'daily' ? 'Diario'
    : schedule.kind === 'weekly' ? `${schedule.timesPerWeek} días por semana`
      : [...schedule.days].sort((a, b) => a - b).map(day => WEEKDAYS[day - 1]).join(', ');
  return `${frequency} · ${goal.kind === 'checkbox' ? 'Marcar completado' : `${goal.target} ${goal.unit} por día`}`;
}

export function HabitMetadata({ habit }: { habit: PersonalHabitDefinition }) {
  const safeColor = habit.color && /^#[\da-f]{6}$/i.test(habit.color) ? habit.color : undefined;
  return <span className='flex items-center gap-2 text-sm text-dark-muted'>
    <span style={{ color: safeColor }}>{ICONS.get(habit.icon ?? '') ?? FALLBACK_ICON}</span>
    {habit.category && <span>{habit.category}</span>}
    {safeColor && <span className='text-xs'>Color: {safeColor}</span>}
  </span>;
}

interface HabitCardProps {
  habit: Habit;
  onLog: (id: string, completedToday: boolean) => void;
}

export default function HabitCard({ habit, onLog }: HabitCardProps) {
  const navigate = useNavigate();
  const configuration = habit.configuration ?? LEGACY_CONFIGURATION;
  const quantity = configuration.goal.kind === 'quantity';
  const canTrack = isHabitActive(habit) && !quantity;

  return (
    <li className='flex items-center justify-between rounded-xl bg-dark-card px-5 py-4 shadow transition hover:ring-1 hover:ring-dark-muted'>
      <button onClick={() => navigate(`/habits/${habit.habitId}`, { state: { habit } })}
        className='flex min-w-0 flex-col gap-1 text-left'>
        <span className='font-medium text-dark-text'>{habit.title}</span>
        {habit.slug && <span className='text-xs text-dark-muted'>/{habit.slug}</span>}
        <HabitMetadata habit={habit} />
        <span className='text-xs text-dark-muted'><HabitConfigurationSummary configuration={configuration} /></span>
        {habit.pendingConfiguration && <span className='text-xs text-dark-muted'>
          Desde el {habit.pendingConfiguration.effectiveFrom}: <HabitConfigurationSummary configuration={habit.pendingConfiguration.configuration} />
        </span>}
      </button>
      <Button variant={habit.completedToday ? 'success' : 'primary'} disabled={!canTrack}
        onClick={() => { if (canTrack) onLog(habit.habitId, !!habit.completedToday); }}
        className='ml-4 shrink-0'
        aria-label={quantity ? 'Registro de cantidad pendiente' : undefined}
        title={quantity ? 'Abre el detalle del hábito para registrar cantidades.' : habit.completedToday ? 'Desmarcar' : 'Completar'}>
        {quantity ? 'Cantidad: en detalle' : habit.completedToday ? '✓ Hecho' : 'Completar'}
      </Button>
    </li>
  );
}
