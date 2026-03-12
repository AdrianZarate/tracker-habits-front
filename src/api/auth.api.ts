import apiClient from './axios';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  fullName: string;
  email?: string;
  picture?: string;
  roles?: string[];
}

export interface AuthResponse {
  token: string;
  fullName: string;
  email?: string;
  picture?: string;
}

export interface CheckStatusResponse {
  _id: string;
  fullName: string;
  email: string;
  picture?: string;
  roles: string[];
  token: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const googleLogin = (credential: string) =>
  apiClient.post<AuthResponse>('/auth/google', { idToken: credential });

export const checkStatus = () =>
  apiClient.get<CheckStatusResponse>('/auth/check-status');
