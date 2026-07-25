// ── Core domain types (aligned with hireright-docs/03-build-ready-spec.md) ──

export type Role = "admin" | "recruiter" | "viewer";

export interface ClientUser {
  id: string;
  clientId: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
}

// ── Pipeline state machine ────────────────────────────────────────────
export type JobStage =
  | "DRAFT"
  | "JD_UPLOADED"
  | "PLAN_GENERATED"
  | "PLAN_APPROVED"
  | "SCREENING"
  | "SCREEN_COMPLETE";

export interface Job {
  id: string;
  clientId: string;
  title: string;
  jdText: string;
  stage: JobStage;
  createdAt: string;
  createdBy: string;
}

// ── Closure plan (M2) ─────────────────────────────────────────────────
export interface Criterion {
  id: string;
  label: string;
  weight: number; // 0..1
  isKnockout: boolean;
  kind: "must_have" | "nice_to_have";
  keywords: string[]; // used by the mock ranker to find evidence
}

export interface BlueprintQuestion {
  id: string;
  text: string;
  competencyId: string; // maps to a criterion id
  modelAnswer: string;
  editedByClient: boolean;
}

export interface ClosurePlan {
  planId: string;
  jobId: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  roleSummary: string;
  criteria: Criterion[];
  cutoffType: "top_n" | "score_threshold";
  cutoffValue: number;
  interviewBlueprint: BlueprintQuestion[];
  openQuestions: string[];
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// ── Candidates (M1 ingestion) ─────────────────────────────────────────
// Demographic data is stored on a SEPARATE field and is firewalled from
// all scoring code (see compliance.ts). Never read it in lib/ai/*.
export interface VoluntaryDemographics {
  gender?: "female" | "male" | "nonbinary" | "undisclosed";
  ethnicity?: string;
  ageBand?: "<30" | "30-50" | ">50" | "undisclosed";
}

export interface Candidate {
  id: string;
  clientId: string;
  name: string;
  source: string; // e.g. "folder:resumes", "seed"
  fileName: string;
  resumeText: string;
  skills: string[];
  ingestedAt: string;
  demographics?: VoluntaryDemographics; // firewalled — scoring must not use
}

// ── Ranking result (M3) ───────────────────────────────────────────────
export interface CriterionScore {
  criterionId: string;
  label: string;
  score: number; // 0..100
  evidence: string; // VERBATIM quote from resume
}

export interface RankedCandidate {
  candidateId: string;
  name: string;
  rank: number;
  overallScore: number;
  confidence: "high" | "medium" | "low";
  criterionScores: CriterionScore[];
  knockoutFailures: string[];
  gaps: string[];
  summary: string;
}

export interface RankingResult {
  runId: string;
  jobId: string;
  planVersion: number;
  candidates: RankedCandidate[];
  createdAt: string;
}

// ── Compliance audit log (M-Compliance) ───────────────────────────────
export interface AuditEvent {
  eventId: string;
  timestamp: string;
  actorType: "ai" | "client_user" | "system";
  actorId: string;
  action: string; // e.g. "plan.generated", "gate.plan_approved"
  entityType: string;
  entityId: string;
  rationale?: string;
}

// ── Persisted DB shape ────────────────────────────────────────────────
export interface DB {
  clients: Client[];
  users: ClientUser[];
  jobs: Job[];
  plans: ClosurePlan[];
  candidates: Candidate[];
  rankings: RankingResult[];
  audit: AuditEvent[];
}
