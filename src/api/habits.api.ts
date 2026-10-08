import apiClient from './axios';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // ISO: lunes=1, domingo=7
  | { kind: 'weekly'; timesPerWeek: number };

export type HabitGoal =
  | { kind: 'checkbox' }
  | { kind: 'quantity'; target: number; unit: string };

export interface HabitConfiguration {
  schedule: HabitSchedule;
  goal: HabitGoal;
}

export interface ConfigurationSnapshot {
  configuration: HabitConfiguration;
  revisionId?: string;
  effectiveFrom?: string; // Etiqueta de calendario de la cuenta, no un instante.
}

export interface PendingConfiguration extends ConfigurationSnapshot {
  revisionId: string;
  effectiveFrom: string;
}

export type HabitStatus = 'active' | 'paused' | 'archived';
export type HabitStatusFilter = HabitStatus | 'all';

export interface PersonalHabitDefinition {
  title: string;
  category?: string;
  color?: string;
  icon?: string;
  configuration?: HabitConfiguration;
  pendingConfiguration?: PendingConfiguration;
  status?: HabitStatus;
  active?: boolean;
}

export const LEGACY_CONFIGURATION: HabitConfiguration = {
  schedule: { kind: 'daily' }, goal: { kind: 'checkbox' },
};

export const isHabitActive = (habit: PersonalHabitDefinition) =>
  habit.status ? habit.status === 'active' : (habit.active ?? true);

export interface Habit extends PersonalHabitDefinition {
  habitId: string;
  slug?: string;
  completedToday?: boolean;
}

export interface HabitLog {
  _id: string;
  userId: string;
  habitId: string;
  date: string;
  completed: boolean;
  manualCompletion?: boolean;
  amount?: number;
  note?: string;
  configurationSnapshot?: ConfigurationSnapshot;
}

export interface HabitWeekDay {
  date: string;
  scheduled: boolean;
  completed: boolean;
  amount?: number;
  note?: string;
  configurationSnapshot: ConfigurationSnapshot;
}

export interface HabitWeek {
  habitId: string;
  date: string;
  weekStart: string;
  weekEnd: string;
  configuration: HabitConfiguration;
  scheduledOnDate: boolean;
  completedDays: number;
  weeklyTarget?: number;
  weeklyCompleted?: boolean;
  days: HabitWeekDay[];
}

export interface CreateHabitPayload {
  title: string;
  category?: string;
  color?: string;
  icon?: string;
  configuration?: HabitConfiguration;
}

/** Los campos omitidos se conservan; "" borra metadatos opcionales. */
export type UpdateHabitPayload = Partial<CreateHabitPayload>;

export interface HabitActiveResponse extends PersonalHabitDefinition {
  _id: string;
  habitId: string;
  userId: string;
  active: boolean;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Sin filtro, conserva la lista activa por defecto de la API. */
export const getHabits = (status?: HabitStatusFilter, signal?: AbortSignal) =>
  apiClient.get<Habit[]>('/habits', { params: status ? { status } : undefined, signal });

export interface GetLogsParams {
  startDate?: string; // ISO 8601 ej: "2026-02-01"
  endDate?: string;
}

export interface HabitDetail extends Habit {
  slug: string;
  active: boolean;
}

/** Detalle autoritativo de la asociación del usuario, incluso si está inactiva. */
export const getHabitById = (habitId: string, signal?: AbortSignal) =>
  apiClient.get<HabitDetail>(`/habits/${habitId}`, { signal });

/** Sin fechas explícitas, la API usa el mes actual de la cuenta. */
export const getHabitLogs = (habitId: string, params?: GetLogsParams, signal?: AbortSignal) =>
  apiClient.get<HabitLog[]>(`/habits/${habitId}/logs`, { params, signal });

/** Sin fecha explícita, selecciona hoy en el calendario de la cuenta. */
export const getHabitWeek = (habitId: string, date?: string, signal?: AbortSignal) =>
  apiClient.get<HabitWeek>(`/habits/${habitId}/week`, { params: date ? { date } : undefined, signal });

export type CreateHabitResponse = HabitActiveResponse;

/** Crea un nuevo hábito sin exponer el historial de revisiones. */
export const createHabit = (payload: CreateHabitPayload, signal?: AbortSignal) =>
  apiClient.post<CreateHabitResponse>('/habits', payload, { signal });

/** Edita sólo la definición personal; no usa el PATCH de desactivación. */
export const updateHabitDefinition = (habitId: string, payload: UpdateHabitPayload, signal?: AbortSignal) =>
  apiClient.patch<HabitDetail>(`/habits/${habitId}/definition`, payload, { signal });

// La respuesta de asociación puede omitir título/slug de catálogo en filas antiguas.
export interface HabitLifecycleResponse extends Partial<PersonalHabitDefinition> {
  habitId: string;
  status: HabitStatus;
  active: boolean;
}

export const updateHabitLifecycle = (habitId: string, status: HabitStatus, signal?: AbortSignal) =>
  apiClient.patch<HabitLifecycleResponse>(`/habits/${habitId}/lifecycle`, { status }, { signal });

/** PATCH antiguo: pausa sin restaurar archivos; se conserva por compatibilidad. */
export const toggleHabit = (habitId: string) =>
  apiClient.patch<HabitActiveResponse>(`/habits/${habitId}`);

export interface IncompleteResponse {
  acknowledged: boolean;
  deletedCount: number;
}

/** Desmarca el hábito como completado (borra el log de hoy) */
export const incompleteHabit = (habitId: string, signal?: AbortSignal) =>
  apiClient.delete<IncompleteResponse>(`/habits/${habitId}/incomplete`, { signal });

export interface UserLog {
  _id: string;
  habitId: string;
  date: string;
  completed: boolean;
  title: string;
  slug: string;
  amount?: number;
  note?: string;
  configurationSnapshot?: ConfigurationSnapshot;
}

/** Obtiene todos los logs del usuario autenticado (incluye title y slug) */
export const getUserLogs = (signal?: AbortSignal) => apiClient.get<UserLog[]>('/habits/logs', { signal });

/** Sólo progreso explícito o nota; nunca se envían snapshots desde el cliente. */
export type UpdateHabitLogPayload =
  | { note: string; amount?: never; completed?: never }
  | { amount: number; note?: string; completed?: never }
  | { completed: boolean; note?: string; amount?: never };

export const updateHabitLog = (habitId: string, date: string, payload: UpdateHabitLogPayload, signal?: AbortSignal) =>
  apiClient.patch<HabitLog>(`/habits/${habitId}/logs/${date}`, payload, { signal });

/** Marca manualmente hoy, incluso en hábitos antiguos de cantidad o con otro horario. */
export const checkHabit = (habitId: string, signal?: AbortSignal) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/check`, undefined, { signal });

/** Cantidad: reemplaza el total diario. Omitir amount conserva el checkbox sin cuerpo. */
export const completeHabit = (habitId: string, amount?: number, signal?: AbortSignal) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/complete`, amount === undefined ? undefined : { amount }, { signal });
