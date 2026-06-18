import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../shared/lib/supabase";
import {
  login,
  register,
  logout as logoutService,
  fetchProfile,
  fetchMe,
} from "../../shared/services/auth.service";
import type { AuthUser } from "../../shared/types/user";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    // Safety timeout: force loading off after 10s to prevent blank screen
    const safetyTimer = setTimeout(() => setLoading(false), 10000);

    // Listen for Supabase auth state changes (fires INITIAL_SESSION immediately)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id, session.user);
            setUser(profile);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        } finally {
          // Mark loading done after the initial session check
          if (event === "INITIAL_SESSION") {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,

      async signIn(email, password) {
        setError(null);
        try {
          const user = await login(email, password);
          setUser(user);
        } catch (err) {
          const message = err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null
              ? ((err as Record<string, unknown>)?.message as string) ?? "No se pudo iniciar sesión."
              : "No se pudo iniciar sesión.";
          setError(message);
          throw err;
        }
      },

      async signUp(input) {
        setError(null);
        try {
          const user = await register(input);
          setUser(user);
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
          throw err;
        }
      },

      logout() {
        void logoutService();
        setUser(null);
      },

      async reloadUser() {
        const u = await fetchMe();
        if (u) setUser(u);
      },

      // Optimistic local update — call reloadUser() to sync from DB
      updateUser(updates) {
        setUser((prev) => (prev ? { ...prev, ...updates } : prev));
      },
    }),
    [error, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
