import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { SignaturePosition } from "../types/contract";
import { DEFAULT_SIGNATURE_POSITION } from "../types/contract";

export interface SignerInfo {
  name: string;
  email: string;
  signedAt: string;
  signatureData: string | null;
}

/**
 * Takes an original PDF and embeds visual signatures at the configured position.
 * Used immediately after each user signs, before all signers are done.
 */
export async function generateSignedPdfImmediate(
  originalPdf: Blob,
  signers: SignerInfo[],
  position: SignaturePosition = DEFAULT_SIGNATURE_POSITION,
): Promise<Blob> {
  const pdfBytes = await originalPdf.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add a new page specifically for the signature stamps to avoid overlapping the contract text
  let targetPage = pdfDoc.addPage();
  let { width: pageW, height: pageH } = targetPage.getSize();

  // Draw page header/title
  targetPage.drawText("HOJA DE FIRMAS", {
    x: 50,
    y: pageH - 45,
    size: 12,
    font: helveticaBold,
    color: rgb(0.06, 0.46, 0.24),
  });

  targetPage.drawLine({
    start: { x: 50, y: pageH - 55 },
    end: { x: pageW - 50, y: pageH - 55 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  let currentY = pageH - 120;
  const sigWidth = 150;
  const sigHeight = 45;
  const gap = 35;

  for (const signer of signers) {
    if (!signer.signatureData) continue;

    // Check if we need to add a new page due to space constraints
    if (currentY < 50 + sigHeight) {
      targetPage = pdfDoc.addPage();
      const size = targetPage.getSize();
      pageW = size.width;
      pageH = size.height;

      targetPage.drawText("HOJA DE FIRMAS (Cont.)", {
        x: 50,
        y: pageH - 45,
        size: 12,
        font: helveticaBold,
        color: rgb(0.06, 0.46, 0.24),
      });

      targetPage.drawLine({
        start: { x: 50, y: pageH - 55 },
        end: { x: pageW - 50, y: pageH - 55 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      currentY = pageH - 120;
    }

    const sigX = 50;
    const sigY = currentY;

    // 1. Embed and draw the signature image
    try {
      const sigImage = await pdfDoc.embedPng(signer.signatureData);
      targetPage.drawImage(sigImage, {
        x: sigX,
        y: sigY,
        width: sigWidth,
        height: sigHeight,
      });
    } catch {
      // If PNG fails, try JPEG
      try {
        const sigImage = await pdfDoc.embedJpg(signer.signatureData);
        targetPage.drawImage(sigImage, {
          x: sigX,
          y: sigY,
          width: sigWidth,
          height: sigHeight,
        });
      } catch {
        // Signature image not embeddable, draw placeholder text
        targetPage.drawText("Firma no disponible", {
          x: sigX + 4,
          y: sigY + sigHeight / 2,
          size: 8,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6),
        });
      }
    }

    // 2. Draw a thin line under the signature
    targetPage.drawLine({
      start: { x: sigX, y: sigY - 4 },
      end: { x: sigX + sigWidth, y: sigY - 4 },
      color: rgb(0.3, 0.3, 0.3),
      thickness: 0.5,
    });

    // 3. Draw label text below the line
    const labelY = sigY - 14;
    const dateStr = new Date(signer.signedAt).toLocaleString("es-AR");

    targetPage.drawText(`${signer.name || signer.email} — ${dateStr}`, {
      x: sigX,
      y: labelY,
      size: 7.5,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    targetPage.drawText("Firma electrónica — Ley 25.506", {
      x: sigX,
      y: labelY - 10,
      size: 6.5,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    currentY -= (sigHeight + gap + 20);
  }

  const modifiedBytes = await pdfDoc.save();
  const buffer = new ArrayBuffer(modifiedBytes.byteLength);
  new Uint8Array(buffer).set(modifiedBytes);
  return new Blob([buffer], { type: "application/pdf" });
}
