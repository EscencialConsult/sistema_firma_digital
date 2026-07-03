import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";

export interface PdfSigner {
  name: string;
  email: string;
  signedAt: string;
  signatureData: string | null;
}

export interface SignedPdfDocumentInput {
  title: string;
  id: string;
  templateId?: string | null;
  templateFields?: Record<string, string> | null;
  originalPdf?: Blob | null;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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

function contractText(document: SignedPdfDocumentInput): string {
  const fields = document.templateFields ?? {};
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

  return "El cuerpo contractual no esta disponible en los datos del documento. Se adjunta la certificacion de firma electronica.";
}

function ensurePage(pdf: jsPDF, y: number, needed = 12): number {
  if (y + needed <= PAGE_H - 18) return y;
  pdf.addPage();
  return 22;
}

function addFooter(pdf: jsPDF) {
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 160);
    pdf.text(`Pagina ${i} de ${pages}`, PAGE_W - MARGIN, 286, { align: "right" });
    pdf.text("Escencial Consultora - Sistema Firma Digital - Ley 25.506 Argentina", MARGIN, 286);
  }
}

function addWrappedText(pdf: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5): number {
  const paragraphs = normalizeText(text).split(/\n\s*\n/);
  let currentY = y;

  for (const paragraph of paragraphs) {
    const lines = pdf.splitTextToSize(paragraph.replace(/\n/g, " "), width) as string[];
    currentY = ensurePage(pdf, currentY, lines.length * lineHeight + 4);
    pdf.text(lines, x, currentY);
    currentY += lines.length * lineHeight + 3;
  }

  return currentY;
}

function addHeader(pdf: jsPDF, title: string, subtitle: string) {
  pdf.setFillColor(24, 24, 27);
  pdf.rect(0, 0, PAGE_W, 24, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(title, MARGIN, 10);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(subtitle, MARGIN, 18);
}

function addSignatureBlocks(pdf: jsPDF, signers: PdfSigner[], y: number): number {
  let currentY = ensurePage(pdf, y, 42);
  pdf.setDrawColor(228, 228, 231);
  pdf.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  currentY += 10;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(24, 24, 27);
  pdf.text("Firmas registradas", MARGIN, currentY);
  currentY += 8;

  for (const signer of signers) {
    currentY = ensurePage(pdf, currentY, 42);
    pdf.setFillColor(250, 250, 250);
    pdf.setDrawColor(228, 228, 231);
    pdf.roundedRect(MARGIN, currentY, CONTENT_W, 34, 3, 3, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(24, 24, 27);
    pdf.text(signer.name || "Firmante", MARGIN + 5, currentY + 8);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(82, 82, 91);
    pdf.text(`Email: ${signer.email}`, MARGIN + 5, currentY + 14);
    pdf.text(`Firmado: ${new Date(signer.signedAt).toLocaleString("es-AR")}`, MARGIN + 5, currentY + 19);
    pdf.text("Metodo: OTP + verificacion facial + firma manuscrita", MARGIN + 5, currentY + 24);

    if (signer.signatureData) {
      try {
        pdf.addImage(signer.signatureData, "PNG", PAGE_W - MARGIN - 58, currentY + 5, 52, 22);
      } catch {
        pdf.text("Firma no disponible", PAGE_W - MARGIN - 55, currentY + 18);
      }
    }

    currentY += 42;
  }

  return currentY;
}

function addCertificatePage(pdf: jsPDF, document: SignedPdfDocumentInput, signers: PdfSigner[]) {
  pdf.addPage();
  addHeader(pdf, "CERTIFICADO DE FIRMA ELECTRONICA", "Escencial Consultora - Firma Digital - Valido conforme Ley 25.506 Argentina");

  let y = 38;
  pdf.setTextColor(24, 24, 27);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text(pdf.splitTextToSize(document.title, CONTENT_W), MARGIN, y);
  y += 14;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(82, 82, 91);
  pdf.text(`ID: ${document.id}`, MARGIN, y);
  y += 5;
  pdf.text(`Emitido: ${new Date().toLocaleString("es-AR")}`, MARGIN, y);
  y += 12;

  y = addSignatureBlocks(pdf, signers, y);
  y = ensurePage(pdf, y, 28);

  pdf.setFillColor(240, 253, 244);
  pdf.setDrawColor(187, 247, 208);
  pdf.roundedRect(MARGIN, y, CONTENT_W, 24, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(22, 101, 52);
  pdf.text("FIRMA ELECTRONICA VALIDA", MARGIN + 5, y + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("Este anexo acredita la firma electronica conforme a la Ley 25.506 de la Republica Argentina.", MARGIN + 5, y + 14);
  pdf.text("Las identidades fueron verificadas mediante OTP, reconocimiento facial y firma manuscrita digital.", MARGIN + 5, y + 19);
}

export async function generateSignedPdf(
  document: SignedPdfDocumentInput | string,
  legacyDocumentId: string,
  signers: PdfSigner[]
): Promise<Blob> {
  const input: SignedPdfDocumentInput = typeof document === "string"
    ? { title: document, id: legacyDocumentId }
    : document;

  if (input.originalPdf) {
    const certificatePdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    addCertificatePage(certificatePdf, input, signers);
    addFooter(certificatePdf);

    const [originalBytes, certificateBytes] = await Promise.all([
      input.originalPdf.arrayBuffer(),
      Promise.resolve(certificatePdf.output("arraybuffer")),
    ]);

    const mergedPdf = await PDFDocument.load(originalBytes);
    const certificateDoc = await PDFDocument.load(certificateBytes);
    const certificatePages = await mergedPdf.copyPages(certificateDoc, certificateDoc.getPageIndices());
    certificatePages.forEach((page) => mergedPdf.addPage(page));
    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = new ArrayBuffer(mergedBytes.byteLength);
    new Uint8Array(mergedBuffer).set(mergedBytes);

    return new Blob([mergedBuffer], { type: "application/pdf" });
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(pdf, "CONTRATO FIRMADO ELECTRONICAMENTE", "Escencial Consultora - Sistema Firma Digital");

  let y = 38;
  pdf.setTextColor(24, 24, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(pdf.splitTextToSize(input.title, CONTENT_W), MARGIN, y);
  y += 16;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(82, 82, 91);
  pdf.text(`ID del documento: ${input.id}`, MARGIN, y);
  y += 6;
  pdf.text(`Fecha de emision: ${new Date().toLocaleString("es-AR")}`, MARGIN, y);
  y += 12;

  pdf.setDrawColor(228, 228, 231);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  pdf.setFont("times", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(39, 39, 42);
  y = addWrappedText(pdf, contractText(input), MARGIN, y, CONTENT_W, 5.2);

  y = addSignatureBlocks(pdf, signers, y + 4);
  addCertificatePage(pdf, input, signers);
  addFooter(pdf);

  return pdf.output("blob");
}
