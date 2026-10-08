import { useEffect, useState } from 'react';
import { calendarDay, nextCalendarDayDelay } from '../utils/calendar';

export function useCalendarDay(timeZone: string): string {
  const [day, setDay] = useState(() => calendarDay(new Date(), timeZone));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(calendarDay(now, timeZone));
      timer = setTimeout(refresh, Math.min(60_000, nextCalendarDayDelay(now, timeZone)));
    };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    // Async initial refresh also handles a changed zone without effect-state lint violations.
    timer = setTimeout(refresh, 0);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [timeZone]);
  return day;
}
