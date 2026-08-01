import { Candidate, ClientUser, ClosurePlan, Criterion, Role } from "@/lib/types";

// Minimal, valid domain fixtures for invariant tests.

export function user(role: Role, over: Partial<ClientUser> = {}): ClientUser {
  return { id: "u1", clientId: "c1", name: "T", email: "t@x.co", role, ...over };
}

export function criterion(over: Partial<Criterion> = {}): Criterion {
  return {
    id: "crit1",
    label: "Experience with python",
    weight: 1,
    isKnockout: false,
    kind: "must_have",
    keywords: ["python"],
    ...over
  };
}

export function plan(criteria: Criterion[], over: Partial<ClosurePlan> = {}): ClosurePlan {
  return {
    planId: "plan1",
    jobId: "job1",
    version: 1,
    status: "approved",
    roleSummary: "test",
    criteria,
    cutoffType: "top_n",
    cutoffValue: 5,
    interviewBlueprint: criteria.map((c, i) => ({
      id: `q${i}`,
      text: `About ${c.label}?`,
      competencyId: c.id,
      modelAnswer: "cites a concrete project",
      editedByClient: false
    })),
    openQuestions: [],
    approvedBy: "u1",
    approvedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over
  };
}

export function candidate(id: string, resumeText: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id,
    clientId: "c1",
    name: id,
    source: "test",
    fileName: `${id}.txt`,
    resumeText,
    skills: [],
    ingestedAt: "2026-01-01T00:00:00.000Z",
    ...over
  };
}
