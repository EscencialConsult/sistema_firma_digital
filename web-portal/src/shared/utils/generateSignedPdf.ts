import jsPDF from "jspdf";

export interface PdfSigner {
  name:          string;
  email:         string;
  signedAt:      string;
  signatureData: string | null; // data URL "data:image/png;base64,..."
}

/**
 * Genera un certificado PDF de firma electrónica con los datos de cada firmante
 * y la imagen de su firma manuscrita digitalizada.
 */
export async function generateSignedPdf(
  documentTitle: string,
  documentId:    string,
  signers:       PdfSigner[]
): Promise<Blob> {
  const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W      = 210;
  const margin = 20;
  let y        = 0;

  // ── Header ────────────────────────────────────────────────────────────────
  pdf.setFillColor(24, 24, 27);
  pdf.rect(0, 0, W, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("CERTIFICADO DE FIRMA ELECTRÓNICA", margin, 13);

  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("Escencial Consultora · Firma Digital · Válido conforme Ley 25.506 Argentina", margin, 22);

  y = 42;

  // ── Título del documento ──────────────────────────────────────────────────
  pdf.setTextColor(24, 24, 27);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(documentTitle, W - margin * 2) as string[];
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 6 + 2;

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(113, 113, 122);
  pdf.text(`ID: ${documentId}`, margin, y);
  y += 5;
  pdf.text(`Emitido: ${new Date().toLocaleString("es-AR")}`, margin, y);
  y += 10;

  // ── Separador ─────────────────────────────────────────────────────────────
  pdf.setDrawColor(228, 228, 231);
  pdf.line(margin, y, W - margin, y);
  y += 8;

  // ── Firmantes ─────────────────────────────────────────────────────────────
  for (const [i, signer] of signers.entries()) {
    // Check page break
    if (y > 250) {
      pdf.addPage();
      y = 20;
    }

    // Número de firmante
    pdf.setFillColor(245, 245, 244);
    pdf.roundedRect(margin, y - 4, W - margin * 2, 8, 2, 2, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(87, 83, 78);
    pdf.text(`FIRMANTE ${i + 1}`, margin + 3, y + 1.5);
    y += 10;

    // Datos del firmante
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(24, 24, 27);
    pdf.text(signer.name, margin, y);
    y += 5.5;

    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(113, 113, 122);
    pdf.text(`Email:    ${signer.email}`, margin, y);       y += 4.5;
    pdf.text(`Firmado:  ${new Date(signer.signedAt).toLocaleString("es-AR")}`, margin, y); y += 4.5;
    pdf.text("Método:   Firma electrónica avanzada · OTP + Verificación facial + Firma manuscrita", margin, y); y += 7;

    // Firma manuscrita
    if (signer.signatureData) {
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(161, 161, 170);
      pdf.text("Firma manuscrita digitalizada:", margin, y);
      y += 3;

      // Fondo gris claro para el recuadro de firma
      pdf.setFillColor(250, 250, 249);
      pdf.setDrawColor(228, 228, 231);
      pdf.roundedRect(margin, y, 70, 22, 3, 3, "FD");

      try {
        pdf.addImage(signer.signatureData, "PNG", margin + 2, y + 1, 66, 20);
      } catch {
        pdf.setFontSize(8);
        pdf.setTextColor(161, 161, 170);
        pdf.text("(firma no disponible)", margin + 5, y + 12);
      }
      y += 26;
    }

    y += 4;
    pdf.setDrawColor(228, 228, 231);
    pdf.line(margin, y, W - margin, y);
    y += 10;
  }

  // ── Bloque de validez legal ───────────────────────────────────────────────
  if (y > 240) { pdf.addPage(); y = 20; }

  pdf.setFillColor(240, 253, 244);
  pdf.setDrawColor(187, 247, 208);
  pdf.roundedRect(margin, y, W - margin * 2, 22, 3, 3, "FD");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(22, 101, 52);
  pdf.text("FIRMA ELECTRÓNICA VÁLIDA", margin + 5, y + 7);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(
    "Este certificado acredita la firma electrónica conforme a la Ley N° 25.506 de la República Argentina.",
    margin + 5, y + 13
  );
  pdf.text(
    "Las identidades fueron verificadas mediante OTP, reconocimiento facial y firma manuscrita digital.",
    margin + 5, y + 18
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(161, 161, 170);
  pdf.text(
    "Escencial Consultora · sistema_firma_digital · Este documento es un certificado digital y no requiere firma adicional.",
    margin,
    285
  );

  return pdf.output("blob");
}
