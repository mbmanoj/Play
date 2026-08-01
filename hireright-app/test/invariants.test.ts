import { describe, it, expect, beforeEach } from "vitest";
import { signSession, verifySession, canMutate, assertCanMutate, assertRole } from "@/lib/auth";
import { canTransition, ALL_STAGES } from "@/lib/pipeline/state";
import { rankCandidates, scoreInterview, conductInterview } from "@/lib/ai/mock";
import { adverseImpact } from "@/lib/compliance";
import { extOf, isAllowed, extractText, deriveSkills, MAX_FILE_BYTES } from "@/lib/ingestion/parse";
import { user, criterion, plan, candidate } from "./fixtures";
import type { RankingResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────
// These tests lock in the product's non-negotiable compliance & safety
// promises. If a change breaks one of these, it breaks a guarantee we make
// to clients and candidates — the test failing is the point.
// ─────────────────────────────────────────────────────────────────────────

describe("INVARIANT 1 — session integrity (a forged cookie is never trusted)", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-A";
  });

  it("round-trips a valid signed session", () => {
    const signed = signSession("user_123");
    expect(verifySession(signed)).toBe("user_123");
  });

  it("rejects a tampered signature", () => {
    const signed = signSession("user_123");
    const forged = signed.slice(0, -2) + (signed.endsWith("aa") ? "bb" : "aa");
    expect(verifySession(forged)).toBeNull();
  });

  it("rejects a swapped user id under the same signature (no privilege swap)", () => {
    const sig = signSession("user_123").split(".").pop();
    expect(verifySession(`user_999.${sig}`)).toBeNull();
  });

  it("rejects a session signed with a different secret (key rotation invalidates)", () => {
    const signed = signSession("user_123");
    process.env.AUTH_SECRET = "test-secret-B";
    expect(verifySession(signed)).toBeNull();
  });

  it("rejects malformed / empty input", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("no-dot")).toBeNull();
  });
});

describe("INVARIANT 2 — RBAC (read-only roles cannot mutate)", () => {
  it("viewer is read-only; admin & recruiter can mutate", () => {
    expect(canMutate(user("viewer"))).toBe(false);
    expect(canMutate(user("admin"))).toBe(true);
    expect(canMutate(user("recruiter"))).toBe(true);
  });

  it("assertCanMutate throws for a viewer and passes for a recruiter", () => {
    expect(() => assertCanMutate(user("viewer"))).toThrow(/read-only/i);
    expect(() => assertCanMutate(user("recruiter"))).not.toThrow();
  });

  it("assertRole enforces the allow-list", () => {
    expect(() => assertRole(user("viewer"), "admin")).toThrow(/Forbidden/);
    expect(() => assertRole(user("admin"), "admin", "recruiter")).not.toThrow();
  });
});

describe("INVARIANT 3 — pipeline gates (no stage-skipping, no going backward)", () => {
  it("only allows advancing exactly one stage forward", () => {
    expect(canTransition("PLAN_GENERATED", "PLAN_APPROVED")).toBe(true);
    expect(canTransition("PLAN_APPROVED", "SCREENING")).toBe(true);
  });

  it("cannot skip the approval gate (PLAN_GENERATED → SCREENING is blocked)", () => {
    expect(canTransition("PLAN_GENERATED", "SCREENING")).toBe(false);
  });

  it("cannot move backward or self-loop", () => {
    expect(canTransition("SCREENING", "PLAN_APPROVED")).toBe(false);
    expect(canTransition("SCREENING", "SCREENING")).toBe(false);
  });

  it("every adjacent pair in the canonical order is a legal single step", () => {
    for (let i = 0; i < ALL_STAGES.length - 1; i++) {
      expect(canTransition(ALL_STAGES[i], ALL_STAGES[i + 1])).toBe(true);
    }
  });
});

describe("INVARIANT 4 — the AI recommends, it never decides", () => {
  it("interview scoring is always marked non-final", async () => {
    const p = plan([criterion()]);
    const transcript = await conductInterview(p, candidate("a", "Built systems in Python daily."));
    const result = await scoreInterview(p, transcript);
    expect(result.recommendation.isFinal).toBe(false);
    expect(["advance", "hold", "pass"]).toContain(result.recommendation.value);
    expect(result.recommendation.rationale).toMatch(/never decides|pending client approval/i);
  });
});

describe("INVARIANT 5 — knockouts flag, they never auto-reject", () => {
  it("a candidate failing a must-have stays in the ranking, flagged not dropped", async () => {
    const p = plan([criterion({ isKnockout: true, keywords: ["kubernetes"] })]);
    const cands = [
      candidate("weak", "I write essays and poems. No infra experience."),
      candidate("strong", "Ran Kubernetes clusters in production for 4 years.")
    ];
    const ranked = await rankCandidates(p, cands);
    // Both candidates are still present — nothing is silently removed.
    expect(ranked.map((r) => r.candidateId).sort()).toEqual(["strong", "weak"]);
    const weak = ranked.find((r) => r.candidateId === "weak")!;
    expect(weak.knockoutFailures.length).toBeGreaterThan(0);
    // Flagged candidates sort below those who meet the bar.
    expect(ranked[0].candidateId).toBe("strong");
  });
});

describe("INVARIANT 6 — every score is evidence-cited (verbatim from the resume)", () => {
  it("a matched criterion cites a sentence that appears verbatim in the resume", async () => {
    const resume = "Delivered ETL in Python at petabyte scale. Also mentored juniors.";
    const p = plan([criterion({ keywords: ["python"] })]);
    const [r] = await rankCandidates(p, [candidate("a", resume)]);
    const cs = r.criterionScores[0];
    expect(cs.score).toBeGreaterThan(40);
    // The evidence must be a literal substring of the resume — no hallucinated citations.
    expect(resume).toContain(cs.evidence.replace(/\s+$/, ""));
  });

  it("an unmatched criterion is explicit about the absence of evidence", async () => {
    const p = plan([criterion({ keywords: ["rust"] })]);
    const [r] = await rankCandidates(p, [candidate("a", "Only ever used COBOL.")]);
    expect(r.criterionScores[0].evidence).toMatch(/no matching evidence/i);
  });
});

describe("INVARIANT 7 — compliance firewall (scoring never reads demographics)", () => {
  it("ranking is byte-identical with and without demographics attached", async () => {
    const resumeA = "Senior Python engineer, 6 years. Built data platforms.";
    const resumeB = "Frontend developer, mostly React and CSS.";
    const p = plan([criterion({ keywords: ["python"], isKnockout: true })]);

    const plain = [candidate("a", resumeA), candidate("b", resumeB)];
    const withDemo = [
      candidate("a", resumeA, { demographics: { gender: "female", ethnicity: "x", ageBand: "40-49" } as any }),
      candidate("b", resumeB, { demographics: { gender: "male", ethnicity: "y", ageBand: "20-29" } as any })
    ];

    const r1 = await rankCandidates(p, plain);
    const r2 = await rankCandidates(p, withDemo);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe("INVARIANT 8 — adverse-impact monitoring flags the four-fifths rule", () => {
  it("flags a group selected far below the top-rate group", () => {
    // Build a ranking where all 'male' are selected and all 'female' are not.
    const cands = [
      candidate("m1", "", { demographics: { gender: "male" } as any }),
      candidate("m2", "", { demographics: { gender: "male" } as any }),
      candidate("f1", "", { demographics: { gender: "female" } as any }),
      candidate("f2", "", { demographics: { gender: "female" } as any })
    ];
    const ranking: RankingResult = {
      jobId: "job1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      candidates: [
        { candidateId: "m1", knockoutFailures: [] },
        { candidateId: "m2", knockoutFailures: [] },
        { candidateId: "f1", knockoutFailures: [] },
        { candidateId: "f2", knockoutFailures: [] }
      ] as any
    } as any;
    const stats = adverseImpact(cands, ranking, 2); // shortlist size 2 → both males
    const female = stats.find((s) => s.dimension === "Gender" && s.group === "female")!;
    expect(female.selectionRate).toBe(0);
    expect(female.impactRatio).toBeLessThan(0.8);
    expect(female.flagged).toBe(true);
  });
});

describe("INVARIANT 9 — ingestion guards (never ingest garbage or oversized input)", () => {
  it("classifies extensions and allow-list correctly", () => {
    expect(extOf("Resume.PDF")).toBe("pdf");
    expect(isAllowed("cv.docx")).toBe(true);
    expect(isAllowed("malware.exe")).toBe(false);
    expect(isAllowed("noext")).toBe(false);
  });

  it("rejects empty, oversized, and unsupported files", async () => {
    await expect(extractText("a.txt", Buffer.alloc(0))).rejects.toThrow(/empty/i);
    await expect(extractText("a.txt", Buffer.alloc(MAX_FILE_BYTES + 1))).rejects.toThrow(/too large/i);
    await expect(extractText("a.exe", Buffer.from("x".repeat(50)))).rejects.toThrow(/unsupported/i);
  });

  it("rejects a near-empty extraction (e.g. scanned/image PDF)", async () => {
    await expect(extractText("a.txt", Buffer.from("hi"))).rejects.toThrow(/no extractable text/i);
  });

  it("derives only lexicon skills from text", () => {
    const skills = deriveSkills("Strong in Python and PostgreSQL, some React.");
    expect(skills).toContain("python");
    expect(skills).toContain("react");
    expect(skills).not.toContain("cobol");
  });
});
