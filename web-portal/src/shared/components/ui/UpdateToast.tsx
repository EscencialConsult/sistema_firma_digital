import { useEffect, useState } from "react";
import { APP_CONFIG } from "../../config/app";

const STORAGE_KEY = "app_last_version";

export function UpdateToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const current  = APP_CONFIG.version;

    if (lastSeen !== current) {
      localStorage.setItem(STORAGE_KEY, current);
      // Solo mostrar si ya hubo una versión anterior (no en primer uso)
      if (lastSeen) setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: "var(--brand-primary)",
        color: "var(--brand-primary-text)",
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        animation: "fadeInUp 0.3s ease",
        opacity: 0.92,
      }}
    >
      <span style={{ fontSize: 14 }}>✦</span>
      Actualización v{APP_CONFIG.version} instalada
      <button
        onClick={() => setVisible(false)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7, padding: 0, marginLeft: 4, fontSize: 14, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
