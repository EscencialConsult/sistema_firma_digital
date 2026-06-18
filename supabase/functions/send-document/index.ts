import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://firma.escencial.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function secureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: caller } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!caller || (caller.role !== "ADMIN" && caller.role !== "ORGANIZATION_ADMIN")) {
      return new Response(JSON.stringify({ error: "Se requiere rol ADMIN" }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { documentId, signers, expiresInDays = 30 } = await req.json() as {
      documentId: string;
      signers: Array<{ email: string; name?: string }>;
      expiresInDays?: number;
    };

    if (!documentId || !signers?.length) {
      return new Response(JSON.stringify({ error: "documentId y signers son requeridos" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: document } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (!document) {
      return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
        status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const createdRequests = [];

    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      const rawToken = secureToken();
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: sigReq, error: srError } = await supabase
        .from("signature_requests")
        .insert({
          document_id: documentId,
          signer_email: signer.email,
          signer_name: signer.name ?? signer.email,
          token: rawToken,
          status: "PENDING",
          signing_order: i,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (srError) throw new Error(`Error creando signature request: ${srError.message}`);

      const generatedOtp = await supabase.rpc("generate_otp", {
        p_signature_request_id: sigReq.id,
      });

      const signingUrl = `${APP_URL}/signing/${sigReq.id}`;

      supabase.functions
        .invoke("send-signing-email", {
          body: {
            signerEmail: signer.email,
            signerName: signer.name ?? signer.email,
            documentTitle: document.title,
            requestId: sigReq.id,
          },
        })
        .catch((e: unknown) => console.warn("[send-document] Error sending email:", e));

      createdRequests.push({
        ...sigReq,
        accessToken: rawToken,
        otp: generatedOtp.data,
      });
    }

    await supabase
      .from("documents")
      .update({
        status: "SENT",
        total_signers: signers.length,
      })
      .eq("id", documentId);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "DOCUMENT_SENT",
      entity_type: "document",
      entity_id: documentId,
      metadata: { signers: signers.length },
    });

    return new Response(
      JSON.stringify({ data: createdRequests }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
