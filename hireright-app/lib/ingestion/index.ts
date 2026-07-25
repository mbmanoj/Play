// ── Ingestion connector framework (M1) ────────────────────────────────
// Pluggable adapters behind one interface. Folder ingestion is LIVE;
// ATS and LinkedIn are scaffolded as "coming soon" until built/credentialed.

export interface Connector {
  id: string;
  name: string;
  status: "live" | "coming_soon";
  description: string;
  requiresCredential?: string; // env var name
}

export const CONNECTORS: Connector[] = [
  {
    id: "folder",
    name: "Folder / File upload",
    status: "live",
    description:
      "Upload a folder of resumes (PDF, DOCX, TXT, MD). Parsed into structured candidate profiles."
  },
  {
    id: "greenhouse",
    name: "Greenhouse ATS",
    status: "coming_soon",
    description: "Pull candidates via the Greenhouse Harvest API.",
    requiresCredential: "GREENHOUSE_API_KEY"
  },
  {
    id: "lever",
    name: "Lever ATS",
    status: "coming_soon",
    description: "Pull opportunities & candidates via the Lever REST API.",
    requiresCredential: "LEVER_API_KEY"
  },
  {
    id: "ashby",
    name: "Ashby ATS",
    status: "coming_soon",
    description: "Pull candidates via the Ashby API.",
    requiresCredential: "ASHBY_API_KEY"
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    status: "coming_soon",
    description:
      "No direct API — requires LinkedIn partner approval (Recruiter System Connect) or a 3rd-party aggregator (ToS/legal review needed).",
    requiresCredential: "LINKEDIN_AGGREGATOR_API_KEY"
  }
];

export function connectorEnabled(c: Connector): boolean {
  if (c.status === "live") return true;
  if (c.requiresCredential) return Boolean(process.env[c.requiresCredential]);
  return false;
}
