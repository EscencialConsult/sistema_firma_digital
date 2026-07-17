/**
 * Shared PDF download utilities — html2canvas + jsPDF A4 capture.
 * Used by both SigningFlowPage (signer view) and ContractDetailModal (admin view).
 */

export const PDF_MARGIN_X = 15;
export const PDF_MARGIN_Y = 20;
export const PDF_CONTENT_W = 210 - PDF_MARGIN_X * 2;
export const PDF_CONTENT_H = 297 - PDF_MARGIN_Y * 2;

const normFilename = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").toLowerCase();

export async function makeDocHeader(logoUrl: string | null, orgName: string, title: string): Promise<HTMLElement> {
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:24px;border-bottom:2px solid #18181b;";
  if (logoUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.style.cssText = "height:36px;object-fit:contain;max-width:140px;";
    img.src = logoUrl;
    header.appendChild(img);
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); setTimeout(res, 2000); });
  } else {
    const nameEl = document.createElement("strong");
    nameEl.textContent = orgName;
    nameEl.style.fontSize = "15px";
    header.appendChild(nameEl);
  }
  const metaEl = document.createElement("div");
  metaEl.style.textAlign = "right";
  metaEl.innerHTML = `<div style="font-size:11px;font-weight:600;color:#0a0a0a">${title}</div><div style="font-size:9px;color:#71717a;margin-top:2px">${orgName} · Ley 25.506</div>`;
  header.appendChild(metaEl);
  return header;
}

export async function captureCanvasFromEl(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
}

export async function buildContractPdf({
  title, signerName, logoUrl, orgName,
}: { title: string; signerName: string; logoUrl: string | null; orgName: string }) {
  const wrapper = document.querySelector(".contract-doc-wrapper") as HTMLElement | null;
  if (!wrapper) return null;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:760px;background:white;padding:48px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#09090b;z-index:-1;";
  container.appendChild(await makeDocHeader(logoUrl, orgName, title));

  const clone = wrapper.cloneNode(true) as HTMLElement;
  clone.style.cssText = "max-height:none;overflow:visible;box-shadow:none;border:none;border-radius:0;background:white;";
  container.appendChild(clone);
  document.body.appendChild(container);
  await new Promise((r) => setTimeout(r, 200));

  const containerTop = container.getBoundingClientRect().top;
  const blockEls = Array.from(container.querySelectorAll("p, h1, h2, h3, h4, h5, h6"));
  const rawCandidates: number[] = [];
  for (let i = 0; i < blockEls.length - 1; i++) {
    const currBottom = (blockEls[i] as HTMLElement).getBoundingClientRect().bottom - containerTop;
    const nextTop = (blockEls[i + 1] as HTMLElement).getBoundingClientRect().top - containerTop;
    const gapMid = nextTop > currBottom ? (currBottom + nextTop) / 2 : currBottom + 2;
    rawCandidates.push(Math.round(gapMid * 2));
  }
  const sigBlock = container.querySelector("[data-sig-block]") as HTMLElement | null;
  let sigTopPx = -1, sigBottomPx = -1;
  if (sigBlock) {
    const r = sigBlock.getBoundingClientRect();
    sigTopPx = Math.round((r.top - containerTop) * 2) - 8;
    sigBottomPx = Math.round((r.bottom - containerTop) * 2);
    rawCandidates.push(sigTopPx);
  }
  const breakCandidates = rawCandidates
    .filter((px) => sigTopPx < 0 || px <= sigTopPx || px >= sigBottomPx)
    .sort((a, b) => a - b);

  const canvas = await captureCanvasFromEl(container);
  document.body.removeChild(container);

  const cw = canvas.width;
  const pageH_px = Math.round(canvas.height * (PDF_CONTENT_H / ((canvas.height * PDF_CONTENT_W) / cw)));
  const breakPxs: number[] = [0];
  let pos = 0;
  while (pos + pageH_px < canvas.height) {
    const target = pos + pageH_px;
    const minBreak = pos + Math.round(pageH_px * 0.3);
    let best = target;
    for (let i = breakCandidates.length - 1; i >= 0; i--) {
      if (breakCandidates[i] <= target && breakCandidates[i] >= minBreak) { best = breakCandidates[i]; break; }
    }
    breakPxs.push(best);
    pos = best;
  }
  breakPxs.push(canvas.height);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  for (let p = 0; p < breakPxs.length - 1; p++) {
    if (p > 0) pdf.addPage();
    const sy = breakPxs[p], ey = breakPxs[p + 1], sliceH_px = ey - sy;
    const sliceH_mm = (sliceH_px * PDF_CONTENT_W) / cw;
    const sc = document.createElement("canvas");
    sc.width = cw; sc.height = sliceH_px;
    const sCtx = sc.getContext("2d")!;
    sCtx.fillStyle = "#fff"; sCtx.fillRect(0, 0, cw, sliceH_px);
    sCtx.drawImage(canvas, 0, sy, cw, sliceH_px, 0, 0, cw, sliceH_px);
    pdf.addImage(sc.toDataURL("image/jpeg", 0.92), "JPEG", PDF_MARGIN_X, PDF_MARGIN_Y, PDF_CONTENT_W, sliceH_mm);
  }
  return { pdf, title, signerName };
}

export async function downloadContractAsPdf(args: {
  title: string; signerName: string; logoUrl: string | null; orgName: string;
}): Promise<void> {
  const result = await buildContractPdf(args);
  if (!result) return;
  result.pdf.save(`${normFilename(result.title)}_${normFilename(result.signerName)}.pdf`);
}

export interface AuditPdfParams {
  title: string;
  signerName: string;
  logoUrl: string | null;
  orgName: string;
  autorNombre: string;
  autorCuil: string;
  autorEmail: string;
  autorSigUrl: string;
  signerEmail: string;
  signerCuil: string;
  signerDni: string;
  signatureData: string | null;
  signingSelfiUrl: string | null;
  ipAddress: string | null;
  faceSimilarity: number | null;
  signedAt: string | null;
  documentHash: string | null;
}

function partyCard(badge: string, badgeColor: string, rows: [string, string][], sigUrl: string | null): HTMLElement {
  const card = document.createElement("div");
  card.style.cssText = "border:1px solid #e4e4e7;border-radius:12px;padding:16px;";
  const b = document.createElement("div");
  b.style.cssText = `display:inline-block;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;margin-bottom:12px;${badgeColor}`;
  b.textContent = badge;
  card.appendChild(b);
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #f4f4f5;font-size:11px;";
    row.innerHTML = `<span style="color:#71717a;font-weight:600">${label}</span><span style="color:#09090b;text-align:right">${value || "—"}</span>`;
    card.appendChild(row);
  }
  if (sigUrl) {
    const sigWrap = document.createElement("div");
    sigWrap.style.cssText = "margin-top:14px;text-align:center;";
    const sigImg = document.createElement("img");
    sigImg.src = sigUrl;
    sigImg.crossOrigin = "anonymous";
    sigImg.style.cssText = "max-height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 4px;";
    const sigLabel = document.createElement("p");
    sigLabel.style.cssText = "font-size:9px;color:#a1a1aa;margin:0";
    sigLabel.textContent = "Firma digital registrada";
    sigWrap.appendChild(sigImg);
    sigWrap.appendChild(sigLabel);
    card.appendChild(sigWrap);
  }
  return card;
}

export async function downloadContractWithAuditPdf(args: AuditPdfParams): Promise<void> {
  const result = await buildContractPdf(args);
  if (!result) return;
  const { pdf } = result;

  const auditEl = document.createElement("div");
  auditEl.style.cssText =
    "position:fixed;left:-9999px;top:0;width:760px;background:white;padding:48px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#09090b;z-index:-1;";
  auditEl.appendChild(await makeDocHeader(args.logoUrl, args.orgName, args.title));

  const titleSec = document.createElement("div");
  titleSec.style.cssText = "text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e4e7;";
  titleSec.innerHTML = `
    <p style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:#71717a;margin:0">Registro de Auditoría</p>
    <p style="font-size:18px;font-weight:800;color:#09090b;margin:6px 0 4px">Certificado de Firma Electrónica</p>
    <p style="font-size:10px;color:#71717a;margin:0">Ley N° 25.506 · República Argentina</p>`;
  auditEl.appendChild(titleSec);

  const partiesGrid = document.createElement("div");
  partiesGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;";
  const ts = args.signedAt ? new Date(args.signedAt).toLocaleString("es-AR") : "—";
  partiesGrid.appendChild(partyCard(
    "AUTORIDAD FIRMANTE", "background:#eff6ff;color:#1d4ed8;",
    [["Nombre", args.autorNombre], ["CUIL/CUIT", args.autorCuil], ["Email", args.autorEmail], ["Rol", "Representante Legal"]],
    args.autorSigUrl || null,
  ));
  partiesGrid.appendChild(partyCard(
    "FIRMANTE", "background:#ecfdf5;color:#065f46;",
    [
      ["Nombre", args.signerName],
      ["Email", args.signerEmail],
      ...(args.signerCuil ? [["CUIL/CUIT", args.signerCuil] as [string, string]] : []),
      ...(args.signerDni  ? [["DNI",        args.signerDni]  as [string, string]] : []),
      ["IP registrada", args.ipAddress || "—"],
      ["Fecha y hora", ts],
      ...(args.faceSimilarity !== null ? [["Similitud facial", `${args.faceSimilarity}%`] as [string, string]] : []),
    ],
    args.signatureData,
  ));
  auditEl.appendChild(partiesGrid);

  if (args.signingSelfiUrl) {
    const selfieSection = document.createElement("div");
    selfieSection.style.cssText = "border:1px solid #e4e4e7;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;";
    const selfieImg = document.createElement("img");
    selfieImg.src = args.signingSelfiUrl;
    selfieImg.crossOrigin = "anonymous";
    selfieImg.style.cssText = "width:88px;height:88px;border-radius:10px;object-fit:cover;border:1px solid #e4e4e7;flex-shrink:0;";
    const selfieMeta = document.createElement("div");
    selfieMeta.innerHTML = `
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;margin:0 0 6px">Foto de verificación facial</p>
      <p style="font-size:11px;color:#3f3f46;margin:0 0 4px">Capturada al momento de la firma electrónica.</p>
      <p style="font-size:11px;color:#059669;font-weight:600;margin:0">✓ Identidad confirmada por reconocimiento facial${args.faceSimilarity !== null ? ` · ${args.faceSimilarity}% de similitud` : ""}</p>`;
    selfieSection.appendChild(selfieImg);
    selfieSection.appendChild(selfieMeta);
    auditEl.appendChild(selfieSection);
    await new Promise<void>((res) => { selfieImg.onload = () => res(); selfieImg.onerror = () => res(); setTimeout(res, 2000); });
  }

  const processSec = document.createElement("div");
  processSec.style.cssText = "margin-bottom:16px;";
  processSec.innerHTML = `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;margin:0 0 8px">Proceso de firma verificado</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      ${["Conformidad legal aceptada","Verificación facial completada","OTP de identidad validado","Firma manuscrita digital registrada"]
        .map(s => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#3f3f46"><span style="color:#10b981;font-size:13px">✓</span>${s}</div>`).join("")}
    </div>`;
  auditEl.appendChild(processSec);

  const hashSec = document.createElement("div");
  hashSec.style.cssText = "border:1px solid #e4e4e7;border-radius:10px;padding:12px;margin-bottom:16px;background:#fafafa;";
  hashSec.innerHTML = `<p style="font-size:10px;font-weight:700;color:#71717a;margin:0 0 4px">Hash SHA-256 del documento</p>
    <p style="font-family:monospace;font-size:10px;color:#09090b;word-break:break-all;margin:0">${args.documentHash || "—"}</p>`;
  auditEl.appendChild(hashSec);

  const legalSec = document.createElement("div");
  legalSec.style.cssText = "border:1px solid #bbf7d0;border-radius:10px;padding:12px;background:#f0fdf4;";
  legalSec.innerHTML = `<p style="font-size:11px;font-weight:700;color:#166534;margin:0 0 4px">✓ Firma Electrónica Válida</p>
    <p style="font-size:10px;color:#166534;margin:0;line-height:1.5">Proceso realizado conforme a la Ley N° 25.506 de Firma Digital de la República Argentina. Método: OTP + Reconocimiento facial + Firma manuscrita digital.</p>`;
  auditEl.appendChild(legalSec);

  document.body.appendChild(auditEl);

  const sigImgs = Array.from(auditEl.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(sigImgs.map((img) => new Promise<void>((res) => {
    if (img.complete) { res(); return; }
    img.onload = () => res(); img.onerror = () => res(); setTimeout(res, 2000);
  })));
  await new Promise((r) => setTimeout(r, 150));

  const auditCanvas = await captureCanvasFromEl(auditEl);
  document.body.removeChild(auditEl);

  pdf.addPage();
  const auditH_mm = (auditCanvas.height * PDF_CONTENT_W) / auditCanvas.width;
  pdf.addImage(auditCanvas.toDataURL("image/jpeg", 0.92), "JPEG", PDF_MARGIN_X, PDF_MARGIN_Y, PDF_CONTENT_W, auditH_mm);

  pdf.save(`auditoria_${normFilename(args.title)}_${normFilename(args.signerName)}.pdf`);
}
