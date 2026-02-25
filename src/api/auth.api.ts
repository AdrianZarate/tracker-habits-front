import apiClient from './axios';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  fullName: string;
  email?: string;
  roles?: string[];
}

export interface AuthResponse {
  token: string;
  fullName: string;
  email?: string;
}

export interface CheckStatusResponse {
  _id: string;
  fullName: string;
  email: string;
  roles: string[];
  token: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const register = (payload: RegisterPayload) =>
  apiClient.post<AuthResponse>('/auth/register', payload);

export const login = (payload: LoginPayload) =>
  apiClient.post<AuthResponse>('/auth/login', payload);

export const checkStatus = () =>
  apiClient.get<CheckStatusResponse>('/auth/check-status');
