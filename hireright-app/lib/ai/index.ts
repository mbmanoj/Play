import {
  Job,
  ClosurePlan,
  Candidate,
  RankedCandidate,
  TranscriptTurn,
  CompetencyScore
} from "../types";
import * as mock from "./mock";
import * as anthropic from "./anthropic";

// ── AI provider interface (swap point) ────────────────────────────────
// Default is the deterministic mock. Set AI_PROVIDER=anthropic (+ an
// ANTHROPIC_API_KEY in .env.local) to use real Claude calls; the mock
// remains an automatic per-call fallback inside the anthropic adapter.

export interface ScoreResult {
  competencyScores: CompetencyScore[];
  overallScore: number;
  recommendation: { value: "advance" | "hold" | "pass"; rationale: string; isFinal: false };
}

export interface AIProvider {
  generatePlan(job: Job): Promise<ClosurePlan>;
  // Extract the concrete skills/technologies from free text (JD or résumé),
  // normalized to the canonical taxonomy. LLM-owned; deterministic fallback.
  extractSkills(text: string): Promise<string[]>;
  rankCandidates(plan: ClosurePlan, candidates: Candidate[]): Promise<RankedCandidate[]>;
  // M5: conduct an async (email-style) first-round interview → transcript.
  conductInterview(plan: ClosurePlan, candidate: Candidate): Promise<TranscriptTurn[]>;
  // M6: score a completed interview transcript against the plan.
  scoreInterview(plan: ClosurePlan, transcript: TranscriptTurn[]): Promise<ScoreResult>;
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
  return useAnthropic() ? (anthropic as AIProvider) : (mock as AIProvider);
}

export const ACTIVE_PROVIDER = (): "anthropic" | "mock" => (useAnthropic() ? "anthropic" : "mock");
