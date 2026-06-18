import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function SuperAdminGuard() {
  const { user } = useAuth();
  if (!user || user.role !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
