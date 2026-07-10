import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as forge from "npm:node-forge@1.3.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile || profile.verification_status !== "VERIFIED") {
      return new Response(JSON.stringify({ error: "Se requiere identidad verificada para generar un certificado" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;

    const serialBytes = new Uint8Array(16);
    crypto.getRandomValues(serialBytes);
    const serialHex = Array.from(serialBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    cert.serialNumber = serialHex;

    const validFrom = new Date();
    const validTo = new Date();
    validTo.setFullYear(validFrom.getFullYear() + 1);

    cert.validity.notBefore = validFrom;
    cert.validity.notAfter = validTo;

    const attrs = [
      { name: "commonName", value: profile.full_name ?? user.email },
      { name: "countryName", value: "AR" },
      { name: "organizationName", value: "Escencial" },
      { name: "organizationalUnitName", value: "Firma Electrónica Portal" },
      { name: "emailAddress", value: user.email },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
      { name: "extKeyUsage", serverAuth: false, clientAuth: true, codeSigning: false, emailProtection: true, timeStamping: true },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const p12Password = crypto.randomUUID();
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], p12Password, { algorithm: "3des" });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Buffer = new TextEncoder().encode(p12Der);

    const fileName = `${user.id}_${serialHex}_certificate.p12`;
    const storagePath = `certificates/${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(storagePath, p12Buffer, {
        contentType: "application/x-pkcs12",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Error subiendo certificado a Storage: ${uploadError.message}` }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    const fingerprintSha256 = md.digest().toHex();

    const subject = `CN=${profile.full_name}, O=Escencial, E=${user.email}`;

    const { data: certRecord, error: dbError } = await supabase
      .from("certificates")
      .insert({
        user_id: user.id,
        label: `Certificado Personal - ${profile.full_name}`,
        type: "P12",
        issuer: "Escencial CA",
        subject,
        serial_number: serialHex,
        valid_from: validFrom.toISOString(),
        valid_to: validTo.toISOString(),
        fingerprint_sha256: fingerprintSha256,
        metadata: { storagePath, p12Password },
      })
      .select()
      .single();

    if (dbError) {
      return new Response(JSON.stringify({ error: `Error guardando certificado en DB: ${dbError.message}` }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: signedUrlData } = await supabase.storage
      .from("certificates")
      .createSignedUrl(storagePath, 3600);

    return new Response(
      JSON.stringify({
        id: certRecord.id,
        label: certRecord.label,
        serialNumber: serialHex,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        fingerprintSha256,
        downloadUrl: signedUrlData?.signedUrl ?? null,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
