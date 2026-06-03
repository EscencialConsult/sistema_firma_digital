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
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "documents", label: "Documentos", icon: Files },
  { id: "signatures", label: "Solicitudes", icon: FileSignature },
  { id: "conformity", label: "Conformidad", icon: ClipboardCheck },
  { id: "identity", label: "Identidad", icon: IdCard },
  { id: "certificates", label: "Certificados", icon: KeyRound },
  { id: "audit", label: "Auditoria", icon: FileClock },
  { id: "profile", label: "Perfil", icon: UserCircle },
  { id: "admin", label: "Admin", icon: UsersRound },
  { id: "login", label: "Login", icon: ShieldCheck, hidden: true },
  { id: "register", label: "Registro", icon: BadgeCheck, hidden: true }
];

