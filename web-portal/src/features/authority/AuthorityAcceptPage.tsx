import {
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  PenLine,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAuthorityByToken,
  acceptAuthorityInvite,
  uploadAuthoritySignature,
  type AuthorityInviteInfo,
} from "../../shared/services/authorities.service";
import { supabase } from "../../shared/lib/supabase";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";
import { Button } from "../../shared/components/ui/Button";

// ─── Canvas de firma ──────────────────────────────────────────────────────────

function SignatureCanvas({ onConfirm }: { onConfirm: (dataUrl: string) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  function getPos(e: PointerEvent) {
    return { x: e.offsetX, y: e.offsetY };
  }

  function draw(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPos.current = { x, y };
    setHasStrokes(true);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const p = getPos(e);
      lastPos.current = p;
      draw(p.x, p.y);
    };
    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const p = getPos(e);
      draw(p.x, p.y);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      isDrawing.current = false;
      lastPos.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <PenLine size={13} /> Área de firma
          </span>
          <button type="button" onClick={clearCanvas} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
            <Trash2 size={11} /> Limpiar
          </button>
        </div>
        <div className="relative" style={{ height: "180px" }}>
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair touch-none" style={{ display: "block" }} />
          {!hasStrokes && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-zinc-300 select-none">Firmá aquí</p>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-zinc-200" />
        </div>
      </div>
      <Button
        onClick={() => onConfirm(canvasRef.current?.toDataURL("image/png") ?? "")}
        disabled={!hasStrokes}
        className="w-full h-11"
      >
        <CheckCircle2 size={15} /> Confirmar firma
      </Button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type PageState = "loading" | "invite" | "done" | "error" | "already";

export function AuthorityAcceptPage() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const [invite,    setInvite]    = useState<AuthorityInviteInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errMsg,    setErrMsg]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Para PERMANENT: solo firma dibujada en canvas
  const [canvasSig,  setCanvasSig]  = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setPageState("error"); setErrMsg("Token inválido."); return; }
    getAuthorityByToken(token)
      .then(async (inv) => {
        if (!inv) { setPageState("error"); setErrMsg("Invitación no encontrada o expirada."); return; }
        if (inv.status !== "PENDING") { setPageState("already"); return; }
        setInvite(inv);

        // Para PROVISIONAL: buscar el signing_request_id y redirigir al flujo de firma
        if (inv.type === "PROVISIONAL") {
          const { data } = await supabase.rpc("get_authority_signing_request", { p_token: token });
          if (data?.signing_request_id) {
            navigate(`/signing/${data.signing_request_id}`, { replace: true });
            return;
          }
          // Si no tiene convenio asociado, mostrar formulario de aceptación simple
        }

        setPageState("invite");
      })
      .catch((e) => { setPageState("error"); setErrMsg(e.message); });
  }, [token]);

  function handleCanvasConfirm(dataUrl: string) {
    setCanvasSig(dataUrl);
  }

  async function handleSubmit() {
    if (!invite || !token) return;
    setSubmitting(true);
    try {
      let signatureUrl: string | undefined;

      if (invite.type === "PERMANENT" && canvasSig) {
        const res  = await fetch(canvasSig);
        const blob = await res.blob();
        const file = new File([blob], "firma.png", { type: "image/png" });
        signatureUrl = await uploadAuthoritySignature(invite.id, file);
      }

      await acceptAuthorityInvite(token, signatureUrl);
      setPageState("done");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Error al procesar la invitación");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <Loader2 size={28} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 mx-auto">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Invitación inválida</h1>
          <p className="text-sm text-zinc-500">{errMsg}</p>
        </div>
      </div>
    );
  }

  // ── Ya procesada ──────────────────────────────────────────────────────────
  if (pageState === "already") {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-zinc-100 mx-auto">
            <ShieldCheck size={32} className="text-zinc-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Invitación ya procesada</h1>
          <p className="text-sm text-zinc-500">Esta invitación ya fue aceptada o revocada anteriormente.</p>
        </div>
      </div>
    );
  }

  // ── Éxito ─────────────────────────────────────────────────────────────────
  if (pageState === "done") {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 mx-auto">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">¡Todo listo!</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {invite?.type === "PERMANENT"
                ? "Tu firma quedó registrada y tu rol como autoridad está activo."
                : "Aceptaste el rol de autoridad provisional. Revisá tus contratos para firmarlo."}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">{invite?.orgName}</p>
            <p className="mt-0.5 text-xs text-emerald-600">
              Autoridad {invite?.type === "PERMANENT" ? "permanente" : "provisional"} activada
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/signatures")}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition"
          >
            <LayoutDashboard size={15} />
            Ir a mis contratos
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario de aceptación ──────────────────────────────────────────────
  if (!invite) return null;

  const isPermanent = invite.type === "PERMANENT";

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <OrgLogo logoDarkUrl={invite.orgLogoDark} logoLightUrl={invite.orgLogoLight} variant="light" size={36} />
          <div>
            <p className="text-sm font-bold text-zinc-900">{invite.orgName}</p>
            <p className="text-[11px] text-zinc-500">Invitación de autoridad firmante</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Info de la invitación */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-zinc-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Tu rol</p>
          </div>
          <div>
            <p className="text-xl font-bold text-zinc-900">{invite.fullName}</p>
            <p className="text-sm text-zinc-500">{invite.email}{invite.cuil ? ` · CUIL ${invite.cuil}` : ""}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 leading-relaxed">
            {isPermanent ? (
              <>
                <p className="font-semibold text-zinc-900">Autoridad firmante permanente</p>
                <p className="mt-1">
                  <strong>{invite.orgName}</strong> te invita a registrarte como autoridad firmante permanente.
                  Tu firma quedará habilitada para ser usada en contratos de la organización.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-zinc-900">Autoridad firmante provisional</p>
                <p className="mt-1">
                  <strong>{invite.orgName}</strong> necesita tu firma para un convenio puntual.
                  Al aceptar, recibirás el documento correspondiente para firmar.
                </p>
              </>
            )}
            {invite.notes && (
              <p className="mt-2 text-xs text-zinc-500 italic">Nota: {invite.notes}</p>
            )}
          </div>
        </div>

        {/* Firma (solo PERMANENT) */}
        {isPermanent && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Tu firma</p>
            <p className="text-sm text-zinc-500">
              Dibujá tu firma en el área de abajo.
            </p>

            {/* Preview de firma confirmada */}
            {canvasSig ? (
              <div className="relative rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center justify-center" style={{ minHeight: 80 }}>
                <img src={canvasSig} alt="firma" className="max-h-20 object-contain" />
                <button
                  type="button"
                  onClick={() => setCanvasSig(null)}
                  className="absolute top-2 right-2 rounded-lg p-1 text-zinc-400 hover:bg-white hover:text-red-500 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <SignatureCanvas onConfirm={handleCanvasConfirm} />
            )}
          </div>
        )}

        {errMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errMsg}</div>
        )}

        {/* CTA */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || (isPermanent && !canvasSig)}
          className="w-full h-12 text-base"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
            : <><CheckCircle2 size={16} /> {isPermanent ? "Aceptar y registrar firma" : "Aceptar rol provisional"}</>
          }
        </Button>

        {isPermanent && !canvasSig && (
          <p className="text-center text-xs text-zinc-400">
            Dibujá tu firma antes de continuar.
          </p>
        )}
      </main>
    </div>
  );
}
