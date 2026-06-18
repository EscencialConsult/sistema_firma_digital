import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(buffer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const templateId = formData.get("templateId") as string | null;

    if (!file || !title) {
      return new Response(JSON.stringify({ error: "file y title son requeridos" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "El archivo excede el límite de 50MB" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return new Response(JSON.stringify({ error: "Solo se permiten archivos PDF" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    try {
      await PDFDocument.load(fileBuffer);
    } catch {
      return new Response(JSON.stringify({ error: "El archivo no es un PDF válido o está corrupto" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const fileHash = await sha256(fileBuffer);
    const documentId = crypto.randomUUID();
    const storagePath = `contracts/${user.id}/${documentId}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("contract-pdfs")
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Error subiendo a Storage: ${uploadError.message}` }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let templateFields = null;
    const rawFields = formData.get("templateFields");
    if (rawFields) {
      try {
        templateFields = JSON.parse(rawFields as string);
      } catch {
        templateFields = {};
      }
    }

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        title,
        description,
        template_id: templateId,
        template_fields: templateFields,
        status: "DRAFT",
        owner_id: user.id,
        total_signers: 0,
      })
      .select()
      .single();

    if (docError) {
      return new Response(JSON.stringify({ error: `Error creando documento: ${docError.message}` }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: version, error: verError } = await supabase
      .from("document_versions")
      .insert({
        document_id: documentId,
        version_number: 1,
        file_name: file.name,
        storage_path: storagePath,
        sha256_hash: fileHash,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (verError) {
      return new Response(JSON.stringify({ error: `Error creando versión: ${verError.message}` }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("documents")
      .update({ current_version_id: version.id })
      .eq("id", documentId);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "DOCUMENT_UPLOADED",
      entity_type: "document",
      entity_id: documentId,
      document_hash: fileHash,
    });

    return new Response(
      JSON.stringify({
        data: {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          status: doc.status,
          currentVersion: {
            id: version.id,
            versionNumber: version.version_number,
            fileName: version.file_name,
            sha256Hash: version.sha256_hash,
            fileSize: version.file_size,
          },
        },
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
