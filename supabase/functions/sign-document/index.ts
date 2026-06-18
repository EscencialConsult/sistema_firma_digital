import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import * as forge from "npm:node-forge@1.3.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://firma.escencial.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "'00'";
}

async function sha256(buffer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexEncode(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function signPdf(
  pdfBytes: Uint8Array,
  p12Buffer: Uint8Array,
  p12Password: string,
  signerName: string,
  signerEmail: string,
): Promise<Uint8Array> {
  const p12Der = forge.util.createBuffer(
    String.fromCharCode(...new Uint8Array(p12Buffer))
  );
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  const certBagObj = certBags[forge.pki.oids.certBag]?.[0];

  if (!keyBag?.key || !certBagObj?.cert) {
    throw new Error("No se pudo extraer la clave privada o el certificado del P12");
  }

  const privateKey = keyBag.key as forge.pki.PrivateKey;
  const cert = certBagObj.cert as forge.pki.Certificate;

  const pdfStr = new TextDecoder().decode(pdfBytes);
  const eofPos = pdfStr.lastIndexOf("%%EOF");
  if (eofPos === -1) throw new Error("PDF inválido: no se encontró %%EOF");

  const sigContentSize = 16384;
  const placeholder = `/Type /Sig /SubFilter /adbe.pkcs7.detached /Reason(Firma Digital) /Name(${signerName}) /ContactInfo(${signerEmail}) /M(D:${formatDate(new Date())}) /ByteRange[0 00000000 00000000 00000000] /Contents<${"0".repeat(sigContentSize)}>`;

  const insertionStr = `\n${placeholder}\n`;
  const beforeEof = pdfStr.substring(0, eofPos);
  const afterEof = pdfStr.substring(eofPos);
  const newPdfStr = beforeEof + insertionStr + afterEof;
  const withPlaceholder = new TextEncoder().encode(newPdfStr);

  const contentTag = "/Contents<";
  const contentIdx = withPlaceholder.indexOf(new TextEncoder().encode(contentTag));
  if (contentIdx === -1) throw new Error("No se encontró placeholder Contents");
  const contentStart = contentIdx + contentTag.length;

  const brTag = "/ByteRange[";
  const brIdx = withPlaceholder.indexOf(new TextEncoder().encode(brTag));
  if (brIdx === -1) throw new Error("No se encontró ByteRange");

  const brStart = brIdx + brTag.length;
  const brEnd = withPlaceholder.indexOf(new TextEncoder().encode("]"), brStart);
  const brContent = new TextDecoder().decode(withPlaceholder.slice(brStart, brEnd));
  const parts = brContent.trim().split(/\s+/).map(Number);

  const byteRangePad = parts[1];
  const byteRangeLen = parts[3];

  const rangeBefore = withPlaceholder.slice(0, byteRangePad);
  const rangeAfter = withPlaceholder.slice(byteRangePad + byteRangeLen);
  const toSign = new Uint8Array([...rangeBefore, ...rangeAfter]);

  const hashBuffer = await crypto.subtle.digest("SHA-256", toSign);
  const hashBytes = new Uint8Array(hashBuffer);

  const md = forge.md.sha256.create();
  md.update(String.fromCharCode(...hashBytes));

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(String.fromCharCode(...hashBytes));
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.signingTime, value: new Date() },
      { type: forge.pki.oids.messageDigest },
    ],
  } as any);
  p7.sign({ detached: true });

  const pkcs7Der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const pkcs7Hex = hexEncode(pkcs7Der);

  if (pkcs7Hex.length > sigContentSize) {
    throw new Error(`Firma demasiado grande (${pkcs7Hex.length} > ${sigContentSize} hex chars)`);
  }

  const result = new Uint8Array(withPlaceholder);
  const sigHexBytes = new TextEncoder().encode(pkcs7Hex);
  result.set(sigHexBytes, contentStart);

  const lenBeforeSig = contentStart;
  const lenAfterSig = result.length - (contentStart + sigContentSize);
  const finalByteRange = [0, lenBeforeSig, lenBeforeSig + sigContentSize, lenAfterSig];
  const finalBrStr = `${finalByteRange[0]} ${finalByteRange[1]} ${finalByteRange[2]} ${finalByteRange[3]}`;
  const finalBrBytes = new TextEncoder().encode(finalBrStr);
  result.set(finalBrBytes, brStart);

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json() as {
      token?: string;
      requestId?: string;
      otp: string;
    };

    let signatureRequest;

    if (body.token) {
      const { data } = await supabase.rpc("get_signature_request_by_token", {
        p_token: body.token,
      });
      if (!data) {
        return new Response(JSON.stringify({ error: "Solicitud de firma no encontrada o vencida" }), {
          status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      signatureRequest = data;
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Se requiere autenticación" }), {
          status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const { data: sr } = await supabase
        .from("signature_requests")
        .select("*, documents(*, document_versions:document_versions!document_versions_document_id_fkey(*))")
        .eq("id", body.requestId)
        .eq("signer_email", user.email)
        .single();
      if (!sr) {
        return new Response(JSON.stringify({ error: "Solicitud de firma no encontrada" }), {
          status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      signatureRequest = sr;
    }

    const srId = signatureRequest.id;
    const signerEmail = signatureRequest.signerEmail ?? signatureRequest.signer_email;
    const signerName = signatureRequest.signerName ?? signatureRequest.signer_name;
    const docTitle = signatureRequest.documentTitle ?? signatureRequest.documents?.title;
    const docId = signatureRequest.documentId ?? signatureRequest.document_id;
    const storagePath = signatureRequest.pdfUrl ?? signatureRequest.documents?.document_versions?.[0]?.storage_path;

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "El documento no tiene archivo PDF" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: otpValid } = await supabase.rpc("verify_otp", {
      p_signature_request_id: srId,
      p_code: body.otp,
    });

    if (!otpValid) {
      return new Response(JSON.stringify({ error: "Código OTP inválido o expirado" }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: conformityCheck } = await supabase
      .from("conformity_acceptances")
      .select("id")
      .eq("signature_request_id", srId)
      .limit(1);

    if (!conformityCheck?.length) {
      return new Response(JSON.stringify({ error: "Debe aceptar la conformidad antes de firmar" }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: pdfBlob, error: dlError } = await supabase.storage
      .from("contract-pdfs")
      .download(storagePath);

    if (dlError || !pdfBlob) {
      return new Response(JSON.stringify({ error: "Error descargando PDF" }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

    const { data: signerUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", signerEmail)
      .maybeSingle();

    let p12Buffer: Uint8Array;
    let p12Password: string;

    if (signerUser && signerUser.verification_status === "VERIFIED") {
      const { data: certs } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", signerUser.id)
        .eq("status", "ACTIVE")
        .limit(1);

      let certRecord = certs?.[0];

      if (!certRecord) {
        const { data: newCert, error: genError } = await supabase.functions.invoke("generate-certificate", {
          body: {},
        });
        if (genError || !newCert) {
          return new Response(JSON.stringify({ error: "Error generando certificado" }), {
            status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        const { data: freshCert } = await supabase
          .from("certificates")
          .select("*")
          .eq("user_id", signerUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        certRecord = freshCert;
      }

      const { data: certBlob } = await supabase.storage
        .from("certificates")
        .download(certRecord.metadata.storagePath);

      if (!certBlob) {
        return new Response(JSON.stringify({ error: "Error descargando certificado P12" }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      p12Buffer = new Uint8Array(await certBlob.arrayBuffer());
      p12Password = certRecord.metadata.p12Password;
    } else {
      const tempPassword = crypto.randomUUID();
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;

      const serialBytes = new Uint8Array(16);
      crypto.getRandomValues(serialBytes);
      cert.serialNumber = Array.from(serialBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

      const validFrom = new Date();
      const validTo = new Date();
      validTo.setFullYear(validFrom.getFullYear() + 1);
      cert.validity.notBefore = validFrom;
      cert.validity.notAfter = validTo;

      const attrs = [
        { name: "commonName", value: signerName },
        { name: "countryName", value: "AR" },
        { name: "organizationName", value: "Escencial" },
        { name: "emailAddress", value: signerEmail },
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey, forge.md.sha256.create());

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], tempPassword, { algorithm: "3des" });
      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
      p12Buffer = new TextEncoder().encode(p12Der);
      p12Password = tempPassword;
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPageCount();
    const lastPage = pdfDoc.getPage(pages - 1);
    const { width: pageW } = lastPage.getSize();

    const metaX = 50;
    const metaY = 50;
    const metaW = Math.min(200, pageW - 100);
    const metaH = 60;

    lastPage.drawRectangle({
      x: metaX, y: metaY, width: metaW, height: metaH,
      color: rgb(0.96, 0.98, 0.96),
      borderColor: rgb(0.06, 0.46, 0.24),
      borderWidth: 1.5,
    });

    lastPage.drawText("FIRMA DIGITAL SEGURA", {
      x: metaX + 8, y: metaY + metaH - 12,
      size: 7, font: helveticaBold, color: rgb(0.06, 0.46, 0.24),
    });
    lastPage.drawText(`Firmante: ${signerName || signerEmail}`, {
      x: metaX + 8, y: metaY + metaH - 24,
      size: 6.5, font: helveticaFont, color: rgb(0.1, 0.1, 0.1),
    });
    const dateStr = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    lastPage.drawText(`Fecha: ${dateStr}`, {
      x: metaX + 8, y: metaY + metaH - 34,
      size: 6, font: helveticaFont, color: rgb(0.3, 0.3, 0.3),
    });
    lastPage.drawText(`ID: ${srId.slice(0, 8)}...`, {
      x: metaX + 8, y: metaY + metaH - 44,
      size: 5.5, font: helveticaFont, color: rgb(0.5, 0.5, 0.5),
    });
    lastPage.drawText(`Email: ${signerEmail}`, {
      x: metaX + 8, y: metaY + metaH - 54,
      size: 5.5, font: helveticaFont, color: rgb(0.5, 0.5, 0.5),
    });

    const pdfWithVisualBytes = await pdfDoc.save();

    const signedPdfBytes = await signPdf(
      pdfWithVisualBytes,
      p12Buffer,
      p12Password,
      signerName || signerEmail,
      signerEmail,
    );

    const newHash = await sha256(signedPdfBytes);
    const safeName = (signatureRequest.fileName ?? "document.pdf").replace(/[^\w.\- ]+/g, "_");
    const newStoragePath = `contracts/${docId}/v_signed_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("contract-pdfs")
      .upload(newStoragePath, signedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Error subiendo PDF firmado: ${uploadError.message}` }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: newVersion } = await supabase
      .from("document_versions")
      .insert({
        document_id: docId,
        version_number: 2,
        file_name: `signed_${safeName}`,
        storage_path: newStoragePath,
        sha256_hash: newHash,
        file_size: signedPdfBytes.length,
      })
      .select()
      .single();

    await supabase
      .from("documents")
      .update({ current_version_id: newVersion.id })
      .eq("id", docId);

    await supabase
      .from("signature_requests")
      .update({ status: "SIGNED", signed_at: new Date().toISOString() })
      .eq("id", srId);

    await supabase.from("signatures").insert({
      signature_request_id: srId,
      document_id: docId,
      document_version_id: newVersion.id,
      signer_email: signerEmail,
      signer_name: signerName,
      document_hash: newHash,
      metadata: { signatureType: "P12", otpValidated: true },
    });

    const { data: pendingCount } = await supabase
      .from("signature_requests")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docId)
      .not("status", "in", '("SIGNED","REJECTED")');

    const { data: totalCount } = await supabase
      .from("signature_requests")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docId);

    if (pendingCount === 0 && totalCount > 0) {
      await supabase
        .from("documents")
        .update({ status: "COMPLETED", completed_signers: totalCount })
        .eq("id", docId);

      await supabase.from("audit_logs").insert({
        action: "DOCUMENT_COMPLETED",
        entity_type: "document",
        entity_id: docId,
        document_hash: newHash,
        metadata: { docTitle },
      });
    } else {
      await supabase
        .from("documents")
        .update({ completed_signers: totalCount - pendingCount })
        .eq("id", docId);
    }

    await supabase.from("audit_logs").insert({
      action: "DOCUMENT_SIGNED",
      entity_type: "signature_request",
      entity_id: srId,
      document_hash: newHash,
      metadata: { documentId: docId, signerEmail, signatureType: "P12", otpValidated: true },
    });

    return new Response(
      JSON.stringify({
        signatureId: crypto.randomUUID(),
        documentHash: newHash,
        signedAt: new Date().toISOString(),
        signerEmail,
        signerName,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
