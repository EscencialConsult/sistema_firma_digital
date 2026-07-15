import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 text-sm text-zinc-400">
        Verificando sesión...
      </div>
    );
  }
  if (!user) {
    const slug = localStorage.getItem("lastOrgSlug");
    return <Navigate to={slug ? `/${slug}` : "/login"} replace />;
  }
  return <Outlet />;
}
