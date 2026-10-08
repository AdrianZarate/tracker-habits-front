import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { getHabitLogs, getHabitWeek, isHabitActive, updateHabitLog } from '../../api/habits.api';
import type { HabitConfiguration, HabitDetail, HabitLog, UpdateHabitLogPayload } from '../../api/habits.api';
import { calendarDay, calendarLabel } from '../../utils/calendar';

interface Props {
  habit: HabitDetail;
  token: string | null;
  timeZone: string;
  today: string;
  onRecordUpdated: (signal: AbortSignal) => Promise<boolean>;
}

function validDate(date: string, today: string) {
  try { return /^\d{4}-\d{2}-\d{2}$/.test(date) && calendarLabel(date) <= today; }
  catch { return false; }
}

interface SelectedRecord {
  log?: HabitLog;
  configuration: HabitConfiguration;
}

async function readRecord(id: string, date: string, signal: AbortSignal): Promise<SelectedRecord> {
  const [{ data: logs }, { data: week }] = await Promise.all([
    getHabitLogs(id, { startDate: date, endDate: date }, signal),
    getHabitWeek(id, date, signal),
  ]);
  if (week.date !== date || week.habitId !== id) throw new Error('Unexpected selected week');
  // Empty weekly entries have definitions, not proof that a stored record exists.
  const log = logs.find(entry => calendarLabel(entry.date) === date);
  const day = week.days.find(entry => entry.date === date);
  if (!day) throw new Error('Missing selected day');
  return { log, configuration: log?.configurationSnapshot?.configuration ?? day.configurationSnapshot.configuration };
}

export default function HabitHistoryEditor(props: Props) {
  const [date, setDate] = useState('');
  const valid = validDate(date, props.today);
  return <section aria-labelledby='history-editor-heading' className='mb-6 rounded-2xl bg-dark-card p-6 text-dark-text space-y-3'>
    <h2 id='history-editor-heading' className='text-lg font-semibold'>Corregir un registro</h2>
    <label htmlFor='record-date' className='block'>Fecha del registro</label>
    <input id='record-date' type='text' placeholder='YYYY-MM-DD' value={date}
      aria-invalid={!!date && !valid} aria-describedby='record-date-help'
      onChange={event => setDate(event.target.value)} className='w-full rounded-lg border border-dark-muted bg-dark-bg p-2' />
    <p id='record-date-help' className='text-sm text-dark-muted'>Selecciona una fecha válida YYYY-MM-DD no posterior a hoy. Hoy en tu cuenta: {props.today}.</p>
    {/* Keyed selection removes old form before paint, even while new reads are held. */}
    {valid && <SelectedRecordEditor key={date} {...props} date={date} />}
  </section>;
}

function SelectedRecordEditor({ habit, token, timeZone, today, date, onRecordUpdated }: Props & { date: string }) {
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [correctProgress, setCorrectProgress] = useState(false);
  const [amount, setAmount] = useState('');
  const [completed, setCompleted] = useState(false);
  const [note, setNote] = useState('');
  const lifecycle = useRef<AbortController | null>(null);
  const current = (request: AbortController) => !request.signal.aborted
    && window.location.pathname === `/habits/${habit.habitId}`
    && localStorage.getItem('token') === token && calendarDay(new Date(), timeZone) === today
    && validDate(date, today);

  const applyRead = (data: SelectedRecord) => {
    setSelected(data);
    setAmount(data.log?.amount === undefined ? '' : String(data.log.amount));
    setCompleted(data.log?.completed ?? false);
    setNote(data.log?.note ?? '');
    setCorrectProgress(false);
  };

  useEffect(() => {
    const request = new AbortController();
    lifecycle.current = request;
    const valid = () => !request.signal.aborted && window.location.pathname === `/habits/${habit.habitId}`
      && localStorage.getItem('token') === token && calendarDay(new Date(), timeZone) === today && validDate(date, today);
    void readRecord(habit.habitId, date, request.signal).then(data => {
      if (valid()) applyRead(data);
    }).catch(() => {
      if (valid()) { setError('No se pudo cargar el registro y su objetivo original.'); setReadFailed(true); }
    }).finally(() => { if (valid()) setPending(false); });
    return () => request.abort();
  }, [habit.habitId, date, token, timeZone, today]);

  const refreshReads = async (request: AbortController, afterWrite: boolean) => {
    setPending(true);
    setError(null);
    // Refreshes are read-only. Both sides run even if one fails; retries cannot PATCH.
    const [record, parent] = await Promise.allSettled([
      readRecord(habit.habitId, date, request.signal),
      afterWrite ? onRecordUpdated(request.signal) : Promise.resolve(true),
    ]);
    if (!current(request)) return;
    const failed = record.status === 'rejected' || parent.status === 'rejected' || !parent.value;
    if (!failed && record.status === 'fulfilled') applyRead(record.value);
    setReadFailed(failed);
    if (failed) setError(afterWrite
      ? 'El registro se guardó, pero no se pudo recargar el registro, el historial o la semana.'
      : 'No se pudo cargar el registro y su objetivo original.');
    setPending(false);
  };

  const retryReads = () => {
    const request = lifecycle.current;
    if (request && current(request) && !pending) void refreshReads(request, saved);
  };

  const log = selected?.log;
  const goal = selected?.configuration.goal;
  const schedule = selected?.configuration.schedule;
  const isoDay = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  const scheduled = schedule?.kind !== 'weekdays' || schedule.days.includes(isoDay);
  const mayCorrect = !!log || (isHabitActive(habit) && scheduled);
  const trimmedNote = note.trim();
  const noteChanged = trimmedNote !== (log?.note ?? '').trim();
  const numericAmount = Number(amount);
  const validAmount = !!amount.trim() && Number.isFinite(numericAmount) && numericAmount >= 0 && numericAmount <= 1e9;
  const progressChanged = correctProgress && (!log || (goal?.kind === 'quantity'
    ? !validAmount || log.amount !== numericAmount : log.completed !== completed));
  const changed = noteChanged || progressChanged;
  const maySave = !!selected && mayCorrect && (!!log || correctProgress) && changed && !pending && !readFailed;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = lifecycle.current;
    if (!request || !current(request) || !maySave || !goal) return;
    setError(null);
    if (trimmedNote.length > 2000) { setError('La nota admite como máximo 2000 caracteres después de quitar espacios exteriores.'); return; }
    if (correctProgress && goal.kind === 'quantity' && !validAmount) {
      setError('Introduce una cantidad finita entre 0 y 1000000000.'); return;
    }
    const notePatch = noteChanged ? { note: trimmedNote } : {};
    let payload: UpdateHabitLogPayload;
    if (progressChanged) payload = goal.kind === 'quantity'
      ? { amount: numericAmount, ...notePatch } : { completed, ...notePatch };
    else if (noteChanged) payload = { note: trimmedNote };
    else return;
    setPending(true);
    setSaved(false);
    try {
      await updateHabitLog(habit.habitId, date, payload, request.signal);
      if (!current(request)) return;
      setSaved(true);
      await refreshReads(request, true);
    } catch (cause) {
      if (!current(request)) return;
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 400 ? 'Revisa los datos del registro.'
        : status === 404 ? 'Registro o hábito no encontrado. No se guardaron los cambios.'
        : status === 409 ? 'El registro cambió mientras lo editabas. Recarga la fecha antes de reintentar.'
        : 'No se pudo guardar el registro. Inténtalo de nuevo.');
    } finally { if (current(request)) setPending(false); }
  };

  return <div className='space-y-3 text-sm'>
    {pending && <p role='status'>Cargando o guardando registro…</p>}
    {error && <div role='alert' className='text-red-400'>
      <p>{error}</p>
      {readFailed && <button onClick={retryReads} disabled={pending} className='text-primary disabled:opacity-50'>Reintentar lecturas</button>}
    </div>}
    {saved && !readFailed && !pending && <p role='status'>Registro actualizado.</p>}
    {selected && goal && <>
      <p>Fecha seleccionada: {date}</p>
      <p>{goal.kind === 'quantity' ? `Objetivo original: ${goal.target} ${goal.unit}` : 'Objetivo original: Marcar completado'}</p>
      <p>{log ? `Finalización guardada: ${log.completed ? 'Completado' : 'Sin completar'}` : 'No hay registro en esta fecha.'}</p>
      {goal.kind === 'quantity' && <p>{log?.amount !== undefined ? `Cantidad registrada: ${log.amount} ${goal.unit}`
        : log ? 'Cantidad no registrada (registro antiguo).' : 'Aún no hay cantidad registrada.'}</p>}
      {!log && !isHabitActive(habit) && <p role='note'>Un hábito inactivo no permite crear registros.</p>}
      {!log && !scheduled && <p role='note'>La fecha no está programada.</p>}
      {!log && <p>Para crear un registro, activa Corregir progreso e introduce progreso explícito. Una nota sola no crea registros.</p>}
      <form onSubmit={submit} noValidate className='space-y-3'>
        <fieldset disabled={pending || readFailed} className='space-y-3 disabled:opacity-50'>
          <legend className='sr-only'>Corrección del registro seleccionado</legend>
          <label className='flex items-center gap-2'><input type='checkbox' checked={correctProgress} disabled={!mayCorrect}
            onChange={event => setCorrectProgress(event.target.checked)} />Corregir progreso</label>
          {correctProgress && (goal.kind === 'quantity' ? <div className='space-y-2'>
            <label htmlFor='record-amount' className='block'>Cantidad corregida</label>
            <input id='record-amount' type='text' inputMode='decimal' value={amount} required
              onChange={event => setAmount(event.target.value)} aria-describedby='record-amount-help'
              className='w-full rounded-lg border border-dark-muted bg-dark-bg p-2' />
            <p id='record-amount-help'>Total diario en {goal.unit}, de 0 a 1000000000. Reemplaza la cantidad anterior, no la suma. La finalización se calcula con el objetivo original.</p>
          </div> : <label className='flex items-center gap-2'><input type='checkbox' checked={completed}
            onChange={event => setCompleted(event.target.checked)} />Completado</label>)}
          <label htmlFor='record-note' className='block'>Nota</label>
          <textarea id='record-note' value={note} onChange={event => setNote(event.target.value)} aria-describedby='record-note-help'
            className='w-full rounded-lg border border-dark-muted bg-dark-bg p-2' />
          <p id='record-note-help'>Hasta 2000 caracteres sin espacios exteriores. Deja vacío para borrar la nota. Sin Corregir progreso, la cantidad y la finalización se conservan.</p>
        </fieldset>
        {!changed && <p>No hay cambios para guardar.</p>}
        <div className='flex gap-4'>
          <button type='submit' disabled={!maySave} className='text-primary disabled:opacity-50'>Guardar registro</button>
          {!readFailed && <button type='button' onClick={retryReads} disabled={pending}
            className='text-primary disabled:opacity-50'>Recargar registro</button>}
        </div>
      </form>
    </>}
  </div>;
}
