import { Job, ClosurePlan, Candidate, RankedCandidate } from "../types";
import * as mock from "./mock";
import * as anthropic from "./anthropic";

// ── AI provider interface (swap point) ────────────────────────────────
// Default is the deterministic mock. Set AI_PROVIDER=anthropic (+ an
// ANTHROPIC_API_KEY in .env.local) to use real Claude calls; the mock
// remains an automatic per-call fallback inside the anthropic adapter.

export interface AIProvider {
  generatePlan(job: Job): Promise<ClosurePlan>;
  rankCandidates(plan: ClosurePlan, candidates: Candidate[]): Promise<RankedCandidate[]>;
}

export const AI_PROVIDER = process.env.AI_PROVIDER || "mock";

function useAnthropic(): boolean {
  if (AI_PROVIDER !== "anthropic") return false;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[ai] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set — using mock.");
    return false;
  }
  return true;
}

export function getAI(): AIProvider {
  return useAnthropic() ? anthropic : mock;
}

// The active provider label for display in the UI (Integrations page).
export const ACTIVE_PROVIDER = (): "anthropic" | "mock" => (useAnthropic() ? "anthropic" : "mock");
