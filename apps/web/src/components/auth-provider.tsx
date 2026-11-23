"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, UNAUTHORIZED_EVENT, type User } from "@/lib/api";

type AuthState = { status: "loading" } | { status: "anon" } | { status: "authed"; user: User };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const logout = useCallback(() => {
    setState({ status: "anon" });
    // Ask the API to clear the cookie. If that fails the cookie simply expires on its own.
    api.logout().catch(() => undefined);
  }, []);

  // Restore the session from the cookie, if there is one.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const { user } = await api.me();
        if (!cancelled) setState({ status: "authed", user });
      } catch {
        if (!cancelled) setState({ status: "anon" });
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client fires this when a request comes back 401 (expired token).
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setState({ status: "authed", user });
  }, []);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
