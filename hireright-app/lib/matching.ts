import { Job, JobStage } from "./types";
import { extractSkillsFromText, normalizeSkills } from "./skills";

// ── Candidate ↔ job matching (M8) ─────────────────────────────────────
// Skill-overlap matching for the candidate marketplace. Both sides use the
// canonical skill vocabulary from lib/skills, so employer job skills and
// candidate skills line up (k8s === Kubernetes). Reads ONLY skills / JD text —
// never demographics (compliance firewall).

// A job is visible in the candidate marketplace once the client has
// committed to hiring for it (plan approved and beyond).
const OPEN_STAGES: JobStage[] = ["PLAN_APPROVED", "SCREENING", "SCREEN_COMPLETE"];

export function isOpen(job: Job): boolean {
  return OPEN_STAGES.includes(job.stage);
}

// Back-compat shim (used by a couple of call sites/tests): deterministic,
// word-boundary skill detection. Prefer the AI provider's extractSkills().
export function skillsInText(text: string): string[] {
  return extractSkillsFromText(text);
}

// A job's canonical skills: the LLM-extracted set stored on the job when it
// was created; falls back to deterministic extraction for older/plan-less jobs.
export function jobSkills(job: Job): string[] {
  return job.skills && job.skills.length ? normalizeSkills(job.skills) : extractSkillsFromText(job.jdText);
}

export interface JobMatch {
  matched: string[];
  missing: string[];
  score: number; // 0..100 — share of the job's skills the candidate evidences
}

export function matchJob(candidateSkills: string[], job: Job): JobMatch {
  const want = jobSkills(job);
  const have = new Set(normalizeSkills(candidateSkills).map((s) => s.toLowerCase()));
  const matched = want.filter((s) => have.has(s.toLowerCase()));
  const missing = want.filter((s) => !have.has(s.toLowerCase()));
  const score = want.length ? Math.round((matched.length / want.length) * 100) : 0;
  return { matched, missing, score };
}
