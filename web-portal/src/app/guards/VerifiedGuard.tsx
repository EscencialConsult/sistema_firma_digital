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

  // Admins y super admins no necesitan pasar por KYC
  if (["ADMIN", "ORG_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return <Outlet />;
  }

  switch (user.verificationStatus) {
    case "PENDING":
    case "EXPIRED":
      return <Navigate to="/kyc" replace />;
    case "IN_REVIEW":
      return <Navigate to="/kyc/pending" replace />;
    case "REJECTED":
      return <Navigate to="/kyc/rejected" replace />;
    default: // VERIFIED
      return <Outlet />;
  }
}
