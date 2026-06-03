import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, login, logoutLocal, register, type AuthUser } from "../../shared/services/authService";
import { getAccessToken } from "../../shared/services/apiClient";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string; organizationName?: string }) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getAccessToken()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    fetchMe()
      .then(setUser)
      .catch(() => void logoutLocal())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    async signIn(email, password) {
      setError(null);
      try {
        setUser(await login(email, password));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
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
      void logoutLocal();
      setUser(null);
    },
    async reloadUser() {
      if (!getAccessToken()) return;
      try {
        const u = await fetchMe();
        setUser(u);
      } catch (err) {
        console.error("Failed to reload user", err);
      }
    }
  }), [error, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
