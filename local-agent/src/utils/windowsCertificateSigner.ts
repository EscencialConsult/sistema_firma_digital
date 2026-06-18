import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer } from "@signpdf/utils";
import { AppError } from "./AppError.js";

const execFileAsync = promisify(execFile);
const WINDOWS_STORE_MODULE = "windows-cert-store";

type WindowsCertRecord = {
  subject: string;
  thumbprint: string;
  issuer?: string;
  notAfter?: string;
  store: string;
};

export function isWindowsCertificateModule(modulePath?: string) {
  return modulePath === WINDOWS_STORE_MODULE;
}

function scriptsPath(fileName: string) {
  return [
    path.resolve(process.cwd(), "scripts", fileName),
    path.resolve(process.cwd(), "web-backend", "scripts", fileName)
  ].find((candidate) => fsSync.existsSync(candidate));
}

async function signCmsWithWindowsCertificate(content: Buffer, thumbprint: string) {
  const scriptPath = scriptsPath("sign-cms-windows-cert.ps1");
  if (!scriptPath) {
    throw new AppError(500, "WINDOWS_CERT_SCRIPT_NOT_FOUND", "No se encontro el script de firma de Windows.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "firma-windows-cert-"));
  const inputPath = path.join(tempDir, "content.bin");
  const outputPath = path.join(tempDir, "signature.der");
  try {
    await fs.writeFile(inputPath, content);
    const result = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-InputPath",
      inputPath,
      "-OutputPath",
      outputPath,
      "-Thumbprint",
      thumbprint
    ], { windowsHide: false, timeout: 120000 });

    await fs.access(outputPath).catch(() => {
      throw new AppError(500, "WINDOWS_CERT_SIGN_FAILED", `Windows no genero la firma CMS. ${result.stderr || result.stdout || ""}`);
    });

    return fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

class WindowsCertificateSigner extends Signer {
  constructor(private readonly thumbprint: string) {
    super();
  }

  sign(pdfBuffer: Buffer) {
    return signCmsWithWindowsCertificate(pdfBuffer, this.thumbprint);
  }
}

export async function detectWindowsCertificates() {
  const command = [
    "$certs = @();",
    "$stores = @('Cert:\\CurrentUser\\My','Cert:\\LocalMachine\\My');",
    "foreach ($store in $stores) {",
    "  Get-ChildItem $store -ErrorAction SilentlyContinue | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } | ForEach-Object {",
    "    $certs += [pscustomobject]@{ subject=$_.Subject; thumbprint=$_.Thumbprint; issuer=$_.Issuer; notAfter=$_.NotAfter.ToString('o'); store=$store }",
    "  }",
    "}",
    "$certs | ConvertTo-Json -Compress"
  ].join(" ");

  const result = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], {
    windowsHide: true,
    timeout: 30000
  });

  const raw = result.stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as WindowsCertRecord | WindowsCertRecord[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function signPdfWithWindowsCertificate(inputPdf: string, outputPdf: string, thumbprint: string, signerName: string) {
  const pdfBytes = await fs.readFile(inputPdf);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: "Firma digital",
    contactInfo: "",
    name: signerName,
    location: "Argentina",
    signatureLength: 32768
  });

  const pdfWithPlaceholder = await pdfDoc.save();
  const signedPdf = await new SignPdf().sign(Buffer.from(pdfWithPlaceholder), new WindowsCertificateSigner(thumbprint));
  await fs.writeFile(outputPdf, signedPdf);
}

export const windowsCertificateToken = {
  modulePath: WINDOWS_STORE_MODULE,
  moduleName: "Windows",
  label: "Certificados de Windows",
  manufacturer: "Microsoft Windows",
  model: "Certificate Store",
  serial: "CurrentUser/LocalMachine"
};
