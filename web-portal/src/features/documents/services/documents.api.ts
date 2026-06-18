import { supabase } from "../../../shared/lib/supabase";

export type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  created_at: string;
  sha256_hash?: string;
  file_name?: string;
  signers?: number;
};

export type Pkcs11Certificate = {
  id: string;
  label?: string;
};

export type Pkcs11Token = {
  modulePath: string;
  moduleName: string;
  slot?: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  certificates: Pkcs11Certificate[];
  error?: string;
};

const AGENT_BASE = import.meta.env.VITE_AGENT_BASE_URL || "http://127.0.0.1:4001";

export const documentsApi = {
  async list() {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as DocumentRecord[];
  },
  async get(id: string) {
    const { data, error } = await supabase
      .from("documents")
      .select("*, signature_requests(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as DocumentRecord & { signature_requests?: any[] };
  },
  async upload(input: { title: string; file: File }) {
    const { data, error } = await supabase.functions.invoke("upload-document", {
      body: input.file,
      headers: { "x-document-title": input.title },
    });
    if (error) throw error;
    return data as DocumentRecord;
  },
  async remove(id: string) {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
    return { deleted: true };
  },
  async sendDocument(id: string, payload: { signers: Array<{ email: string; name?: string; signingOrder?: number }>; expiresInDays: number }) {
    const { data, error } = await supabase.functions.invoke("send-document", {
      body: { documentId: id, ...payload },
    });
    if (error) throw error;
    return data;
  },
  async detectPkcs11Tokens(pin?: string) {
    const query = pin ? `?pin=${encodeURIComponent(pin)}` : "";
    const response = await fetch(`${AGENT_BASE}/api/agent/pkcs11/tokens${query}`);
    if (!response.ok) throw new Error("Agent error");
    return response.json();
  },
  async signWithPkcs11(id: string, payload: { pin: string; certId?: string; modulePath?: string; slot?: string; metadata?: Record<string, unknown> }) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${AGENT_BASE}/api/agent/pkcs11/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ documentId: id, ...payload }),
    });
    if (!response.ok) throw new Error("Agent sign error");
    return response.json();
  }
};
