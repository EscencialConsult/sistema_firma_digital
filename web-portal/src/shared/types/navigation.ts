import type { LucideIcon } from "lucide-react";

export type RouteId =
  | "dashboard"
  | "documents"
  | "signatures"
  | "conformity"
  | "identity"
  | "certificates"
  | "audit"
  | "profile"
  | "admin"
  | "login"
  | "register";

export type AppRoute = {
  id: RouteId;
  label: string;
  icon: LucideIcon;
  path: string;
  hidden?: boolean;
};
