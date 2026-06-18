import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { detectWindowsCertificates, signPdfWithWindowsCertificate } from "./utils/windowsCertificateSigner.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function detectWindowsCertsHandler(_req: Request, res: Response) {
  try {
    const certificates = await detectWindowsCertificates();
    res.json({ data: certificates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error detectando certificados de Windows";
    res.status(500).json({ error: "WINDOWS_CERT_DETECT_ERROR", message });
  }
}

export async function signWithWindowsCertHandler(req: Request, res: Response) {
  try {
    const {
      documentId,
      storagePath,
      signerEmail,
      signerName,
      thumbprint,
      metadata,
    } = req.body as {
      documentId: string;
      storagePath: string;
      signerEmail: string;
      signerName?: string;
      thumbprint: string;
      metadata?: Record<string, unknown>;
    };

    if (!storagePath || !thumbprint) {
      res.status(400).json({ error: "storagePath y thumbprint son requeridos" });
      return;
    }

    const supabase = getSupabase();

    const { data: pdfBlob, error: dlError } = await supabase.storage
      .from("contract-pdfs")
      .download(storagePath);

    if (dlError || !pdfBlob) {
      res.status(500).json({ error: "Error descargando PDF de Storage", message: dlError?.message });
      return;
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const metaX = Number(metadata?.x ?? 50);
    const metaY = Number(metadata?.y ?? 50);
    const metaW = Number(metadata?.width ?? 190);
    const metaH = Number(metadata?.height ?? 64);
    const metaPageNum = Number(metadata?.page ?? 1);

    const pageIndex = Math.max(0, metaPageNum - 1);
    const pages = pdfDoc.getPageCount();
    const targetPage = pdfDoc.getPage(pageIndex < pages ? pageIndex : pages - 1);

    targetPage.drawRectangle({
      x: metaX, y: metaY, width: metaW, height: metaH,
      color: rgb(0.96, 0.98, 1),
      borderColor: rgb(0.05, 0.28, 0.62),
      borderWidth: 1.5,
    });
    targetPage.drawText("FIRMA DIGITAL WINDOWS", {
      x: metaX + 8, y: metaY + metaH - 13, size: 7,
      font: helveticaBold, color: rgb(0.05, 0.28, 0.62),
    });
    targetPage.drawText(`Firmante: ${signerName || signerEmail}`, {
      x: metaX + 8, y: metaY + metaH - 27, size: 6.5,
      font: helveticaFont, color: rgb(0.1, 0.1, 0.1),
    });
    targetPage.drawText(`Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`, {
      x: metaX + 8, y: metaY + metaH - 40, size: 6,
      font: helveticaFont, color: rgb(0.3, 0.3, 0.3),
    });

    const pdfWithVisualBytes = await pdfDoc.save();

    const tempDir = mkdtempSync(join(tmpdir(), "firma-agent-"));
    const safeName = `${randomUUID()}_signed.pdf`;
    const unsignedPath = join(tempDir, `unsigned_${safeName}`);
    const signedPath = join(tempDir, `signed_${safeName}`);
    writeFileSync(unsignedPath, pdfWithVisualBytes);

    try {
      await signPdfWithWindowsCertificate(unsignedPath, signedPath, thumbprint, signerEmail);

      const signedBuffer = readFileSync(signedPath);
      const newStoragePath = `contracts/${documentId}/windows_signed_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("contract-pdfs")
        .upload(newStoragePath, signedBuffer, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        res.status(500).json({ error: "Error subiendo PDF firmado a Storage", message: uploadError.message });
        return;
      }

      res.json({
        data: {
          storagePath: newStoragePath,
          fileSize: signedBuffer.length,
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error firmando con certificado de Windows";
    res.status(500).json({ error: "WINDOWS_SIGN_ERROR", message });
  }
}
