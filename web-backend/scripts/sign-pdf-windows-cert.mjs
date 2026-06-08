import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer } from "@signpdf/utils";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmsScript = path.join(__dirname, "sign-cms-windows-cert.ps1");

class WindowsCertificateSigner extends Signer {
  constructor(thumbprint) {
    super();
    this.thumbprint = thumbprint;
  }

  async sign(pdfBuffer) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "firma-windows-cert-"));
    const inputPath = path.join(tempDir, "content.bin");
    const outputPath = path.join(tempDir, "signature.der");
    try {
      await fs.writeFile(inputPath, pdfBuffer);
      const result = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        cmsScript,
        "-InputPath",
        inputPath,
        "-OutputPath",
        outputPath,
        "-Thumbprint",
        this.thumbprint
      ], { windowsHide: false, timeout: 120000 });
      await fs.access(outputPath).catch(() => {
        throw new Error(`Windows no genero la firma CMS. stdout=${result.stdout || ""} stderr=${result.stderr || ""}`);
      });
      return fs.readFile(outputPath);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const input = arg("--input");
const output = arg("--output");
const thumbprint = arg("--thumbprint");

if (!input || !output || !thumbprint) {
  console.error("Uso: node sign-pdf-windows-cert.mjs --input archivo.pdf --output firmado.pdf --thumbprint THUMBPRINT");
  process.exit(1);
}

const pdfBytes = await fs.readFile(input);
const pdfDoc = await PDFDocument.load(pdfBytes);
pdflibAddPlaceholder({
  pdfDoc,
  reason: "Firma digital",
  contactInfo: "",
  name: "COLQUE Maria Laura",
  location: "Argentina",
  signatureLength: 32768
});

const pdfWithPlaceholder = await pdfDoc.save();
const signedPdf = await new SignPdf().sign(Buffer.from(pdfWithPlaceholder), new WindowsCertificateSigner(thumbprint));
await fs.writeFile(output, signedPdf);
console.log(output);
