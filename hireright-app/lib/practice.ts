import { Job } from "./types";
import { jobSkills } from "./matching";

// ── Mock interview coaching (M9) ──────────────────────────────────────
// Deterministic practice-question generation + answer coaching. PRIVATE to
// the candidate — this never touches a real screening decision. Kept as pure
// functions (swap for an LLM later) so the coaching logic is unit-testable.

export interface PracticeQuestion {
  id: string;
  text: string;
  keywords: string[]; // what a strong answer should evidence
}

export function practiceQuestions(job: Job): PracticeQuestion[] {
  const skills = jobSkills(job);
  const base = skills.slice(0, 4).map((s, i) => ({
    id: `pq${i}`,
    text: `Tell me about a specific project where you used ${s}. What was your role and the measurable impact?`,
    keywords: [s]
  }));
  // Always include one behavioural question so practice isn't purely technical.
  base.push({
    id: `pq${base.length}`,
    text: "Describe a time you had to make a difficult trade-off under a deadline. How did you decide?",
    keywords: []
  });
  return base;
}

const SPECIFIC = /\b(\d+%?|years?|team|led|built|shipped|reduced|increased|project|migrat)/i;

export interface Coaching {
  score: number; // 0..100
  feedback: string;
}

// Coaches a single answer. Rewards (a) addressing the competency asked about
// and (b) concrete specifics (numbers, ownership verbs) over vague claims.
export function coachAnswer(question: PracticeQuestion, answer: string): Coaching {
  const text = answer.trim();
  const words = text ? text.split(/\s+/).length : 0;

  if (words < 8) {
    return {
      score: 20,
      feedback:
        "Too brief to evaluate. Aim for 3–5 sentences using the STAR shape — Situation, Task, Action, Result — with a concrete outcome."
    };
  }

  const low = text.toLowerCase();
  const onTopic = question.keywords.length === 0 || question.keywords.some((k) => low.includes(k.toLowerCase()));
  const specific = SPECIFIC.test(text);

  let score = 55;
  if (onTopic) score += 20;
  if (specific) score += 20;
  if (words >= 40) score += 5;
  score = Math.min(score, 100);

  const notes: string[] = [];
  if (!onTopic && question.keywords.length)
    notes.push(`mention ${question.keywords[0]} directly — the interviewer is probing that skill`);
  if (!specific) notes.push("add a concrete metric or outcome (e.g. “cut latency 40%”) so the claim lands");
  if (words < 40) notes.push("expand slightly — one more sentence on the result would strengthen it");

  const feedback = notes.length
    ? `Solid start. To level up: ${notes.join("; ")}.`
    : "Strong answer — on-topic, specific, and well-scoped. This would land well in a real interview.";
  return { score, feedback };
}

export function overall(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
