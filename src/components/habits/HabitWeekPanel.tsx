import { useEffect, useState } from 'react';
import { getHabitWeek } from '../../api/habits.api';
import type { HabitWeek } from '../../api/habits.api';
import { calendarDay, calendarLabel } from '../../utils/calendar';
import { HabitConfigurationSummary } from './HabitCard';

/** Sólo se monta después de resolver el detalle propio; reintentar nunca escribe. */
export default function HabitWeekPanel({ id, token, timeZone, today, refreshKey }: {
  id: string; token: string | null; timeZone: string; today: string; refreshKey: number;
}) {
  const [week, setWeek] = useState<HabitWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    const current = () => !request.signal.aborted && localStorage.getItem('token') === token
      && calendarDay(new Date(), timeZone) === today;
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const { data } = await getHabitWeek(id, undefined, request.signal);
        calendarLabel(data.date);
        data.days.forEach(day => calendarLabel(day.date));
        if (current()) setWeek(data);
      } catch {
        if (current()) setFailed(true);
      } finally {
        if (current()) setLoading(false);
      }
    }
    void load();
    return () => request.abort();
  }, [id, token, timeZone, today, refreshKey, attempt]);

  return <section aria-labelledby='habit-week-heading' aria-busy={loading}
    className='mb-6 rounded-2xl bg-dark-card p-5 text-dark-text'>
    <h2 id='habit-week-heading' className='mb-3 text-lg font-semibold'>Semana</h2>
    {loading ? <p role='status' className='text-dark-muted'>Cargando semana...</p>
      : failed ? <div role='alert' className='text-red-400'>
        <p>No se pudo cargar la semana.</p>
        <button onClick={() => setAttempt(value => value + 1)} className='mt-2 text-primary'>Reintentar semana</button>
      </div> : week && <>
        <p>Fecha seleccionada: {week.date}</p>
        <p>{week.weekStart} — {week.weekEnd}</p>
        <p className='my-2'>{week.completedDays} días completados (registros guardados).</p>
        {week.weeklyTarget !== undefined && <p>
          Cuota de la fecha seleccionada: {week.weeklyTarget} días · {week.weeklyCompleted ? 'Cumplida' : 'Sin cumplir'}
        </p>}
        <p className='my-2 text-sm text-dark-muted'>Cada día conserva su objetivo original. Las cantidades no se suman.</p>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <caption className='sr-only'>Siete días de la semana y sus objetivos originales</caption>
            <thead><tr><th scope='col'>Fecha</th><th scope='col'>Objetivo original</th><th scope='col'>Progreso</th></tr></thead>
            <tbody>{week.days.map(day => {
              const goal = day.configurationSnapshot.configuration.goal;
              return <tr key={day.date} className='border-t border-dark-muted/20'>
                <th scope='row' className='py-3 pr-3 font-normal whitespace-nowrap'>{day.date}</th>
                <td className='pr-3'><HabitConfigurationSummary configuration={day.configurationSnapshot.configuration} />
                  {!day.scheduled && <p className='text-dark-muted'>No programado</p>}
                </td>
                <td className='py-3'>
                  <p>{day.completed ? 'Completado' : 'Sin completar'}</p>
                  {goal.kind === 'quantity' && <p className='text-dark-muted'>
                    {day.amount === undefined ? 'Cantidad no registrada' : `${day.amount} ${goal.unit}`}
                  </p>}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
  </section>;
}
