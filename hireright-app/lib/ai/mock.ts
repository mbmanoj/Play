import {
  Job,
  ClosurePlan,
  Candidate,
  RankedCandidate,
  Criterion,
  CriterionScore,
  BlueprintQuestion,
  TranscriptTurn,
  CompetencyScore
} from "../types";
import { uid, nowISO } from "../ids";

// ── Mocked AI ─────────────────────────────────────────────────────────
// Deterministic stand-in for an LLM. It does genuine keyword/skill matching
// and extracts VERBATIM evidence sentences from resumes, so the demo behaves
// like the real thing. Swap point / fallback for the real Claude adapter.
//
// IMPORTANT: scoring reads ONLY resumeText/skills. It must never read
// candidate.demographics (compliance firewall).

const SKILL_LEXICON = [
  "python", "java", "typescript", "javascript", "react", "node", "sql",
  "postgres", "postgresql", "aws", "gcp", "kubernetes", "docker", "go",
  "rust", "machine learning", "llm", "nlp", "data", "fastapi", "django",
  "graphql", "terraform", "ci/cd", "rest", "microservices", "mentor",
  "leadership", "team", "etl", "pytorch"
];

// ── Plan generation (M2) ──────────────────────────────────────────────
export async function generatePlan(job: Job): Promise<ClosurePlan> {
  const lines = job.jdText.split("\n").map((l) => l.trim());
  const mustHaves: Criterion[] = [];
  const niceToHaves: Criterion[] = [];

  let section: "must" | "nice" | null = null;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.includes("must have") || low.startsWith("requirements")) {
      section = "must";
      continue;
    }
    if (low.includes("nice to have") || low.includes("preferred") || low.includes("bonus")) {
      section = "nice";
      continue;
    }
    const bullet = line.replace(/^[-*•]\s*/, "");
    if (!line.startsWith("-") && !line.startsWith("*") && !line.startsWith("•")) continue;
    if (!bullet) continue;

    const crit: Criterion = {
      id: uid("crit"),
      label: bullet,
      weight: 0,
      isKnockout: section === "must",
      kind: section === "nice" ? "nice_to_have" : "must_have",
      keywords: deriveKeywords(bullet)
    };
    (section === "nice" ? niceToHaves : mustHaves).push(crit);
  }

  if (mustHaves.length === 0 && niceToHaves.length === 0) {
    const hits = SKILL_LEXICON.filter((s) => job.jdText.toLowerCase().includes(s));
    hits.slice(0, 5).forEach((h) =>
      mustHaves.push({
        id: uid("crit"),
        label: `Experience with ${h}`,
        weight: 0,
        isKnockout: false,
        kind: "must_have",
        keywords: [h]
      })
    );
  }

  assignWeights(mustHaves, 0.7);
  assignWeights(niceToHaves, 0.3);
  const criteria = [...mustHaves, ...niceToHaves];

  const interviewBlueprint: BlueprintQuestion[] = criteria.slice(0, 6).map((c) => ({
    id: uid("q"),
    competencyId: c.id,
    text: `Tell me about your hands-on experience with ${stripExp(c.label)}. Walk me through a specific project.`,
    modelAnswer: `Strong answer cites a concrete project demonstrating ${stripExp(
      c.label
    )}, with measurable impact and the candidate's specific role.`,
    editedByClient: false
  }));

  const openQuestions: string[] = [];
  if (!job.jdText.toLowerCase().includes("salary") && !job.jdText.toLowerCase().includes("comp"))
    openQuestions.push("What is the salary band for this role?");
  if (!job.jdText.toLowerCase().includes("remote") && !job.jdText.toLowerCase().includes("onsite"))
    openQuestions.push("Is this role remote, hybrid, or onsite?");
  openQuestions.push("How many candidates should the shortlist contain?");

  return {
    planId: uid("plan"),
    jobId: job.id,
    version: 1,
    status: "draft",
    roleSummary: `AI-drafted plan for "${job.title}". ${mustHaves.length} must-have and ${niceToHaves.length} nice-to-have criteria detected from the job description. Review, edit, and approve to begin screening.`,
    criteria,
    cutoffType: "top_n",
    cutoffValue: 5,
    interviewBlueprint,
    openQuestions,
    approvedBy: null,
    approvedAt: null,
    createdAt: nowISO()
  };
}

// ── Candidate ranking (M3) ────────────────────────────────────────────
export async function rankCandidates(
  plan: ClosurePlan,
  candidates: Candidate[]
): Promise<RankedCandidate[]> {
  const ranked: RankedCandidate[] = candidates.map((c) => {
    const criterionScores: CriterionScore[] = [];
    const knockoutFailures: string[] = [];
    const gaps: string[] = [];
    let weighted = 0;

    for (const crit of plan.criteria) {
      const { score, evidence } = scoreCriterion(crit, c.resumeText);
      criterionScores.push({ criterionId: crit.id, label: crit.label, score, evidence });
      weighted += (score / 100) * crit.weight;
      if (score < 40) {
        gaps.push(crit.label);
        if (crit.isKnockout) knockoutFailures.push(crit.label);
      }
    }

    const overallScore = Math.round(weighted * 100);
    const confidence = confidenceFor(c.resumeText, criterionScores);
    const summary = summarize(c.name, overallScore, knockoutFailures, criterionScores);

    return {
      candidateId: c.id,
      name: c.name,
      rank: 0,
      overallScore,
      confidence,
      criterionScores,
      knockoutFailures,
      gaps,
      summary
    };
  });

  ranked.sort((a, b) => {
    if (a.knockoutFailures.length !== b.knockoutFailures.length)
      return a.knockoutFailures.length - b.knockoutFailures.length;
    return b.overallScore - a.overallScore;
  });
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}

// ── Interview (M5) ────────────────────────────────────────────────────
export async function conductInterview(
  plan: ClosurePlan,
  candidate: Candidate
): Promise<TranscriptTurn[]> {
  return plan.interviewBlueprint.map((q) => {
    const crit = plan.criteria.find((c) => c.id === q.competencyId);
    const kws = crit?.keywords || [];
    const sentence = findSentence(candidate.resumeText, kws);
    const answer = sentence
      ? `Yes — this was central to my recent work. ${sentence} I owned it end-to-end and can speak to the measurable impact and trade-offs involved.`
      : `I have some exposure here and I'm keen to grow it, though it wasn't a core part of my most recent role. I'd approach it by starting from fundamentals and pairing with the team.`;
    return { questionId: q.id, question: q.text, answer };
  });
}

// ── Interview scoring (M6) ────────────────────────────────────────────
export async function scoreInterview(
  plan: ClosurePlan,
  transcript: TranscriptTurn[]
): Promise<{
  competencyScores: CompetencyScore[];
  overallScore: number;
  recommendation: { value: "advance" | "hold" | "pass"; rationale: string; isFinal: false };
}> {
  const byQ = new Map(plan.interviewBlueprint.map((q) => [q.id, q]));
  const competencyScores: CompetencyScore[] = transcript.map((t) => {
    const q = byQ.get(t.questionId);
    const crit = plan.criteria.find((c) => c.id === q?.competencyId);
    const kws = crit?.keywords || [];
    const hit = findSentence(t.answer, kws);
    const score = hit ? 88 : 45;
    return {
      competencyId: crit?.id || t.questionId,
      label: crit?.label || q?.text || "Competency",
      score,
      evidence: hit || t.answer.slice(0, 140)
    };
  });

  // weight by criterion weight where available, else equal
  let weighted = 0;
  let wsum = 0;
  for (const cs of competencyScores) {
    const w = plan.criteria.find((c) => c.id === cs.competencyId)?.weight ?? 1 / competencyScores.length;
    weighted += (cs.score / 100) * w;
    wsum += w;
  }
  const overallScore = Math.round((wsum ? weighted / wsum : 0) * 100);
  const value = overallScore >= 70 ? "advance" : overallScore >= 50 ? "hold" : "pass";
  return {
    competencyScores,
    overallScore,
    recommendation: {
      value,
      rationale: `Interview scored ${overallScore}/100 across ${competencyScores.length} competencies. This is a recommendation pending client approval — the AI never decides.`,
      isFinal: false
    }
  };
}

function findSentence(text: string, keywords: string[]): string | null {
  const sentences = text.split(/(?<=[.\n])/).map((s) => s.trim()).filter(Boolean);
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    const hit = sentences.find((s) => s.toLowerCase().includes(k));
    if (hit) return hit;
  }
  return null;
}

// ── helpers ───────────────────────────────────────────────────────────
function deriveKeywords(label: string): string[] {
  const low = label.toLowerCase();
  const hits = SKILL_LEXICON.filter((s) => low.includes(s));
  if (hits.length) return Array.from(new Set(hits));
  return low
    .replace(/[^a-z0-9+ /]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .slice(0, 3);
}

const STOP = new Set([
  "with", "years", "experience", "strong", "design", "have", "must",
  "nice", "and", "the", "for", "team", "work", "cloud"
]);

function assignWeights(crits: Criterion[], total: number) {
  if (crits.length === 0) return;
  const each = total / crits.length;
  crits.forEach((c) => (c.weight = Math.round(each * 1000) / 1000));
}

function scoreCriterion(crit: Criterion, resume: string): { score: number; evidence: string } {
  const sentences = resume.split(/(?<=[.\n])/).map((s) => s.trim()).filter(Boolean);
  for (const kw of crit.keywords) {
    const k = kw.toLowerCase();
    const hit = sentences.find((s) => s.toLowerCase().includes(k));
    if (hit) {
      const score = scoreWithYears(crit.label, hit);
      return { score, evidence: hit };
    }
  }
  return { score: 15, evidence: "No matching evidence found in resume." };
}

function scoreWithYears(label: string, sentence: string): number {
  const need = /(\d+)\+?\s*years?/i.exec(label);
  const have = /(\d+)\+?\s*years?/i.exec(sentence);
  if (need && have) {
    return Number(have[1]) >= Number(need[1]) ? 95 : 55;
  }
  return 85;
}

function confidenceFor(resume: string, scores: CriterionScore[]): "high" | "medium" | "low" {
  const covered = scores.filter((s) => s.score >= 40).length / Math.max(scores.length, 1);
  if (resume.length < 150) return "low";
  if (covered >= 0.7) return "high";
  if (covered >= 0.4) return "medium";
  return "low";
}

function summarize(
  name: string,
  overall: number,
  knockouts: string[],
  scores: CriterionScore[]
): string {
  const strengths = scores
    .filter((s) => s.score >= 85)
    .map((s) => stripExp(s.label))
    .slice(0, 2);
  if (knockouts.length) {
    return `${name} scores ${overall}/100 but does not meet ${knockouts.length} must-have requirement(s): ${knockouts
      .map(stripExp)
      .join(", ")}. Flagged, not auto-rejected — client decides.`;
  }
  return `${name} scores ${overall}/100${
    strengths.length ? `, with strong evidence for ${strengths.join(" and ")}` : ""
  }. Meets all must-have requirements.`;
}

function stripExp(label: string): string {
  return label.replace(/^(\d+\+?\s*years?\s*)/i, "").replace(/\(.*?\)/g, "").trim();
}
