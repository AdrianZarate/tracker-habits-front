import apiClient from './axios';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Habit {
  habitId: string;
  title: string;
  slug?: string;
  completedToday?: boolean;
}

export interface HabitLog {
  _id: string;
  userId: string;
  habitId: string;
  date: string;
  completed: boolean;
}

export interface CreateHabitPayload {
  title: string;
}

export type UpdateHabitPayload = { title: string };

export interface HabitActiveResponse {
  _id: string;
  habitId: string;
  userId: string;
  active: boolean;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Obtiene todos los hábitos del usuario autenticado */
export const getHabits = () => apiClient.get<Habit[]>('/habits');

export interface GetLogsParams {
  startDate?: string; // ISO 8601 ej: "2026-02-01"
  endDate?: string;
}

export interface HabitDetail {
  habitId: string;
  title: string;
  slug: string;
  active: boolean;
}

/** Detalle autoritativo de la asociación del usuario, incluso si está inactiva. */
export const getHabitById = (habitId: string, signal?: AbortSignal) =>
  apiClient.get<HabitDetail>(`/habits/${habitId}`, { signal });

/** Sin fechas explícitas, la API usa el mes actual de la cuenta. */
export const getHabitLogs = (habitId: string, params?: GetLogsParams, signal?: AbortSignal) =>
  apiClient.get<HabitLog[]>(`/habits/${habitId}/logs`, { params, signal });

export interface CreateHabitResponse {
  _id: string;
  habitId: string;
  userId: string;
  active: boolean;
}

/** Crea un nuevo hábito */
export const createHabit = (payload: CreateHabitPayload) =>
  apiClient.post<CreateHabitResponse>('/habits', payload);

/** Cambia el estado activo/inactivo de un hábito (toggle) */
export const toggleHabit = (habitId: string) =>
  apiClient.patch<HabitActiveResponse>(`/habits/${habitId}`);

export interface IncompleteResponse {
  acknowledged: boolean;
  deletedCount: number;
}

/** Desmarca el hábito como completado (borra el log de hoy) */
export const incompleteHabit = (habitId: string) =>
  apiClient.delete<IncompleteResponse>(`/habits/${habitId}/incomplete`);

export interface UserLog {
  _id: string;
  habitId: string;
  date: string;
  completed: boolean;
  title: string;
  slug: string;
}

/** Obtiene todos los logs del usuario autenticado (incluye title y slug) */
export const getUserLogs = () => apiClient.get<UserLog[]>('/habits/logs');

/** Marca un hábito como completado */
export const completeHabit = (habitId: string) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/complete`);
