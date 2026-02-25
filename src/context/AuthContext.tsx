import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  login as loginApi,
  register as registerApi,
  checkStatus,
} from '../api/auth.api';
import type { AuthUser, LoginPayload, RegisterPayload } from '../api/auth.api';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

// ── Contexto ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Al montar: si hay token en localStorage llama a check-status para validarlo
  // y obtener datos frescos del usuario (incluido token renovado)
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    checkStatus()
      .then(({ data }) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('fullName', data.fullName);
        localStorage.setItem('email', data.email);
        setToken(data.token);
        setUser({
          fullName: data.fullName,
          email: data.email,
          roles: data.roles,
        });
      })
      .catch(() => {
        // Token inválido o expirado → limpiar sesión
        localStorage.removeItem('token');
        localStorage.removeItem('fullName');
        localStorage.removeItem('email');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (payload: LoginPayload) => {
    const { data } = await loginApi(payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('fullName', data.fullName);
    if (data.email) localStorage.setItem('email', data.email);
    setToken(data.token);
    setUser({
      fullName: data.fullName,
      email: data.email ?? localStorage.getItem('email') ?? '',
    });
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await registerApi(payload);
    localStorage.setItem('token', data.token);
    localStorage.setItem('fullName', data.fullName);
    if (data.email) localStorage.setItem('email', data.email);
    setToken(data.token);
    setUser({ fullName: data.fullName, email: data.email ?? '' });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
