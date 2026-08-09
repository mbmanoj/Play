import { getRepo } from "./db/repo";
import { AuditEvent } from "./types";
import { uid, nowISO } from "./ids";

// Append-only audit log. Never updated or deleted (invariant #7).
export async function logAudit(e: Omit<AuditEvent, "eventId" | "timestamp">): Promise<void> {
  await getRepo().appendAudit({ ...e, eventId: uid("evt"), timestamp: nowISO() });
}
