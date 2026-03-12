import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { googleLogin as googleLoginApi, checkStatus } from '../api/auth.api';
import type { AuthUser } from '../api/auth.api';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
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
        if (data.picture) localStorage.setItem('picture', data.picture);
        setToken(data.token);
        setUser({
          fullName: data.fullName,
          email: data.email,
          picture: data.picture,
          roles: data.roles,
        });
      })
      .catch(() => {
        // Token inválido o expirado → limpiar sesión
        localStorage.removeItem('token');
        localStorage.removeItem('fullName');
        localStorage.removeItem('email');
        localStorage.removeItem('picture');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithGoogle = async (credential: string) => {
    const { data } = await googleLoginApi(credential);
    localStorage.setItem('token', data.token);
    localStorage.setItem('fullName', data.fullName);
    if (data.email) localStorage.setItem('email', data.email);
    if (data.picture) localStorage.setItem('picture', data.picture);
    setToken(data.token);
    setUser({
      fullName: data.fullName,
      email: data.email ?? '',
      picture: data.picture,
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('picture');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, loginWithGoogle, logout }}
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
