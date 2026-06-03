import { createAuditLog, listAuditLogsByDocument, listAuditLogsForUser, listRecentAuditLogs } from "./repository.js";
import type { AuditLogInput } from "./types.js";

export const auditService = {
  record(input: AuditLogInput) {
    return createAuditLog(input);
  },
  listForDocument(documentId: string) {
    return listAuditLogsByDocument(documentId);
  },
  listMine(userId: string) {
    return listAuditLogsForUser(userId);
  },
  listRecent() {
    return listRecentAuditLogs();
  }
};
