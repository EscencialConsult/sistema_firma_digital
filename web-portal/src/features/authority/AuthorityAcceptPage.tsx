import {
  CheckCircle2,
  Loader2,
  PenLine,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getAuthorityByToken,
  acceptAuthorityInvite,
  uploadAuthoritySignature,
  type AuthorityInviteInfo,
} from "../../shared/services/authorities.service";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";
import { Button } from "../../shared/components/ui/Button";

// ─── Canvas de firma ──────────────────────────────────────────────────────────

function SignatureCanvas({ onConfirm }: { onConfirm: (dataUrl: string) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
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
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const onDown  = (e: MouseEvent) => { isDrawing.current = true; lastPos.current = getPos(e, canvas); };
    const onMove  = (e: MouseEvent) => { const p = getPos(e, canvas); draw(p.x, p.y); };
    const onUp    = () => { isDrawing.current = false; lastPos.current = null; };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e.touches[0], canvas); };
    const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0], canvas); draw(p.x, p.y); };
    const onTouchEnd   = () => { isDrawing.current = false; lastPos.current = null; };

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
    canvas.addEventListener("touchend",   onTouchEnd);
    return () => {
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   onTouchEnd);
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

type PageState = "loading" | "invite" | "signing" | "done" | "error" | "already";

export function AuthorityAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [invite,    setInvite]    = useState<AuthorityInviteInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errMsg,    setErrMsg]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Para PERMANENT: puede subir imagen de firma O dibujarla
  const [sigFile,    setSigFile]    = useState<File | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [useCanvas,  setUseCanvas]  = useState(false);
  const [canvasSig,  setCanvasSig]  = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setPageState("error"); setErrMsg("Token inválido."); return; }
    getAuthorityByToken(token)
      .then((inv) => {
        if (!inv) { setPageState("error"); setErrMsg("Invitación no encontrada o expirada."); return; }
        if (inv.status !== "PENDING") { setPageState("already"); return; }
        setInvite(inv);
        setPageState("invite");
      })
      .catch((e) => { setPageState("error"); setErrMsg(e.message); });
  }, [token]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigFile(file);
    setSigPreview(URL.createObjectURL(file));
    setCanvasSig(null);
    setUseCanvas(false);
  }

  function handleCanvasConfirm(dataUrl: string) {
    setCanvasSig(dataUrl);
    setSigFile(null);
    setSigPreview(dataUrl);
  }

  async function handleSubmit() {
    if (!invite || !token) return;
    setSubmitting(true);
    try {
      let signatureUrl: string | undefined;

      if (invite.type === "PERMANENT") {
        if (sigFile) {
          signatureUrl = await uploadAuthoritySignature(invite.id, sigFile);
        } else if (canvasSig) {
          // Convertir dataURL canvas a File y subir
          const res  = await fetch(canvasSig);
          const blob = await res.blob();
          const file = new File([blob], "firma.png", { type: "image/png" });
          signatureUrl = await uploadAuthoritySignature(invite.id, file);
        }
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
                ? "Tu firma quedó registrada. Ya podés cerrar esta página."
                : "Aceptaste el rol de autoridad provisional. Recibirás el convenio para firmar próximamente."}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">{invite?.orgName}</p>
            <p className="mt-0.5 text-xs text-emerald-600">
              Autoridad {invite?.type === "PERMANENT" ? "permanente" : "provisional"} activada
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de aceptación ──────────────────────────────────────────────
  if (!invite) return null;

  const isPermanent = invite.type === "PERMANENT";
  const hasSignature = !!(sigPreview || canvasSig);

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
              Cargá una imagen de tu firma o dibujala directamente.
            </p>

            {/* Preview */}
            {sigPreview && (
              <div className="relative rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center justify-center" style={{ minHeight: 80 }}>
                <img src={sigPreview} alt="firma" className="max-h-20 object-contain" />
                <button
                  type="button"
                  onClick={() => { setSigFile(null); setSigPreview(null); setCanvasSig(null); }}
                  className="absolute top-2 right-2 rounded-lg p-1 text-zinc-400 hover:bg-white hover:text-red-500 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {!sigPreview && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 p-4 hover:border-zinc-400 transition text-center">
                  <Upload size={20} className="text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-500">Subir imagen</span>
                  <span className="text-[10px] text-zinc-400">PNG, JPG, WebP</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                <button
                  type="button"
                  onClick={() => setUseCanvas(!useCanvas)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition text-center ${useCanvas ? "border-zinc-900 bg-zinc-900 text-white" : "border-dashed border-zinc-200 hover:border-zinc-400"}`}
                >
                  <PenLine size={20} className={useCanvas ? "text-white" : "text-zinc-400"} />
                  <span className="text-xs font-semibold">Dibujar firma</span>
                </button>
              </div>
            )}

            {useCanvas && !sigPreview && (
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
          disabled={submitting || (isPermanent && !hasSignature)}
          className="w-full h-12 text-base"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
            : <><CheckCircle2 size={16} /> {isPermanent ? "Aceptar y registrar firma" : "Aceptar rol provisional"}</>
          }
        </Button>

        {isPermanent && !hasSignature && (
          <p className="text-center text-xs text-zinc-400">
            Necesitás cargar o dibujar tu firma antes de continuar.
          </p>
        )}
      </main>
    </div>
  );
}
