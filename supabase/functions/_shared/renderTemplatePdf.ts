/**
 * Renderer server-side de "template HTML + variables → PDF", para Deno Edge
 * Functions. No existía ningún renderizado de PDF server-side en el repo antes
 * de esto — todo el armado de contrato corría client-side (jsPDF/pdf-lib en el
 * navegador, ver web-portal/src/shared/utils/generateSignedPdf.ts), lo cual es
 * inviable para un firmante externo sin cuenta llegando por la API B2B.
 *
 * Usa pdf-lib puro (npm:pdf-lib@1.17.1, la misma versión ya probada en este
 * runtime por supabase/functions/sign-document y upload-document) en vez de
 * portar jsPDF, que nunca corrió en Deno en este proyecto.
 *
 * Fidelidad: texto plano con word-wrap simple — la misma fidelidad que el
 * sistema ya acepta hoy como fallback client-side cuando un contrato de
 * plantilla no tiene un PDF original subido (ver contractText() en
 * generateSignedPdf.ts, de donde se porta esta lógica). No es el render
 * WYSIWYG con html2canvas (requiere DOM real, no puede correr en Deno).
 *
 * Hornea el sello de la Autoridad Firmante en el PDF base, ANTES de que exista
 * cualquier firma del cliente final — porque sign-document (que sí es 100%
 * server-side, vía PKCS7) nunca dibuja autoridad_signature_url, solo el sello
 * de quien está firmando en ese momento. Sin este horneado, un contrato
 * generado por API quedaría sin el sello visual de la Autoridad.
 */

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

export interface RenderTemplatePdfInput {
  title:            string;
  documentId:       string;
  /** Mismo shape que documents.template_fields — incluye _templateContent + variables planas. */
  templateFields:   Record<string, string>;
  organizationName?: string | null;
  authority?: {
    fullName:     string;
    email?:       string | null;
    signatureUrl: string | null;
  } | null;
}

const PAGE_W = 595.28; // A4 en puntos (72dpi), mismo tamaño que pdf-lib usa por defecto
const PAGE_H = 841.89;
const MARGIN = 56; // ~20mm

function normalizeText(value: string): string {
  return value
    .replace(/ /g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\r\n/g, "\n")
    .trim();
}

function htmlToText(html: string): string {
  return normalizeText(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
  );
}

/** Port de contractText() en generateSignedPdf.ts — misma resolución de {{var}}. */
function resolveContractText(fields: Record<string, string>): string {
  const template = fields._templateContent;

  if (template) {
    let content = template;
    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith("_")) continue;
      content = content.replace(new RegExp(`{{${key}}}`, "g"), value || `{{${key}}}`);
    }
    return htmlToText(content);
  }

  const visibleFields = Object.entries(fields)
    .filter(([key, value]) => !key.startsWith("_") && value)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`);

  if (visibleFields.length > 0) {
    return [
      "Documento generado desde plantilla del sistema.",
      "",
      "Datos cargados en el contrato:",
      ...visibleFields,
    ].join("\n");
  }

  return "El cuerpo contractual no esta disponible en los datos del documento.";
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface Ctx {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  orgName: string;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 24) newPage(ctx);
}

function drawHeader(ctx: Ctx, title: string, subtitle: string) {
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 68, width: PAGE_W, height: 68, color: rgb(0.094, 0.094, 0.106) });
  ctx.page.drawText(title, { x: MARGIN, y: PAGE_H - 32, size: 13, font: ctx.fontBold, color: rgb(1, 1, 1) });
  ctx.page.drawText(subtitle, { x: MARGIN, y: PAGE_H - 50, size: 8.5, font: ctx.font, color: rgb(0.9, 0.9, 0.92) });
  ctx.y = PAGE_H - 96;
}

function drawParagraphs(ctx: Ctx, text: string) {
  const paragraphs = normalizeText(text).split(/\n\s*\n/);
  const lineHeight = 14;
  const maxWidth = PAGE_W - MARGIN * 2;

  for (const paragraph of paragraphs) {
    const lines = wrapLine(paragraph.replace(/\n/g, " "), ctx.font, 10, maxWidth);
    for (const line of lines) {
      ensureSpace(ctx, lineHeight);
      ctx.page.drawText(line, { x: MARGIN, y: ctx.y, size: 10, font: ctx.font, color: rgb(0.15, 0.15, 0.16) });
      ctx.y -= lineHeight;
    }
    ctx.y -= 6; // espacio entre párrafos
  }
}

async function drawAuthorityStamp(
  ctx: Ctx,
  authority: NonNullable<RenderTemplatePdfInput["authority"]>
) {
  ensureSpace(ctx, 100);
  ctx.y -= 10;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 1, color: rgb(0.89, 0.89, 0.91),
  });
  ctx.y -= 18;

  const stampX = MARGIN;
  const stampW = PAGE_W - MARGIN * 2;
  const stampH = 76;
  const stampY = ctx.y - stampH;

  ctx.page.drawRectangle({
    x: stampX, y: stampY, width: stampW, height: stampH,
    color: rgb(0.96, 0.98, 0.96), borderColor: rgb(0.06, 0.46, 0.24), borderWidth: 1.5,
  });
  ctx.page.drawText("FIRMA DE LA AUTORIDAD (delegada por la organización)", {
    x: stampX + 12, y: stampY + stampH - 16, size: 8, font: ctx.fontBold, color: rgb(0.06, 0.46, 0.24),
  });
  ctx.page.drawText(`Firmante: ${authority.fullName}`, {
    x: stampX + 12, y: stampY + stampH - 30, size: 7.5, font: ctx.font, color: rgb(0.1, 0.1, 0.1),
  });
  if (authority.email) {
    ctx.page.drawText(`Email: ${authority.email}`, {
      x: stampX + 12, y: stampY + stampH - 42, size: 7, font: ctx.font, color: rgb(0.3, 0.3, 0.3),
    });
  }
  ctx.page.drawText("Firma pre-cargada, horneada en el documento base al generarlo vía API.", {
    x: stampX + 12, y: stampY + stampH - 56, size: 6, font: ctx.font, color: rgb(0.5, 0.5, 0.5),
  });

  if (authority.signatureUrl) {
    try {
      const res = await fetch(authority.signatureUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "";
        const image = contentType.includes("jpeg") || contentType.includes("jpg")
          ? await ctx.pdfDoc.embedJpg(bytes)
          : await ctx.pdfDoc.embedPng(bytes);
        ctx.page.drawImage(image, { x: stampX + stampW - 110, y: stampY + 18, width: 95, height: 38 });
      }
    } catch {
      // Imagen de firma no disponible — el sello de texto igual queda registrado.
    }
  }

  ctx.y = stampY - 12;
}

function drawFooters(ctx: Ctx, orgName: string) {
  const pages = ctx.pdfDoc.getPages();
  pages.forEach((page, i) => {
    page.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: PAGE_W - MARGIN - 90, y: 24, size: 7, font: ctx.font, color: rgb(0.6, 0.6, 0.64),
    });
    page.drawText(`${orgName} - Sistema Firma Electrónica - Ley 25.506 Argentina`, {
      x: MARGIN, y: 24, size: 7, font: ctx.font, color: rgb(0.6, 0.6, 0.64),
    });
  });
}

export async function renderTemplatePdf(input: RenderTemplatePdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const orgName = input.organizationName ?? "Escencial Consultora";

  const ctx: Ctx = { pdfDoc, page: pdfDoc.addPage([PAGE_W, PAGE_H]), font, fontBold, y: PAGE_H, orgName };
  drawHeader(ctx, "CONTRATO", `${orgName} - Generado automáticamente vía API - Ley 25.506 Argentina`);

  ctx.page.drawText(input.title, { x: MARGIN, y: ctx.y, size: 13, font: fontBold, color: rgb(0.09, 0.09, 0.11) });
  ctx.y -= 20;
  ctx.page.drawText(`ID del documento: ${input.documentId}`, { x: MARGIN, y: ctx.y, size: 8, font, color: rgb(0.32, 0.32, 0.36) });
  ctx.y -= 12;
  ctx.page.drawText(`Fecha de emisión: ${new Date().toLocaleString("es-AR")}`, { x: MARGIN, y: ctx.y, size: 8, font, color: rgb(0.32, 0.32, 0.36) });
  ctx.y -= 24;

  drawParagraphs(ctx, resolveContractText(input.templateFields));

  if (input.authority?.fullName && input.authority.signatureUrl) {
    await drawAuthorityStamp(ctx, input.authority);
  }

  drawFooters(ctx, orgName);

  return pdfDoc.save();
}
