/**
 * Persiste en localStorage qué hábitos fueron completados hoy.
 * La clave incluye la fecha para que se resetee automáticamente al día siguiente.
 */

const getKey = () => {
  const today = new Date().toISOString().split('T')[0]; // "2026-02-25"
  return `completedHabits_${today}`;
};

export const getCompletedToday = (): Set<string> => {
  try {
    const raw = localStorage.getItem(getKey());
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

export const markCompleted = (habitId: string) => {
  const set = getCompletedToday();
  set.add(habitId);
  localStorage.setItem(getKey(), JSON.stringify([...set]));
};

export const markIncomplete = (habitId: string) => {
  const set = getCompletedToday();
  set.delete(habitId);
  localStorage.setItem(getKey(), JSON.stringify([...set]));
};
