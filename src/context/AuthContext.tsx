import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { googleLogin as googleLoginApi, checkStatus } from '../api/auth.api';
import type { AuthUser } from '../api/auth.api';
import { AuthContext } from './auth-context';
import { clearSession } from '../utils/session';

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(localStorage.getItem('token')),
  );

  // Al montar: si hay token en localStorage llama a check-status para validarlo
  // y obtener datos frescos del usuario (incluido token renovado)
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    checkStatus()
      .then(({ data }) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('fullName', data.fullName);
        localStorage.setItem('email', data.email);
        if (data.picture) localStorage.setItem('picture', data.picture);
        else localStorage.removeItem('picture');
        localStorage.setItem('timeZone', data.timeZone ?? 'UTC');
        setToken(data.token);
        setUser({
          fullName: data.fullName,
          email: data.email,
          picture: data.picture,
          roles: data.roles,
          timeZone: data.timeZone ?? 'UTC',
        });
      })
      .catch(() => {
        // Token inválido o expirado → limpiar sesión
        clearSession();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithGoogle = async (credential: string) => {
    const { data } = await googleLoginApi(credential);
    clearSession();
    localStorage.setItem('token', data.token);
    localStorage.setItem('fullName', data.fullName);
    if (data.email) localStorage.setItem('email', data.email);
    if (data.picture) localStorage.setItem('picture', data.picture);
    localStorage.setItem('timeZone', data.timeZone ?? 'UTC');
    setToken(data.token);
    setUser({
      fullName: data.fullName,
      email: data.email ?? '',
      picture: data.picture,
      timeZone: data.timeZone ?? 'UTC',
    });
  };

  const logout = () => {
    clearSession();
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
