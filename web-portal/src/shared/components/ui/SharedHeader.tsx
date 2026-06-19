import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

type HeaderVariant = "user" | "admin" | "super-admin";

interface SharedHeaderProps {
  variant: HeaderVariant;
  onMobileOpen: () => void;
  title?: string;
  showSearch?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Panel de Administración",
  ORG_ADMIN: "Panel de Organización",
};

export function SharedHeader({ variant, onMobileOpen, title, showSearch = false }: SharedHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isDark = variant === "super-admin";
  const bgHeader = isDark ? "bg-zinc-950/90 border-zinc-800/60" : "bg-white/90 border-zinc-200/60";
  const textIcon = isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900";
  const borderIcon = isDark ? "border-zinc-800" : "border-zinc-200";
  const textTitle = isDark ? "text-zinc-400" : "text-zinc-600";

  const defaultTitle = variant === "admin" 
    ? (ROLE_LABEL[user?.role ?? ""] ?? "Panel de Administración")
    : variant === "super-admin"
    ? "Panel Super Administrador"
    : "";

  return (
    <header className={`sticky top-0 z-10 border-b backdrop-blur ${bgHeader}`}>
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <button
          onClick={onMobileOpen}
          className={`grid h-9 w-9 place-items-center rounded-xl border lg:hidden transition-colors ${borderIcon} ${textIcon}`}
          type="button"
        >
          <Menu size={16} />
        </button>

        {showSearch ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200/50 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-400 md:max-w-md hover:bg-zinc-100/40 transition duration-200 cursor-pointer lg:ml-0">
            <Search size={16} />
            <span className="truncate">Buscar documentos, firmantes o auditorías</span>
          </div>
        ) : (
          <p className={`text-sm font-semibold ${textTitle} hidden lg:block`}>
            {title || defaultTitle}
          </p>
        )}

        <div className="flex flex-1 items-center gap-3 justify-end">
          {variant === "user" && (
            <>
              <div className="hidden text-right text-xs md:block mr-2">
                <p className="font-semibold text-zinc-800">{user?.fullName}</p>
                <p className="text-zinc-400 font-mono">{user?.email}</p>
              </div>
              <button
                className="hidden rounded-[var(--radius-button)] bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] transition-all md:inline-flex"
                type="button"
                onClick={() => navigate("/documents")}
              >
                Subir PDF
              </button>
            </>
          )}

          <button
            className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors ${borderIcon} ${textIcon}`}
            type="button"
            title="Notificaciones"
          >
            <Bell size={16} />
          </button>
          
          {variant === "user" && (
            <button
              className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors hover:text-red-600 ${borderIcon} ${textIcon}`}
              type="button"
              title="Cerrar sesión"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
