import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function AdminGuard() {
  const { user } = useAuth();
  if (!user || user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
