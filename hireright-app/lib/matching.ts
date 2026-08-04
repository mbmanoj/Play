import { Job, JobStage } from "./types";

// ── Candidate ↔ job matching (M8) ─────────────────────────────────────
// Pure, deterministic skill-overlap matching for the candidate marketplace.
// Mirrors the employer-side lexicon so both sides speak the same language.
// This reads ONLY skills/JD text — never demographics (compliance firewall).

const SKILL_LEXICON = [
  "python", "java", "typescript", "javascript", "react", "node", "sql",
  "postgres", "postgresql", "aws", "gcp", "kubernetes", "docker", "go",
  "rust", "machine learning", "llm", "nlp", "data", "fastapi", "django",
  "graphql", "terraform", "ci/cd", "rest", "microservices", "etl", "pytorch"
];

// A job is visible in the candidate marketplace once the client has
// committed to hiring for it (plan approved and beyond).
const OPEN_STAGES: JobStage[] = ["PLAN_APPROVED", "SCREENING", "SCREEN_COMPLETE"];

export function isOpen(job: Job): boolean {
  return OPEN_STAGES.includes(job.stage);
}

export function skillsInText(text: string): string[] {
  const low = text.toLowerCase();
  return SKILL_LEXICON.filter((s) => low.includes(s));
}

export function jobSkills(job: Job): string[] {
  return skillsInText(job.jdText);
}

export interface JobMatch {
  matched: string[];
  missing: string[];
  score: number; // 0..100 — share of the job's skills the candidate evidences
}

export function matchJob(candidateSkills: string[], job: Job): JobMatch {
  const want = jobSkills(job);
  const have = new Set(candidateSkills.map((s) => s.toLowerCase()));
  const matched = want.filter((s) => have.has(s));
  const missing = want.filter((s) => !have.has(s));
  const score = want.length ? Math.round((matched.length / want.length) * 100) : 0;
  return { matched, missing, score };
}
