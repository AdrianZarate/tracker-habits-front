// Instants use the account zone; historical dates are immutable calendar labels.
export function calendarDay(instant: Date = new Date(), timeZone = 'UTC'): string {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid instant');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', era: 'short',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  const year = part('year').padStart(4, '0');
  if (part('era') !== 'AD' || year.length !== 4) throw new RangeError('Unsupported year');
  return `${year}-${part('month')}-${part('day')}`;
}

export function calendarLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00\.000Z)?$/.test(value)) throw new RangeError('Invalid calendar anchor');
  const label = value.slice(0, 10);
  const date = new Date(`${label}T00:00:00.000Z`);
  if (label.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== label) {
    throw new RangeError('Invalid calendar label');
  }
  return label;
}

export function formatCalendarLabel(value: string, locale = 'es-ES', options: Intl.DateTimeFormatOptions = {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
}): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    .format(new Date(`${calendarLabel(value)}T00:00:00.000Z`));
}

// Search the actual next label boundary, not an assumed 24-hour duration (DST).
export function nextCalendarDayDelay(now: Date, timeZone: string): number {
  const start = now.getTime();
  const today = calendarDay(now, timeZone);
  let low = 0, high = 48 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDay(new Date(start + middle), timeZone) === today) low = middle;
    else high = middle;
  }
  return high;
}

export function detectedTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}
