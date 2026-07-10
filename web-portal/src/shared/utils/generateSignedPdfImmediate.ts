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

  const pos = position ?? DEFAULT_SIGNATURE_POSITION;

  for (const signer of signers) {
    if (!signer.signatureData) continue;

    // Determine target page
    const pageCount = pdfDoc.getPageCount();
    const pageIndex = pos.page === "last"
      ? pageCount - 1
      : Math.min(Math.max(0, pos.page as number), pageCount - 1);

    const page = pdfDoc.getPage(pageIndex);
    const { height: pageH } = page.getSize();

    // pdf-lib uses bottom-left origin; our config uses bottom-left too
    const sigX = pos.x;
    const sigY = pageH - pos.y - pos.height; // convert top-left Y to bottom-left Y

    // 1. Embed and draw the signature image
    try {
      const sigImage = await pdfDoc.embedPng(signer.signatureData);
      page.drawImage(sigImage, {
        x: sigX,
        y: sigY,
        width: pos.width,
        height: pos.height,
      });
    } catch {
      // If PNG fails, try JPEG
      try {
        const sigImage = await pdfDoc.embedJpg(signer.signatureData);
        page.drawImage(sigImage, {
          x: sigX,
          y: sigY,
          width: pos.width,
          height: pos.height,
        });
      } catch {
        // Signature image not embeddable, draw placeholder text
        page.drawText("Firma no disponible", {
          x: sigX + 4,
          y: sigY + pos.height / 2,
          size: 8,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6),
        });
      }
    }

    // 2. Draw a thin line under the signature
    page.drawLine({
      start: { x: sigX, y: sigY - 1 },
      end: { x: sigX + pos.width, y: sigY - 1 },
      color: rgb(0.3, 0.3, 0.3),
      thickness: 0.5,
    });

    // 3. Draw label text below the line
    const labelY = sigY - 8;
    const dateStr = new Date(signer.signedAt).toLocaleString("es-AR");

    page.drawText(`${signer.name || signer.email} — ${dateStr}`, {
      x: sigX,
      y: labelY,
      size: 6,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText("Firma electrónica — Ley 25.506", {
      x: sigX,
      y: labelY - 8,
      size: 5,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const modifiedBytes = await pdfDoc.save();
  const buffer = new ArrayBuffer(modifiedBytes.byteLength);
  new Uint8Array(buffer).set(modifiedBytes);
  return new Blob([buffer], { type: "application/pdf" });
}
