import { calendarDay } from './calendar';

// Optional zone keeps detail callers compatible until T4; never use device zone.
const storedZone = () => localStorage.getItem('timeZone') ?? 'UTC';
const getKey = (timeZone: string) => `completedHabits_${calendarDay(new Date(), timeZone)}`;

export const getCompletedToday = (timeZone = storedZone()): Set<string> => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(getKey(timeZone)) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

export const markCompleted = (habitId: string, timeZone = storedZone()) => {
  const set = getCompletedToday(timeZone);
  set.add(habitId);
  localStorage.setItem(getKey(timeZone), JSON.stringify([...set]));
};

export const markIncomplete = (habitId: string, timeZone = storedZone()) => {
  const set = getCompletedToday(timeZone);
  set.delete(habitId);
  localStorage.setItem(getKey(timeZone), JSON.stringify([...set]));
};
