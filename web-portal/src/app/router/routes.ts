import {
  BadgeCheck,
  ClipboardCheck,
  FileClock,
  FileSignature,
  Files,
  Gauge,
  IdCard,
  KeyRound,
  ShieldCheck,
  UserCircle,
  UsersRound
} from "lucide-react";
import type { AppRoute } from "../../shared/types/navigation";

export const routes: AppRoute[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge, path: "/dashboard" },
  { id: "documents", label: "Documentos", icon: Files, path: "/documents" },
  { id: "signatures", label: "Solicitudes", icon: FileSignature, path: "/signatures" },
  { id: "conformity", label: "Conformidad", icon: ClipboardCheck, path: "/conformity" },
  { id: "identity", label: "Identidad", icon: IdCard, path: "/identity" },
  { id: "certificates", label: "Certificados", icon: KeyRound, path: "/certificates" },
  { id: "audit", label: "Auditoria", icon: FileClock, path: "/audit" },
  { id: "profile", label: "Perfil", icon: UserCircle, path: "/profile" },
  { id: "admin", label: "Admin", icon: UsersRound, path: "/admin" },
  { id: "login", label: "Login", icon: ShieldCheck, path: "/login", hidden: true },
  { id: "register", label: "Registro", icon: BadgeCheck, path: "/register", hidden: true }
];
