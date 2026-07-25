import { write } from "./db";
import { AuditEvent } from "./types";
import { uid, nowISO } from "./ids";

// Append-only audit log. Never updated or deleted (invariant #7).
export function logAudit(e: Omit<AuditEvent, "eventId" | "timestamp">): void {
  write((db) => {
    db.audit.push({ ...e, eventId: uid("evt"), timestamp: nowISO() });
  });
}
