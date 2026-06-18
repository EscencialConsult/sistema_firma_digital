import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function VerifiedGuard() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 text-sm text-zinc-400">
        Verificando identidad...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  switch (user.verificationStatus) {
    case "PENDING":
      return <Navigate to="/kyc" replace />;
    case "REJECTED":
      return <Navigate to="/kyc/rejected" replace />;
    case "EXPIRED":
      return <Navigate to="/kyc" replace />;
    default:
      return <Outlet />;
  }
}
