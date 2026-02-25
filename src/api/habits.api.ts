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

/** Obtiene el historial de logs de un hábito */
export const getHabitLogs = (habitId: string, params?: GetLogsParams) =>
  apiClient.get<HabitLog[]>(`/habits/${habitId}/logs`, { params });

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

/** Marca un hábito como completado */
export const completeHabit = (habitId: string) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/complete`);
