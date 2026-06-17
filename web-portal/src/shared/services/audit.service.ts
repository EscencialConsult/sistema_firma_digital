import { supabase } from "../lib/supabase";
import type { AuditEvent } from "../types/signing";

function mapRowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id:           row.id as string,
    action:       row.action as string,
    entityType:   row.entity_type as string,
    entityId:     (row.entity_id as string) ?? null,
    documentHash: (row.document_hash as string) ?? null,
    ipAddress:    (row.ip_address as string) ?? null,
    userAgent:    (row.user_agent as string) ?? null,
    metadata:     (row.metadata as Record<string, unknown>) ?? {},
    createdAt:    row.created_at as string,
  };
}

/** Audit events for the currently authenticated user */
export async function getMyAuditEvents(): Promise<AuditEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}

/** All audit events — admin only (RLS enforces this) */
export async function getAllAuditEvents(): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}

/** Audit events related to a specific document */
export async function getDocumentAuditEvents(documentId: string): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .or(`entity_id.eq.${documentId},metadata->>documentId.eq.${documentId}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}
