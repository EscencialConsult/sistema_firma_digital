import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  login,
  register,
  restoreSession,
  logout as logoutService,
  fetchMe,
  updateSessionUser,
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    restoreSession()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      async signIn(email, password) {
        setError(null);
        try {
          setUser(await login(email, password));
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
          throw err;
        }
      },
      async signUp(input) {
        setError(null);
        try {
          setUser(await register(input));
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
      updateUser(updates) {
        const updated = updateSessionUser(updates);
        if (updated) setUser(updated);
      },
    }),
    [error, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
