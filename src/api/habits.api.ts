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

/** Obtiene todos los hábitos del usuario autenticado */
export const getHabits = () => apiClient.get<Habit[]>('/habits');

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
  amount?: number;
  note?: string;
  configurationSnapshot?: ConfigurationSnapshot;
}

/** Obtiene todos los logs del usuario autenticado (incluye title y slug) */
export const getUserLogs = () => apiClient.get<UserLog[]>('/habits/logs');

/** Cantidad: reemplaza el total diario. Omitir amount conserva el checkbox sin cuerpo. */
export const completeHabit = (habitId: string, amount?: number, signal?: AbortSignal) =>
  apiClient.post<HabitLog>(`/habits/${habitId}/complete`, amount === undefined ? undefined : { amount }, { signal });
