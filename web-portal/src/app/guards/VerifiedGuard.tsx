import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function VerifiedGuard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.verificationStatus) {
    case "PENDING":
      return <Navigate to="/kyc" replace />;
    case "IN_REVIEW":
      return <Navigate to="/kyc/pending" replace />;
    case "REJECTED":
      return <Navigate to="/kyc/rejected" replace />;
    default:
      return <Outlet />;
  }
}
