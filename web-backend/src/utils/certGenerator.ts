import forge from "node-forge";
import fs from "node:fs/promises";
import path from "node:path";

export interface GeneratedCertificate {
  storagePath: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  fingerprintSha256: string;
}

export async function generateP12Certificate(
  userId: string,
  fullName: string,
  email: string,
  outputFolder: string,
  p12Password: string
): Promise<GeneratedCertificate> {
  // Generate RSA key pair (2048 bits is standard and fast enough)
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create X.509 Certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;

  // Random serial number
  const serialHex = Math.floor(Math.random() * 100000000).toString(16).padStart(8, "0");
  cert.serialNumber = serialHex;

  const validFrom = new Date();
  const validTo = new Date();
  validTo.setFullYear(validFrom.getFullYear() + 1); // Valid for 1 year

  cert.validity.notBefore = validFrom;
  cert.validity.notAfter = validTo;

  const attrs = [
    { name: "commonName", value: fullName },
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: "Escencial" },
    { name: "organizationalUnitName", value: "Firma Digital Portal" },
    { name: "emailAddress", value: email }
  ];
  cert.setSubject(attrs);
  // Self-signed, so issuer is the same as subject
  cert.setIssuer(attrs);

  // Add extensions
  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: false
    },
    {
      name: "keyUsage",
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: "extKeyUsage",
      serverAuth: false,
      clientAuth: true,
      codeSigning: false,
      emailProtection: true,
      timeStamping: true
    }
  ]);

  // Sign certificate with private key using SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Package into PKCS#12 (P12) store
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], p12Password, {
    algorithm: "3des"
  });

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, "binary");

  // Ensure output directory exists
  await fs.mkdir(outputFolder, { recursive: true });

  const fileName = `${userId}_certificate.p12`;
  const storagePath = path.join(outputFolder, fileName);
  await fs.writeFile(storagePath, p12Buffer);

  // Calculate fingerprint SHA-256 of the certificate
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const shamd = forge.md.sha256.create();
  shamd.update(certDer);
  const fingerprintSha256 = shamd.digest().toHex();

  return {
    storagePath,
    serialNumber: serialHex,
    validFrom,
    validTo,
    fingerprintSha256
  };
}
