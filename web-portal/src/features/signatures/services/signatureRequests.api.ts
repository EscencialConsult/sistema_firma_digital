import { supabase } from "../../../shared/lib/supabase";

export type SignatureRequestRecord = {
  id: string;
  document_id: string;
  document_title: string;
  signer_email: string;
  signer_name?: string;
  status: string;
  sent_at: string;
  expires_at: string;
};

export const signatureRequestsApi = {
  async listMine() {
    const { data, error } = await supabase
      .from("signature_requests")
      .select("*")
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return data as SignatureRequestRecord[];
  }
};
