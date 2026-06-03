export function statusLabel(status: string) {
  return status.split("_").join(" ").toLowerCase();
}

export function statusTone(status: string) {
  if (["COMPLETED", "SIGNED", "VERIFIED", "ACTIVE"].includes(status)) return "success";
  if (["REJECTED", "EXPIRED", "CANCELLED", "REVOKED"].includes(status)) return "danger";
  if (["SENT", "VIEWED", "PARTIALLY_SIGNED", "IN_REVIEW", "PENDING"].includes(status)) return "warning";
  return "neutral";
}
