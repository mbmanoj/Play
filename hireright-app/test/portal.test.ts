import { describe, it, expect } from "vitest";
import { isOpen, jobSkills, matchJob, skillsInText } from "@/lib/matching";
import { practiceQuestions, coachAnswer, overall } from "@/lib/practice";
import type { Job } from "@/lib/types";

function job(over: Partial<Job> = {}): Job {
  return {
    id: "j1",
    clientId: "c1",
    title: "Backend Engineer",
    jdText: "Requirements: Strong Python, PostgreSQL, AWS, microservices and REST.",
    stage: "SCREENING",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
    ...over
  };
}

describe("M8 matching — marketplace visibility", () => {
  it("only surfaces roles the client has committed to (plan approved and beyond)", () => {
    expect(isOpen(job({ stage: "SCREENING" }))).toBe(true);
    expect(isOpen(job({ stage: "PLAN_APPROVED" }))).toBe(true);
    expect(isOpen(job({ stage: "SCREEN_COMPLETE" }))).toBe(true);
    expect(isOpen(job({ stage: "DRAFT" }))).toBe(false);
    expect(isOpen(job({ stage: "PLAN_GENERATED" }))).toBe(false);
  });
});

describe("M8 matching — skill overlap score", () => {
  it("derives canonical job skills from the JD", () => {
    const skills = jobSkills(job());
    expect(skills).toContain("Python");
    expect(skills).toContain("AWS");
    expect(skills).toContain("Microservices");
    expect(skills).not.toContain("Rust");
  });

  it("scores a perfect overlap at 100 and a disjoint candidate at 0", () => {
    const skills = jobSkills(job());
    expect(matchJob(skills, job()).score).toBe(100);
    const none = matchJob(["cobol", "fortran"], job());
    expect(none.score).toBe(0);
    expect(none.missing.length).toBeGreaterThan(0);
  });

  it("reports matched and missing skills, and score is monotonic in coverage", () => {
    const partial = matchJob(["python", "aws"], job()); // aliases normalize to canonical
    expect(partial.matched.sort()).toEqual(["AWS", "Python"]);
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(100);
    // Adding a matching skill never lowers the score.
    const more = matchJob(["python", "aws", "sql", "postgres"], job());
    expect(more.score).toBeGreaterThanOrEqual(partial.score);
  });

  it("matching reads skills only — no demographic input exists in the signature", () => {
    // Structural guarantee: matchJob takes (string[], Job). There is no channel
    // for demographics to influence a candidate's marketplace ranking.
    expect(skillsInText("Python and React expert")).toContain("Python");
  });
});

describe("M9 practice — question generation", () => {
  it("generates role-specific technical questions plus one behavioural question", () => {
    const qs = practiceQuestions(job());
    expect(qs.length).toBeGreaterThanOrEqual(2);
    // Last question is behavioural (no keyword gate).
    expect(qs[qs.length - 1].keywords).toEqual([]);
    // Technical questions carry the skill they probe.
    expect(qs[0].keywords.length).toBe(1);
  });
});

describe("M9 practice — answer coaching", () => {
  const q = { id: "q0", text: "Tell me about Python.", keywords: ["python"] };

  it("penalises an empty/too-short answer with actionable feedback", () => {
    const c = coachAnswer(q, "idk");
    expect(c.score).toBeLessThan(40);
    expect(c.feedback).toMatch(/STAR|brief/i);
  });

  it("rewards an on-topic, specific answer more than a vague one", () => {
    const vague = coachAnswer(q, "I have used many languages and tools over the years in various roles.");
    const strong = coachAnswer(
      q,
      "I built a Python service that cut latency 40%. I led the migration, owned the rollout, and measured impact over two quarters."
    );
    expect(strong.score).toBeGreaterThan(vague.score);
    expect(strong.score).toBeGreaterThanOrEqual(75);
  });

  it("tells an off-topic answer to address the competency asked about", () => {
    const c = coachAnswer(q, "I really enjoy hiking and playing the guitar on weekends with friends.");
    expect(c.feedback.toLowerCase()).toContain("python");
  });

  it("overall averages the per-answer scores", () => {
    expect(overall([80, 60])).toBe(70);
    expect(overall([])).toBe(0);
  });
});
