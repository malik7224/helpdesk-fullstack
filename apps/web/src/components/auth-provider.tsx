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
import { api, getStoredToken, TOKEN_KEY, UNAUTHORIZED_EVENT, type User } from "@/lib/api";

type AuthState = { status: "loading" } | { status: "anon" } | { status: "authed"; user: User };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked (private mode); signing out still works in memory.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const logout = useCallback(() => {
    clearToken();
    setState({ status: "anon" });
  }, []);

  // Restore the session from a saved token.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getStoredToken()) {
        setState({ status: "anon" });
        return;
      }
      try {
        const { user } = await api.me();
        if (!cancelled) setState({ status: "authed", user });
      } catch {
        if (!cancelled) logout();
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // The API client fires this when a request comes back 401 (expired token).
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Without storage the session lasts until the page reloads.
    }
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
