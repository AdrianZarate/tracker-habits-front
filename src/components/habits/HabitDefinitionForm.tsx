import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, FormEvent, KeyboardEvent } from 'react';
import { isAxiosError } from 'axios';
import { X } from 'lucide-react';
import { LEGACY_CONFIGURATION } from '../../api/habits.api';
import type { HabitConfiguration, HabitDetail, UpdateHabitPayload } from '../../api/habits.api';
import { useAuth } from '../../hooks/useAuth';
import Input from '../ui/Input';
import Button from '../ui/Button';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Ni el orden de las propiedades JSON ni el de los días crea una revisión.
function configurationKey({ schedule, goal }: HabitConfiguration) {
  return JSON.stringify([
    schedule.kind,
    schedule.kind === 'weekdays' ? [...schedule.days].sort((a, b) => a - b)
      : schedule.kind === 'weekly' ? schedule.timesPerWeek : null,
    goal.kind,
    goal.kind === 'quantity' ? [goal.target, goal.unit] : null,
  ]);
}

function DefinitionInput({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return (
    <div className='space-y-1'>
      <label htmlFor={id} className='text-sm text-dark-muted'>{label}</label>
      <Input id={id} {...props} />
    </div>
  );
}

interface HabitDefinitionFormProps {
  habit?: HabitDetail;
  onSave: (payload: UpdateHabitPayload, signal: AbortSignal) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}

export default function HabitDefinitionForm({ habit, onSave, onSaved, onClose }: HabitDefinitionFormProps) {
  const { token } = useAuth();
  const initialConfiguration = habit?.pendingConfiguration?.configuration ?? habit?.configuration ?? LEGACY_CONFIGURATION;
  const [title, setTitle] = useState(habit?.title ?? '');
  const [category, setCategory] = useState(habit?.category ?? '');
  const [color, setColor] = useState(habit?.color ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '');
  const [frequency, setFrequency] = useState(initialConfiguration.schedule.kind);
  const [days, setDays] = useState(initialConfiguration.schedule.kind === 'weekdays' ? initialConfiguration.schedule.days : []);
  const [quota, setQuota] = useState(String(initialConfiguration.schedule.kind === 'weekly' ? initialConfiguration.schedule.timesPerWeek : 3));
  const [goalKind, setGoalKind] = useState(initialConfiguration.goal.kind);
  const [target, setTarget] = useState(String(initialConfiguration.goal.kind === 'quantity' ? initialConfiguration.goal.target : 1));
  const [unit, setUnit] = useState(initialConfiguration.goal.kind === 'quantity' ? initialConfiguration.goal.unit : '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const iconListId = useId();

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      controller.abort();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [token]);

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isLoading) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
    if (!controls?.length) {
      event.preventDefault();
      return;
    }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const makePayload = (): UpdateHabitPayload => {
    const metadata = { title: title.trim(), category: category.trim(), color: color.trim(), icon: icon.trim() };
    if (metadata.title.length < 3 || metadata.title.length > 200) {
      throw new Error('El título debe tener entre 3 y 200 caracteres.');
    }
    if (metadata.category.length > 80) throw new Error('La categoría admite hasta 80 caracteres.');
    if (metadata.color && !/^#[\da-f]{6}$/i.test(metadata.color)) {
      throw new Error('El color debe tener el formato #RRGGBB.');
    }
    if (metadata.icon.length > 64) throw new Error('El icono admite hasta 64 caracteres.');
    if (frequency === 'weekdays' && (!days.length || new Set(days).size !== days.length || days.some(day => !Number.isInteger(day) || day < 1 || day > 7))) {
      throw new Error('Selecciona al menos un día de la semana, sin duplicados.');
    }
    const timesPerWeek = Number(quota);
    if (frequency === 'weekly' && (!Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7)) {
      throw new Error('Los días por semana deben ser un entero entre 1 y 7.');
    }
    const amount = Number(target);
    if (goalKind === 'quantity' && (!Number.isFinite(amount) || amount <= 0 || amount > 1e9)) {
      throw new Error('La cantidad objetivo debe ser positiva y no superar 1000000000.');
    }
    if (goalKind === 'quantity' && (!unit.trim() || unit.trim().length > 32)) {
      throw new Error('La unidad debe tener entre 1 y 32 caracteres.');
    }
    const configuration: HabitConfiguration = {
      schedule: frequency === 'daily' ? { kind: 'daily' }
        : frequency === 'weekly' ? { kind: 'weekly', timesPerWeek }
          : { kind: 'weekdays', days: [...days].sort((a, b) => a - b) },
      goal: goalKind === 'checkbox' ? { kind: 'checkbox' } : { kind: 'quantity', target: amount, unit: unit.trim() },
    };
    const payload: UpdateHabitPayload = {};
    for (const field of ['title', 'category', 'color', 'icon'] as const) {
      if (habit ? metadata[field] !== (habit[field] ?? '') : metadata[field] !== '') {
        payload[field] = metadata[field];
      }
    }
    if (!habit || configurationKey(configuration) !== configurationKey(initialConfiguration)) {
      payload.configuration = configuration;
    }
    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const controller = request.current;
    if (isLoading || !controller || controller.signal.aborted) return;
    setError(null);
    let payload: UpdateHabitPayload;
    try {
      payload = makePayload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa los datos del hábito.');
      return;
    }
    if (habit && !Object.keys(payload).length) {
      onClose();
      return;
    }
    setIsLoading(true);
    dialog.current?.focus();
    const current = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    try {
      await onSave(payload, controller.signal);
      if (current()) onSaved();
    } catch (cause) {
      if (!current()) return;
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 404 ? 'Hábito no encontrado. No se guardaron los cambios.'
        : status === 400 ? 'Revisa los datos del hábito e inténtalo de nuevo.'
          : status === 409 ? 'El hábito cambió. Recarga el detalle antes de volver a intentarlo.'
            : habit ? 'No se pudo guardar el hábito. Inténtalo de nuevo.' : 'No se pudo crear el hábito. Inténtalo de nuevo.');
    } finally {
      if (current()) setIsLoading(false);
    }
  };

  const selectClass = 'w-full rounded-lg bg-dark-bg px-4 py-2.5 text-dark-text ring-1 ring-dark-muted focus:outline-primary';
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4'>
      <div
        ref={dialog}
        role='dialog'
        aria-modal='true'
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={handleKeyboard}
        className='max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-dark-card p-6 shadow-xl'
      >
        <div className='mb-4 flex items-center justify-between'>
          <h2 id={headingId} className='text-lg font-bold text-dark-text'>
            {habit ? 'Editar hábito' : 'Nuevo hábito'}
          </h2>
          <button
            type='button'
            onClick={onClose}
            disabled={isLoading}
            aria-label='Cerrar formulario'
            className='text-dark-muted transition hover:text-dark-text disabled:opacity-50'
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className='space-y-4'>
          <fieldset disabled={isLoading} className='space-y-4'>
            <DefinitionInput
              label='Título'
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='Ej. Meditar 10 minutos'
            />
            <DefinitionInput
              label='Categoría'
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder='Ej. Salud'
            />
            <DefinitionInput label='Color' value={color} onChange={e => setColor(e.target.value)} placeholder='#RRGGBB' />
            <DefinitionInput
              label='Icono'
              value={icon}
              onChange={e => setIcon(e.target.value)}
              list={iconListId}
              placeholder='Ej. book'
            />
            <datalist id={iconListId}>
              <option value='book'>Libro</option>
              <option value='heart'>Salud</option>
              <option value='dumbbell'>Ejercicio</option>
              <option value='droplet'>Agua</option>
              <option value='star'>Estrella</option>
            </datalist>
            <label className='block space-y-1 text-sm text-dark-muted'>
              <span>Frecuencia</span>
              <select
                aria-label='Frecuencia'
                className={selectClass}
                value={frequency}
                onChange={e => setFrequency(e.target.value as typeof frequency)}
              >
                <option value='daily'>Diario</option>
                <option value='weekdays'>Días de la semana</option>
                <option value='weekly'>Días por semana</option>
              </select>
            </label>
            {frequency === 'weekdays' && (
              <fieldset className='grid grid-cols-2 gap-2 text-sm text-dark-text'>
                <legend className='mb-2 text-dark-muted'>Selecciona los días</legend>
                {WEEKDAYS.map((day, index) => (
                  <label key={day} className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={days.includes(index + 1)}
                      onChange={e => setDays(previous => e.target.checked
                        ? [...previous.filter(value => value !== index + 1), index + 1]
                        : previous.filter(value => value !== index + 1))}
                    />
                    {day}
                  </label>
                ))}
              </fieldset>
            )}
            {frequency === 'weekly' && (
              <DefinitionInput
                label='Días por semana'
                type='number'
                min={1}
                max={7}
                step={1}
                value={quota}
                onChange={e => setQuota(e.target.value)}
              />
            )}
            <label className='block space-y-1 text-sm text-dark-muted'>
              <span>Tipo de objetivo</span>
              <select
                aria-label='Tipo de objetivo'
                className={selectClass}
                value={goalKind}
                onChange={e => setGoalKind(e.target.value as typeof goalKind)}
              >
                <option value='checkbox'>Marcar completado</option>
                <option value='quantity'>Cantidad</option>
              </select>
            </label>
            {goalKind === 'quantity' && (
              <>
                <DefinitionInput
                  label='Cantidad objetivo'
                  type='number'
                  min={0}
                  max={1e9}
                  step='any'
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                />
                <DefinitionInput label='Unidad' value={unit} onChange={e => setUnit(e.target.value)} placeholder='Ej. páginas' />
                <p className='text-xs text-dark-muted'>
                  La cantidad se aplica por día registrado, no como suma semanal. El registro de cantidades estará disponible próximamente.
                </p>
              </>
            )}
          </fieldset>
          {habit && (
            <p className='text-sm text-dark-muted'>
              Los metadatos cambian ahora. Los cambios de frecuencia u objetivo se aplican desde el próximo día de tu cuenta, sin modificar el historial.
            </p>
          )}
          {error && <p role='alert' className='text-sm text-red-400'>{error}</p>}
          <div className='flex justify-end gap-3 pt-2'>
            <Button variant='ghost' type='button' onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type='submit' isLoading={isLoading}>{habit ? 'Guardar cambios' : 'Crear hábito'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
