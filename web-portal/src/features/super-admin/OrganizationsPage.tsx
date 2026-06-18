import { Building2, CheckCircle, Plus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrganizations } from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrganizations()
      .then(setOrgs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizaciones</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {loading ? "Cargando..." : `${orgs.length} empresa${orgs.length !== 1 ? "s" : ""} registrada${orgs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          to="/super-admin/organizations/new"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition"
        >
          <Plus size={16} />
          Nueva organización
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      )}

      {!loading && !error && orgs.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-800">
            <Building2 size={26} className="text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-zinc-400">Sin organizaciones aún</p>
          <p className="text-xs text-zinc-600 max-w-xs">
            Creá la primera empresa para empezar a usar la plataforma multitenant.
          </p>
          <Link
            to="/super-admin/organizations/new"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition"
          >
            <Plus size={14} />
            Crear organización
          </Link>
        </div>
      )}

      {!loading && orgs.length > 0 && (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              to={`/super-admin/organizations/${org.id}`}
              className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 hover:border-zinc-700 hover:bg-zinc-800/80 transition"
            >
              <OrgLogo
                logoDarkUrl={org.logoDarkUrl}
                logoLightUrl={org.logoLightUrl}
                variant="dark"
                size={44}
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">/{org.slug}</p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {org.isActive ? (
                  <CheckCircle size={15} className="text-emerald-500" />
                ) : (
                  <XCircle size={15} className="text-red-500" />
                )}
                <span className={`text-xs font-medium ${org.isActive ? "text-emerald-400" : "text-red-400"}`}>
                  {org.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
