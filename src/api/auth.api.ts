import apiClient from './axios';
import { detectedTimeZone } from '../utils/calendar';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  timeZone: string;
  fullName: string;
  email?: string;
  picture?: string;
  roles?: string[];
}

export interface AuthResponse {
  timeZone: string;
  token: string;
  fullName: string;
  email?: string;
  picture?: string;
}

export interface CheckStatusResponse {
  timeZone: string;
  _id: string;
  fullName: string;
  email: string;
  picture?: string;
  roles: string[];
  token: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const googleLogin = (credential: string) =>
  apiClient.post<AuthResponse>('/auth/google', { idToken: credential, timeZone: detectedTimeZone() });

export const checkStatus = () =>
  apiClient.get<CheckStatusResponse>('/auth/check-status');
