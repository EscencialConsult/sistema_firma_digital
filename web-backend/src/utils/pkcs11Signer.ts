import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import forge from "node-forge";
import { Signer } from "@signpdf/utils";
import { config } from "../config/env.js";
import { AppError } from "./AppError.js";
import { detectWindowsCertificates, windowsCertificateToken } from "./windowsCertificateSigner.js";

const execFileAsync = promisify(execFile);

type Pkcs11Options = {
  pin: string;
  certId?: string;
  modulePath?: string;
};

type PyhankoSignOptions = {
  pin: string;
  modulePath: string;
  certId?: string;
  slot?: string;
  inputPdf: string;
  outputPdf: string;
  signerName: string;
  contactInfo: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DetectedPkcs11Certificate = {
  id: string;
  label?: string;
};

export type DetectedPkcs11Token = {
  modulePath: string;
  moduleName: string;
  slot?: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  certificates: DetectedPkcs11Certificate[];
  error?: string;
};

function uniqueExistingPaths(paths: Array<string | undefined>) {
  const seen = new Set<string>();
  return paths
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => {
      const normalized = path.normalize(candidate);
      const key = normalized.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return fsSync.existsSync(normalized);
    });
}

function defaultPkcs11ModuleCandidates() {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const windir = process.env.WINDIR ?? "C:\\Windows";

  return uniqueExistingPaths([
    config.pkcs11ModulePath,
    path.join(windir, "System32", "eTPKCS11.dll"),
    path.join(windir, "SysWOW64", "eTPKCS11.dll"),
    path.join(windir, "System32", "aetpkss1.dll"),
    path.join(windir, "SysWOW64", "aetpkss1.dll"),
    path.join(windir, "System32", "aetpkss.dll"),
    path.join(windir, "SysWOW64", "aetpkss.dll"),
    path.join(windir, "System32", "gclib.dll"),
    path.join(windir, "SysWOW64", "gclib.dll"),
    path.join(programFiles, "OpenSC Project", "OpenSC", "pkcs11", "opensc-pkcs11.dll"),
    path.join(programFilesX86, "OpenSC Project", "OpenSC", "pkcs11", "opensc-pkcs11.dll"),
    path.join(programFiles, "OpenSC Project", "OpenSC", "pkcs11", "onepin-opensc-pkcs11.dll"),
    path.join(programFilesX86, "OpenSC Project", "OpenSC", "pkcs11", "onepin-opensc-pkcs11.dll"),
    path.join(programFiles, "SafeNet", "Authentication", "SAC", "x64", "IDPrimePKCS11.dll"),
    path.join(programFilesX86, "SafeNet", "Authentication", "SAC", "x32", "IDPrimePKCS11.dll")
  ]);
}

function defaultPkcs11ToolCandidates() {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  return uniqueExistingPaths([
    config.pkcs11ToolPath,
    path.join(programFiles, "OpenSC Project", "OpenSC", "tools", "pkcs11-tool.exe"),
    path.join(programFilesX86, "OpenSC Project", "OpenSC", "tools", "pkcs11-tool.exe")
  ]);
}

function defaultPyhankoPythonCandidates() {
  return uniqueExistingPaths([
    config.pyhankoPythonPath,
    path.resolve(process.cwd(), ".venv-pyhanko", "Scripts", "python.exe"),
    path.resolve(process.cwd(), "web-backend", ".venv-pyhanko", "Scripts", "python.exe"),
    `${process.env.LOCALAPPDATA ?? "C:\\Users\\Default\\AppData\\Local"}\\Programs\\Python\\Python311\\python.exe`
  ]);
}

function getPkcs11ToolPath() {
  const toolPath = defaultPkcs11ToolCandidates()[0];
  if (!toolPath) {
    throw new AppError(500, "PKCS11_TOOL_NOT_FOUND", "No se encontro pkcs11-tool. Instala OpenSC o configura PKCS11_TOOL_PATH.");
  }
  return toolPath;
}

function getPyhankoPythonPath() {
  const pythonPath = defaultPyhankoPythonCandidates()[0];
  if (!pythonPath) return null;
  const helperPath = [
    path.resolve(process.cwd(), "scripts", "pyhanko_pkcs11.py"),
    path.resolve(process.cwd(), "web-backend", "scripts", "pyhanko_pkcs11.py")
  ].find((candidate) => fsSync.existsSync(candidate));
  if (!helperPath) return null;
  return { pythonPath, helperPath };
}

function requirePkcs11Config(options: Pkcs11Options) {
  const modulePath = options.modulePath ?? config.pkcs11ModulePath;
  const certId = options.certId ?? config.pkcs11CertId;
  if (!modulePath) {
    throw new AppError(400, "PKCS11_MODULE_REQUIRED", "Configura PKCS11_MODULE_PATH con la DLL del token.");
  }
  if (!certId) {
    throw new AppError(400, "PKCS11_CERT_ID_REQUIRED", "Indica el ID del certificado PKCS#11 o configura PKCS11_CERT_ID.");
  }
  return { modulePath, certId };
}

async function runPkcs11Tool(args: string[]) {
  try {
    const result = await execFileAsync(getPkcs11ToolPath(), args, { windowsHide: true, timeout: 30000 });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(500, "PKCS11_TOOL_FAILED", `Error ejecutando pkcs11-tool: ${message}`);
  }
}

async function tryRunPkcs11Tool(args: string[]) {
  try {
    return await execFileAsync(getPkcs11ToolPath(), args, { windowsHide: true, timeout: 12000 });
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseSlots(modulePath: string, output: string): DetectedPkcs11Token[] {
  const moduleName = path.basename(modulePath);
  const blocks = output.split(/\r?\n(?=Slot\s+\d+)/i);

  return blocks
    .filter((block) => /token\s+label|token\s+manufacturer|token\s+model|token\s+serial/i.test(block))
    .map((block) => {
      const slot = block.match(/^Slot\s+([^\r\n]+)/i)?.[1]?.trim();
      const label = block.match(/token\s+label\s*:\s*(.+)/i)?.[1]?.trim();
      const manufacturer = block.match(/token\s+manufacturer\s*:\s*(.+)/i)?.[1]?.trim();
      const model = block.match(/token\s+model\s*:\s*(.+)/i)?.[1]?.trim();
      const serial = block.match(/token\s+serial\s*num\s*:\s*(.+)/i)?.[1]?.trim();
      return { modulePath, moduleName, slot, label, manufacturer, model, serial, certificates: [] };
    });
}

function parseCertificates(output: string): DetectedPkcs11Certificate[] {
  return output
    .split(/Certificate Object;?/i)
    .map((block): DetectedPkcs11Certificate | null => {
      const id = block.match(/\bID\s*:\s*([^\r\n]+)/i)?.[1]?.trim();
      const label = block.match(/\blabel\s*:\s*([^\r\n]+)/i)?.[1]?.trim();
      return id ? { id, label } : null;
    })
    .filter((certificate): certificate is DetectedPkcs11Certificate => Boolean(certificate));
}

function digestInfoDer(md: forge.md.MessageDigest) {
  const oid = forge.pki.oids[md.algorithm as keyof typeof forge.pki.oids];
  if (!oid) throw new AppError(500, "PKCS11_DIGEST_UNSUPPORTED", "Algoritmo de hash no soportado para PKCS#11.");

  const digestInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(oid).getBytes()),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, "")
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, md.digest().getBytes())
  ]);

  return Buffer.from(forge.asn1.toDer(digestInfo).getBytes(), "binary");
}

function runPkcs11ToolSync(args: string[]) {
  try {
    execFileSync(getPkcs11ToolPath(), args, { windowsHide: true, timeout: 30000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(500, "PKCS11_TOOL_FAILED", `Error ejecutando pkcs11-tool: ${message}`);
  }
}

async function runPyhankoHelper(args: string[]) {
  const pyhanko = getPyhankoPythonPath();
  if (!pyhanko) {
    throw new AppError(500, "PYHANKO_NOT_AVAILABLE", "No se encontro el entorno Python de pyHanko.");
  }
  try {
    const result = await execFileAsync(pyhanko.pythonPath, [pyhanko.helperPath, ...args], {
      windowsHide: true,
      timeout: 120000
    });
    return result.stdout.trim();
  } catch (error) {
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as any).stderr) : "";
    const message = stderr || (error instanceof Error ? error.message : String(error));
    throw new AppError(500, "PYHANKO_FAILED", `Error ejecutando pyHanko: ${message}`);
  }
}

export async function detectPkcs11TokensWithPyhanko(pin?: string) {
  const pyhanko = getPyhankoPythonPath();
  if (!pyhanko) return null;

  const tokens: DetectedPkcs11Token[] = [];
  for (const modulePath of defaultPkcs11ModuleCandidates()) {
    try {
      const output = await runPyhankoHelper(["detect", "--module-path", modulePath, ...(pin ? ["--pin", pin] : [])]);
      const parsed = JSON.parse(output) as { tokens?: DetectedPkcs11Token[] };
      if (parsed.tokens?.length) tokens.push(...parsed.tokens);
    } catch {
      continue;
    }
  }
  return { modulesChecked: defaultPkcs11ModuleCandidates(), tokens };
}

export async function signPdfWithPyhanko(options: PyhankoSignOptions) {
  await runPyhankoHelper([
    "sign",
    "--module-path", options.modulePath,
    "--pin", options.pin,
    ...(options.slot ? ["--slot", options.slot] : []),
    ...(options.certId ? ["--cert-id", options.certId] : []),
    "--input-pdf", options.inputPdf,
    "--output-pdf", options.outputPdf,
    "--signer-name", options.signerName,
    "--contact-info", options.contactInfo,
    "--page", String(options.page),
    "--x", String(options.x),
    "--y", String(options.y),
    "--width", String(options.width),
    "--height", String(options.height)
  ]);
}

export class Pkcs11Signer extends Signer {
  private readonly pin: string;
  private readonly certId: string;
  private readonly modulePath: string;
  private certificate?: forge.pki.Certificate;

  constructor(options: Pkcs11Options) {
    super();
    const pkcs11Config = requirePkcs11Config(options);
    this.pin = options.pin;
    this.certId = pkcs11Config.certId;
    this.modulePath = pkcs11Config.modulePath;
  }

  async loadCertificate() {
    if (this.certificate) return this.certificate;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "firma-pkcs11-"));
    const certPath = path.join(tempDir, "cert.der");
    try {
      await runPkcs11Tool([
        "--module", this.modulePath,
        "--login",
        "--pin", this.pin,
        "--read-object",
        "--type", "cert",
        "--id", this.certId,
        "--output-file", certPath
      ]);
      const der = await fs.readFile(certPath);
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary")));
      this.certificate = forge.pki.certificateFromAsn1(asn1);
      return this.certificate;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  async sign(pdfBuffer: Buffer, signingTime = new Date()) {
    if (!(pdfBuffer instanceof Buffer)) {
      throw new AppError(400, "PDF_BUFFER_REQUIRED", "PDF esperado como Buffer.");
    }

    const certificate = await this.loadCertificate();
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(pdfBuffer.toString("binary"));
    p7.addCertificate(certificate);

    p7.addSigner({
      key: {
        sign: (md: forge.md.MessageDigest) => this.signDigestInfoSync(digestInfoDer(md)).toString("binary")
      } as any,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.signingTime, value: signingTime as any },
        { type: forge.pki.oids.messageDigest }
      ]
    });

    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  }

  private signDigestInfoSync(digestInfo: Buffer) {
    const tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "firma-pkcs11-"));
    const inputPath = path.join(tempDir, "digestinfo.bin");
    const outputPath = path.join(tempDir, "signature.bin");
    try {
      fsSync.writeFileSync(inputPath, digestInfo);
      runPkcs11ToolSync([
        "--module", this.modulePath,
        "--login",
        "--pin", this.pin,
        "--sign",
        "--mechanism", "RSA-PKCS",
        "--id", this.certId,
        "--input-file", inputPath,
        "--output-file", outputPath
      ]);
      return fsSync.readFileSync(outputPath);
    } finally {
      fsSync.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export async function detectPkcs11Tokens(pin?: string) {
  const windowsCertificates = await detectWindowsCertificates().catch(() => []);
  const windowsTokens: DetectedPkcs11Token[] = windowsCertificates.length
    ? [{
        ...windowsCertificateToken,
        certificates: windowsCertificates.map((certificate) => ({
          id: certificate.thumbprint,
          label: `${certificate.subject} (${certificate.store})`
        }))
      }]
    : [];

  const pyhankoResult = await detectPkcs11TokensWithPyhanko(pin);
  if (pyhankoResult && pyhankoResult.tokens.length) {
    return {
      modulesChecked: pyhankoResult.modulesChecked,
      tokens: [...windowsTokens, ...pyhankoResult.tokens]
    };
  }

  const modules = defaultPkcs11ModuleCandidates();
  const tokens: DetectedPkcs11Token[] = [];

  for (const modulePath of modules) {
    const slotResult = await tryRunPkcs11Tool(["--module", modulePath, "--list-slots"]);
    const slotOutput = `${slotResult.stdout}${slotResult.stderr}`.trim();
    const moduleTokens = parseSlots(modulePath, slotOutput);

    if (!moduleTokens.length && slotOutput) {
      tokens.push({
        modulePath,
        moduleName: path.basename(modulePath),
        certificates: [],
        error: slotOutput.slice(0, 300)
      });
      continue;
    }

    if (pin && moduleTokens.length) {
      const certResult = await tryRunPkcs11Tool([
        "--module", modulePath,
        "--login",
        "--pin", pin,
        "--list-objects",
        "--type", "cert"
      ]);
      const certificates = parseCertificates(`${certResult.stdout}${certResult.stderr}`);
      moduleTokens.forEach((token) => {
        token.certificates = certificates;
      });
    }

    tokens.push(...moduleTokens);
  }

  return { modulesChecked: modules, tokens: [...windowsTokens, ...tokens] };
}
