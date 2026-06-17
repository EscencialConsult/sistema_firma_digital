/**
 * Audit service — Mock implementation.
 * TODO:SUPABASE — Replace with supabase.from('audit_logs').select('*')
 */

import type { AuditEvent } from "../types/signing";
import { MOCK_AUDIT_EVENTS } from "../mock/data";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

// TODO:SUPABASE — Replace with supabase.from('audit_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
export async function getMyAuditEvents(): Promise<AuditEvent[]> {
  await delay();
  return MOCK_AUDIT_EVENTS;
}

// TODO:SUPABASE — Replace with supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
export async function getAllAuditEvents(): Promise<AuditEvent[]> {
  await delay();
  return MOCK_AUDIT_EVENTS;
}

// TODO:SUPABASE — Replace with supabase.from('audit_logs').select('*').or(`entity_id.eq.${documentId},metadata->>documentId.eq.${documentId}`)
export async function getDocumentAuditEvents(documentId: string): Promise<AuditEvent[]> {
  await delay();
  return MOCK_AUDIT_EVENTS.filter(
    (e) => e.entityId === documentId || (e.metadata as Record<string, unknown>)?.documentId === documentId
  );
}
