'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onSessionChange, refreshSession, Role, SessionUser, setSession } from './api';

interface LoginResult {
  requiresTotp?: boolean;
}

interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  login: (login: string, password: string, totp?: string, remember?: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onSessionChange(setUser);
    refreshSession().finally(() => setReady(true));
    // renova o token antes de expirar (15 min)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshSession();
    }, 12 * 60_000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  const login = useCallback(async (login: string, password: string, totp?: string, remember?: boolean) => {
    const r = await api<any>('/auth/login', { method: 'POST', json: { login, password, totp, remember } });
    if (r.requiresTotp) return { requiresTotp: true };
    setSession(r.accessToken, r.user);
    return {};
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession(null, null);
  }, []);

  const reload = useCallback(async () => {
    const me = await api<SessionUser>('/auth/me');
    setUser(me);
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && (user.roles.includes('ADMIN') || roles.some((r) => user.roles.includes(r))), [user]);

  const value = useMemo(() => ({ user, ready, login, logout, hasRole, reload }), [user, ready, login, logout, hasRole, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
