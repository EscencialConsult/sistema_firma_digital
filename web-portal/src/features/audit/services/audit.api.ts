import { supabase } from "../../../shared/lib/supabase";

export type AuditRecord = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
};

export const auditApi = {
  async mine() {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as AuditRecord[];
  }
};
