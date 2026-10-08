import apiClient from './axios';

// La API conserva los campos antiguos; el núcleo sólo consume nombre, estado y registros.
export type HabitStatus = 'active' | 'paused' | 'archived';

export interface PersonalHabitDefinition {
  title: string;
  status?: HabitStatus;
  active?: boolean;
}

export const isHabitActive = (habit: PersonalHabitDefinition) =>
  habit.status ? habit.status === 'active' : (habit.active ?? true);

export interface Habit extends PersonalHabitDefinition {
  habitId: string;
  completedToday?: boolean;
}

export interface HabitLog {
  _id: string;
  habitId: string;
  date: string;
  completed: boolean;
  manualCompletion?: boolean;
}

export interface CreateHabitPayload {
  title: string;
}

/** Omitir el nombre conserva la definición almacenada. */
export type UpdateHabitPayload = Partial<CreateHabitPayload>;

export interface HabitActiveResponse extends PersonalHabitDefinition {
  habitId: string;
  active: boolean;
}

/** Sin filtro, conserva la lista activa por defecto de la API. */
export const getHabits = (status?: HabitStatus | 'all', signal?: AbortSignal) =>
  apiClient.get<Habit[]>('/habits', { params: status ? { status } : undefined, signal });

export interface GetLogsParams {
  startDate?: string;
  endDate?: string;
}

export interface HabitDetail extends Habit {
  active: boolean;
}

/** Detalle autoritativo de la asociación del usuario, incluso si está oculta. */
export const getHabitById = (habitId: string, signal?: AbortSignal) =>
  apiClient.get<HabitDetail>(`/habits/${habitId}`, { signal });

/** Sin fechas explícitas, la API usa el mes actual de la cuenta. */
export const getHabitLogs = (habitId: string, params?: GetLogsParams, signal?: AbortSignal) =>
  apiClient.get<HabitLog[]>(`/habits/${habitId}/logs`, { params, signal });

export type CreateHabitResponse = HabitActiveResponse;

/** Crea un hábito con nombre, sin convertir sus datos anteriores. */
export const createHabit = (payload: CreateHabitPayload, signal?: AbortSignal) =>
  apiClient.post<CreateHabitResponse>('/habits', payload, { signal });

/** Edita sólo el nombre personal. */
export const updateHabitDefinition = (habitId: string, payload: UpdateHabitPayload, signal?: AbortSignal) =>
  apiClient.patch<HabitDetail>(`/habits/${habitId}/definition`, payload, { signal });

export interface HabitLifecycleResponse extends Partial<PersonalHabitDefinition> {
  habitId: string;
  status: HabitStatus;
  active: boolean;
}

export const updateHabitLifecycle = (habitId: string, status: HabitStatus, signal?: AbortSignal) =>
  apiClient.patch<HabitLifecycleResponse>(`/habits/${habitId}/lifecycle`, { status }, { signal });

export interface IncompleteResponse {
  acknowledged: boolean;
  deletedCount: number;
}

/** Desmarca hoy: conserva el comportamiento de borrar el registro del día. */
export const incompleteHabit = (habitId: string, signal?: AbortSignal) =>
  apiClient.delete<IncompleteResponse>(`/habits/${habitId}/incomplete`, { signal });

/** Registros del usuario autenticado; se consume la finalización guardada. */
export const getUserLogs = (signal?: AbortSignal) => apiClient.get<HabitLog[]>('/habits/logs', { signal });

/** Marca manualmente hoy, incluso en hábitos antiguos de cantidad o con otro horario. */
export const checkHabit = (habitId: string, signal?: AbortSignal) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/check`, undefined, { signal });
