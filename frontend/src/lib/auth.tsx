"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as api from "./api";
import type { LoginResponse } from "./types";

export type Role = "FIELD_OFFICER" | "DGM_ADMIN" | string;

interface Session {
  token: string;
  role: Role;
  name: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}


const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "bhunetra.session";

let memorySession: string | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memorySession;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const rawSession = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const router = useRouter();

  const session = useMemo<Session | null>(() => {
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession);
    } catch {
      return null;
    }
  }, [rawSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    const next: Session = { token: res.access_token, role: res.role, name: res.name };
    const serialized = JSON.stringify(next);
    memorySession = serialized;
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
    emitChange();
    return res;
  }, []);


  const logout = useCallback(() => {
    memorySession = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    emitChange();
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ session, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

