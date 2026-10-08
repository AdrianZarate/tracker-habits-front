import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { isAxiosError } from 'axios';
import { X } from 'lucide-react';
import type { HabitDetail } from '../../api/habits.api';
import { useAuth } from '../../hooks/useAuth';
import { calendarDay } from '../../utils/calendar';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface HabitDefinitionFormProps {
  habit?: HabitDetail;
  onSave: (payload: { title: string }, signal: AbortSignal) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}

export default function HabitDefinitionForm({ habit, onSave, onSaved, onClose }: HabitDefinitionFormProps) {
  const { user, token } = useAuth();
  const [context] = useState(() => {
    const timeZone = user?.timeZone ?? 'UTC';
    return { token, email: user?.email ?? '', timeZone, today: calendarDay(new Date(), timeZone),
      pathname: window.location.pathname };
  });
  const [title, setTitle] = useState(habit?.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const titleId = useId();
  const errorId = useId();
  const current = (controller: AbortController) => !controller.signal.aborted
    && localStorage.getItem('token') === context.token && localStorage.getItem('email') === context.email
    && window.location.pathname === context.pathname && calendarDay(new Date(), context.timeZone) === context.today;

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      controller.abort();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isLoading) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const controller = request.current;
    if (isLoading || !controller || !current(controller)) return;
    setError(null);
    const name = title.trim();
    if (name.length < 3 || name.length > 200) {
      setError('El título debe tener entre 3 y 200 caracteres.');
      return;
    }
    if (habit && name === habit.title) {
      onClose();
      return;
    }
    setIsLoading(true);
    dialog.current?.focus();
    try {
      // Omitted fields preserve legacy metadata, goals and historical snapshots.
      await onSave({ title: name }, controller.signal);
      if (current(controller)) onSaved();
    } catch (cause) {
      if (!current(controller)) return;
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 404 ? 'Hábito no encontrado. No se guardaron los cambios.'
        : status === 400 ? 'Revisa los datos del hábito e inténtalo de nuevo.'
          : status === 409 ? 'El hábito cambió. Recarga el detalle antes de volver a intentarlo.'
            : habit ? 'No se pudo guardar el hábito. Inténtalo de nuevo.' : 'No se pudo crear el hábito. Inténtalo de nuevo.');
    } finally {
      if (current(controller)) setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4'>
      <div ref={dialog} role='dialog' aria-modal='true' aria-labelledby={headingId} tabIndex={-1}
        onKeyDown={handleKeyboard}
        className='max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-dark-card p-6 shadow-xl'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 id={headingId} className='text-lg font-bold text-dark-text'>{habit ? 'Editar hábito' : 'Nuevo hábito'}</h2>
          <button type='button' onClick={onClose} disabled={isLoading} aria-label='Cerrar formulario'
            className='text-dark-muted transition hover:text-dark-text disabled:opacity-50'><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className='space-y-4'>
          <div className='space-y-1'>
            <label htmlFor={titleId} className='text-sm text-dark-muted'>Título</label>
            <Input id={titleId} required value={title} disabled={isLoading} aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined} onChange={event => { setTitle(event.target.value); setError(null); }}
              placeholder='Ej. Meditar 10 minutos' />
          </div>
          {error && <p id={errorId} role='alert' className='text-sm text-red-400'>{error}</p>}
          <div className='flex justify-end gap-3 pt-2'>
            <Button variant='ghost' type='button' onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type='submit' isLoading={isLoading}>{habit ? 'Guardar cambios' : 'Crear hábito'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
