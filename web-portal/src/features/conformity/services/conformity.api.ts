import { supabase } from "../../../shared/lib/supabase";

export type ConformityRecord = {
  id: string;
  document_id: string;
  document_title: string;
  acceptance_text: string;
  document_hash: string;
  document_version: number;
  ip_address?: string;
  created_at: string;
};

export const conformityApi = {
  async listMine() {
    const { data, error } = await supabase
      .from("acceptance_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ConformityRecord[];
  }
};
