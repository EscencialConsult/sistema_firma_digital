import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { supabase } from "../../lib/supabase";
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  DbNotification 
} from "../../services/notifications.service";
import { 
  Bell, 
  LogOut, 
  Menu, 
  Search, 
  X, 
  CheckCheck, 
  Gauge, 
  FileText, 
  History, 
  UserCircle, 
  ShieldCheck, 
  Users, 
  IdCard, 
  ClipboardList, 
  FileClock, 
  UsersRound, 
  Settings, 
  LayoutDashboard, 
  Building2,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

type HeaderVariant = "user" | "admin" | "super-admin";

interface SharedHeaderProps {
  variant: HeaderVariant;
  onMobileOpen: () => void;
  title?: string;
  showSearch?: boolean;
}

interface SearchItem {
  title: string;
  path: string;
  description: string;
  category: string;
  icon: React.ComponentType<any>;
}

// Relative time calculation helper
export function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  return `Hace ${diffDays} días`;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Panel de Administración",
  ORG_ADMIN: "Panel de Organización",
};

export function SharedHeader({ variant, onMobileOpen, title, showSearch = false }: SharedHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // States
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Theme settings
  const isDark = variant === "super-admin";
  const bgHeader = isDark ? "bg-zinc-950/90 border-zinc-800/60" : "bg-white/90 border-zinc-200/60";
  const textIcon = isDark ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900";
  const borderIcon = isDark ? "border-zinc-800" : "border-zinc-200";
  const textTitle = isDark ? "text-zinc-400" : "text-zinc-600";
  
  const bgDropdown = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-105" : "bg-white border-zinc-200 text-zinc-800";

  const defaultTitle = variant === "admin" 
    ? (ROLE_LABEL[user?.role ?? ""] ?? "Panel de Administración")
    : variant === "super-admin"
    ? "Panel Super Administrador"
    : "";

  const getInitialNotifications = (roleVariant: HeaderVariant) => {
    if (roleVariant === "user") {
      return [
        {
          title: "Identidad verificada",
          description: "Tu verificación de identidad mediante DNI fue aprobada con éxito.",
          type: "success" as const,
          link: "/profile",
        },
        {
          title: "Firma pendiente",
          description: "Tienes un contrato pendiente de firma: 'Acuerdo Confidencialidad.pdf'.",
          type: "info" as const,
          link: "/signatures",
        },
        {
          title: "Documento completado",
          description: "El documento 'Contrato de Alquiler.pdf' ha sido firmado por todos los destinatarios.",
          type: "success" as const,
          link: "/signatures",
        },
      ];
    } else if (roleVariant === "admin") {
      return [
        {
          title: "KYC Pendiente",
          description: "Nueva verificación de identidad recibida y en espera de revisión.",
          type: "info" as const,
          link: "/admin/kyc",
        },
        {
          title: "Nuevo usuario",
          description: "El usuario 'maria.lopez@empresa.com' se ha registrado en tu organización.",
          type: "success" as const,
          link: "/admin/users",
        },
        {
          title: "Alerta de Auditoría",
          description: "Intento de descarga de documento fallido desde la IP 181.44.20.10.",
          type: "warning" as const,
          link: "/admin/audit",
        },
      ];
    } else {
      return [
        {
          title: "Nueva organización",
          description: "Se ha registrado la organización 'Acme Corp S.A.' en el sistema.",
          type: "success" as const,
          link: "/super-admin/organizations",
        },
        {
          title: "Límite superado",
          description: "La organización 'Firma Fiel' superó el 90% del límite de firmas mensual.",
          type: "warning" as const,
          link: "/super-admin/settings",
        },
        {
          title: "Configuración global",
          description: "Se han actualizado las credenciales de la API de Didit global.",
          type: "info" as const,
          link: "/super-admin/settings",
        },
      ];
    }
  };
  void getInitialNotifications;

  // Load initial notifications from database and setup Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const loadNotifications = async () => {
      try {
        const data = await getNotifications(user.id);
        setNotifications(data);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    };

    loadNotifications();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`notifications:user_id=eq.${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as DbNotification;
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedNotif = payload.new as DbNotification;
            setNotifications(prev =>
              prev.map(n => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedNotif = payload.old as { id: string };
            setNotifications(prev =>
              prev.filter(n => n.id !== deletedNotif.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Command palette navigation items
  const getSearchItems = (roleVariant: HeaderVariant, isOrgAdmin: boolean): SearchItem[] => {
    const userItems: SearchItem[] = [
      { title: "Dashboard / Resumen", path: "/dashboard", description: "Ver tus estadísticas y firmas pendientes", category: "Navegación", icon: Gauge },
      { title: "Mis Contratos", path: "/signatures", description: "Ver, descargar y firmar documentos", category: "Navegación", icon: FileText },
      { title: "Historial de Actividad", path: "/audit", description: "Ver bitácora de auditoría personal", category: "Seguridad", icon: History },
      { title: "Mi Perfil e Identidad", path: "/profile", description: "Gestionar tu firma y datos personales", category: "Configuración", icon: UserCircle },
    ];

    const adminItems: SearchItem[] = [
      { title: "Panel General", path: "/admin", description: "Métricas generales y estadísticas", category: "Navegación", icon: ShieldCheck },
      { title: "Gestión de Usuarios", path: "/admin/users", description: "Administrar cuentas y roles", category: "Administración", icon: Users },
      { title: "Verificaciones KYC", path: "/admin/kyc", description: "Validar identidades de usuarios", category: "Administración", icon: IdCard },
      { title: "Contratos de la Org", path: "/admin/contracts", description: "Historial completo de firmas", category: "Administración", icon: ClipboardList },
      { title: "Logs de Auditoría", path: "/admin/audit", description: "Registro detallado de acciones del sistema", category: "Seguridad", icon: FileClock },
      { title: "Mi Equipo", path: "/admin/team", description: "Invitar y gestionar administradores", category: "Administración", icon: UsersRound },
      { title: "Configuración de Organización", path: "/admin/settings", description: "Ajustar límites e integraciones", category: "Configuración", icon: Settings },
    ];

    const superAdminItems: SearchItem[] = [
      { title: "Panel General Super Admin", path: "/super-admin", description: "Estadísticas globales de la plataforma", category: "Navegación", icon: LayoutDashboard },
      { title: "Organizaciones", path: "/super-admin/organizations", description: "Crear y editar organizaciones", category: "Administración", icon: Building2 },
      { title: "Configuración Global", path: "/super-admin/settings", description: "Ajustes de API de Didit y sistema", category: "Configuración", icon: Settings },
    ];

    if (roleVariant === "user") {
      if (isOrgAdmin) {
        return [
          ...userItems, 
          { title: "Panel de Admin", path: "/admin", description: "Ir al panel administrativo de la organización", category: "Acceso Rápido", icon: ShieldCheck }
        ];
      }
      return userItems;
    } else if (roleVariant === "admin") {
      return adminItems;
    } else {
      return superAdminItems;
    }
  };

  const isOrgAdmin = user?.role === "ADMIN" || user?.role === "ORG_ADMIN";
  const searchItems = getSearchItems(variant, isOrgAdmin);

  // Global key listener for Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to close notifications and search dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search filtering
  const filteredItems = searchItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selected item when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetItem = filteredItems[activeIndex];
      if (targetItem) {
        navigate(targetItem.path);
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      await markAllNotificationsAsRead(user.id);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      // Reload on error
      getNotifications(user.id).then(setNotifications).catch(() => {});
    }
  };

  const handleNotificationClick = async (notif: DbNotification) => {
    if (!user?.id) return;
    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
      );
      await markNotificationAsRead(notif.id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
    setNotificationsOpen(false);
    navigate(notif.link);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: DbNotification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={15} className="text-emerald-500" />;
      case "warning":
        return <AlertTriangle size={15} className="text-amber-500" />;
      case "error":
        return <X size={15} className="text-rose-500" />;
      default:
        return <Info size={15} className="text-blue-500" />;
    }
  };

  const getNotificationBg = (type: DbNotification["type"], read: boolean) => {
    if (read) return "opacity-75";
    switch (type) {
      case "success":
        return isDark ? "bg-emerald-500/5" : "bg-emerald-50/40";
      case "warning":
        return isDark ? "bg-amber-500/5" : "bg-amber-50/40";
      case "error":
        return isDark ? "bg-rose-500/5" : "bg-rose-50/40";
      default:
        return isDark ? "bg-blue-500/5" : "bg-blue-50/40";
    }
  };

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
          <div ref={searchContainerRef} className="relative flex-1 min-w-0 md:max-w-md lg:ml-0 z-50">
            <div 
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-1.5 text-sm transition duration-200 ${
                isDark 
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-300 focus-within:border-zinc-700 focus-within:bg-zinc-900/80" 
                  : "border-zinc-200/50 bg-zinc-50 text-zinc-800 focus-within:border-zinc-300 focus-within:bg-zinc-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Search size={16} className="text-zinc-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar en el portal..."
                  className="w-full border-0 bg-transparent py-1 text-sm outline-none placeholder-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                  className="text-zinc-400 hover:text-zinc-600 transition"
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
              {!searchQuery && (
                <kbd className={`hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border px-1.5 font-mono text-[9px] font-medium transition shrink-0 ${
                  isDark 
                    ? "bg-zinc-800 border-zinc-700 text-zinc-500" 
                    : "bg-white border-zinc-200 text-zinc-400"
                }`}>
                  <span>Ctrl</span>K
                </kbd>
              )}
            </div>

            {/* Dropdown Results list */}
            {searchOpen && (
              <div className={`absolute left-0 right-0 top-full mt-1.5 w-full rounded-2xl border shadow-xl z-50 overflow-hidden ${bgDropdown}`}>
                <div className="max-h-[300px] overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-200/80 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800">
                  {filteredItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 px-4">
                      No se encontraron resultados para <span className="font-semibold text-zinc-650 dark:text-zinc-300">"{searchQuery}"</span>
                    </div>
                  ) : (
                    Object.entries(
                      filteredItems.reduce((acc, item) => {
                        if (!acc[item.category]) acc[item.category] = [];
                        acc[item.category].push(item);
                        return acc;
                      }, {} as Record<string, typeof filteredItems>)
                    ).map(([category, items]) => (
                      <div key={category} className="mb-2 last:mb-0">
                        <h3 className="px-4 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                          {category}
                        </h3>
                        <div className="mt-1 space-y-0.5 px-2">
                          {items.map((item) => {
                            const globalIndex = filteredItems.findIndex(i => i.path === item.path);
                            const isActive = globalIndex === activeIndex;
                            const Icon = item.icon;

                            return (
                              <div
                                key={item.path}
                                ref={isActive ? (el) => {
                                  if (el) {
                                    el.scrollIntoView({
                                      behavior: "auto",
                                      block: "nearest"
                                    });
                                  }
                                } : undefined}
                                onClick={() => {
                                  navigate(item.path);
                                  setSearchOpen(false);
                                  setSearchQuery("");
                                  searchInputRef.current?.blur();
                                }}
                                onMouseEnter={() => setActiveIndex(globalIndex)}
                                className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition ${
                                  isActive
                                    ? (isDark ? "bg-white/10 text-white" : "bg-zinc-900 text-white shadow-sm")
                                    : (isDark ? "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900")
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${
                                    isActive
                                      ? (isDark ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-zinc-800 text-white")
                                      : (isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200/50 bg-zinc-50")
                                  }`}>
                                    <Icon size={14} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold leading-none">{item.title}</p>
                                    <p className={`text-[10px] mt-0.5 truncate ${
                                      isActive ? "text-zinc-300" : "text-zinc-400"
                                    }`}>
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isActive && (
                                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded tracking-wide font-mono ${
                                      isDark ? "bg-zinc-700 text-zinc-300 border border-zinc-700" : "bg-zinc-950 text-zinc-300"
                                    }`}>
                                      Ir
                                    </span>
                                  )}
                                  <ChevronRight size={13} className={isActive ? "text-white" : "text-zinc-400"} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Keyboard Shortcuts Footer */}
                <div className={`flex items-center justify-between border-t px-4 py-2 text-[9px] font-medium ${
                  isDark ? "border-zinc-800 bg-zinc-900/30 text-zinc-500" : "border-zinc-200 bg-zinc-50/50 text-zinc-400"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <kbd className={`px-1 rounded border font-mono ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500"}`}>↑↓</kbd>
                    <span>navegar</span>
                    <kbd className={`px-1 rounded border font-mono ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500"}`}>Enter</kbd>
                    <span>ir</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className={`px-1 rounded border font-mono ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500"}`}>Esc</kbd>
                    <span>cerrar</span>
                  </div>
                </div>
              </div>
            )}
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
                onClick={() => navigate("/signatures")}
              >
                Mis contratos
              </button>
            </>
          )}

          {/* Notifications Trigger & Popover */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setNotificationsOpen(prev => !prev)}
              className={`relative grid h-9 w-9 place-items-center rounded-xl border transition-colors ${borderIcon} ${textIcon} ${
                notificationsOpen ? (isDark ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-900") : ""
              }`}
              type="button"
              title="Notificaciones"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                    {unreadCount}
                  </span>
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {notificationsOpen && (
              <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border shadow-xl z-50 overflow-hidden ${bgDropdown}`}>
                <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-100 bg-zinc-50/50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Notificaciones</span>
                    {unreadCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                        isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-650"
                      }`}>
                        {unreadCount} pendiente{unreadCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-955 dark:hover:text-white transition"
                    >
                      <CheckCheck size={12} />
                      Marcar leídas
                    </button>
                  )}
                </div>

                <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-200/80 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                      <div className={`grid h-12 w-12 place-items-center rounded-full mb-3 ${isDark ? "bg-zinc-800 text-zinc-600" : "bg-zinc-50 text-zinc-400"}`}>
                        <Bell size={20} />
                      </div>
                      <p className="text-sm font-semibold text-zinc-500">Sin notificaciones</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Te avisaremos cuando haya novedades.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex items-start gap-3 p-4 transition cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 relative ${
                          getNotificationBg(notif.type, notif.read)
                        }`}
                      >
                        {!notif.read && (
                          <span className="absolute left-2.5 top-[22px] h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                          isDark ? "border-zinc-800 bg-zinc-800/50" : "border-zinc-200/65 bg-zinc-50"
                        }`}>
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-bold truncate ${
                              notif.read ? "text-zinc-500" : (isDark ? "text-white" : "text-zinc-900")
                            }`}>
                              {notif.title}
                            </p>
                            <span className="text-[10px] text-zinc-400 font-medium shrink-0">{getRelativeTime(notif.created_at)}</span>
                          </div>
                          <p className={`text-xs mt-1 leading-relaxed ${
                            notif.read ? "text-zinc-400" : "text-zinc-500"
                          }`}>
                            {notif.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
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
