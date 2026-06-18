import { supabase } from "../../../shared/lib/supabase";

export type CertificateRecord = {
  id: string;
  label: string;
  type: string;
  issuer?: string;
  subject?: string;
  serial_number?: string;
  fingerprint_sha256?: string;
  status: string;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type CreateCertificateInput = {
  label: string;
  type: "P12" | "PFX";
  password: string;
};

const CERT_BUCKET = "certificates";

export const certificatesApi = {
  async list() {
    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as CertificateRecord[];
  },
  async create(input: CreateCertificateInput) {
    const { data, error } = await supabase.functions.invoke("generate-certificate", {
      body: input,
    });
    if (error) throw error;
    return data as CertificateRecord;
  },
  async updateStatus(id: string, status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "REVOKED") {
    const { error } = await supabase
      .from("certificates")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },
  async download(id: string, filename: string) {
    const { data: cert, error: certError } = await supabase
      .from("certificates")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (certError || !cert?.storage_path) throw new Error("Certificate not found or no storage path");

    const { data: signedData, error: signedError } = await supabase.storage
      .from(CERT_BUCKET)
      .createSignedUrl(cert.storage_path, 60);
    if (signedError || !signedData?.signedUrl) throw new Error("Failed to generate download URL");

    const anchor = document.createElement("a");
    anchor.href = signedData.signedUrl;
    anchor.download = filename;
    anchor.click();
  }
};
