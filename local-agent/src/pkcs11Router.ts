import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { detectPkcs11Tokens, signPdfWithPyhanko, Pkcs11Signer } from "./utils/pkcs11Signer.js";
import { isWindowsCertificateModule } from "./utils/windowsCertificateSigner.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function detectPkcs11TokensHandler(req: Request, res: Response) {
  try {
    const pin = req.query.pin as string | undefined;
    const result = await detectPkcs11Tokens(pin);
    res.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error detectando tokens PKCS#11";
    res.status(500).json({ error: "PKCS11_DETECT_ERROR", message });
  }
}

export async function signWithPkcs11Handler(req: Request, res: Response) {
  try {
    const {
      documentId,
      storagePath,
      signerEmail,
      signerName,
      pin,
      modulePath,
      certId,
      slot,
      metadata,
    } = req.body as {
      documentId: string;
      storagePath: string;
      signerEmail: string;
      signerName?: string;
      pin: string;
      modulePath?: string;
      certId?: string;
      slot?: string;
      metadata?: Record<string, unknown>;
    };

    if (!storagePath || !pin) {
      res.status(400).json({ error: "storagePath y pin son requeridos" });
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
    targetPage.drawText("FIRMA ELECTRÓNICA PKCS#11", {
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
    targetPage.drawText(`Token: ${certId || "configurado"}`, {
      x: metaX + 8, y: metaY + metaH - 53, size: 5.5,
      font: helveticaFont, color: rgb(0.45, 0.45, 0.45),
    });

    const pdfWithVisualBytes = await pdfDoc.save();

    const tempDir = mkdtempSync(join(tmpdir(), "firma-agent-"));
    const safeName = `${randomUUID()}_signed.pdf`;
    const unsignedPath = join(tempDir, `unsigned_${safeName}`);
    const signedPath = join(tempDir, `signed_${safeName}`);
    writeFileSync(unsignedPath, pdfWithVisualBytes);

    try {
      if (isWindowsCertificateModule(modulePath)) {
        const { signPdfWithWindowsCertificate } = await import("./utils/windowsCertificateSigner.js");
        await signPdfWithWindowsCertificate(unsignedPath, signedPath, certId!, signerEmail);
      } else {
        await signPdfWithPyhanko({
          pin,
          modulePath: modulePath ?? "",
          certId,
          slot,
          inputPdf: unsignedPath,
          outputPdf: signedPath,
          signerName: signerName || signerEmail,
          contactInfo: signerEmail,
          page: metaPageNum,
          x: metaX, y: metaY, width: metaW, height: metaH,
        });
      }

      const signedBuffer = readFileSync(signedPath);
      const newStoragePath = `contracts/${documentId}/pkcs11_signed_${safeName}`;

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
    const message = error instanceof Error ? error.message : "Error firmando con PKCS#11";
    res.status(500).json({ error: "PKCS11_SIGN_ERROR", message });
  }
}
