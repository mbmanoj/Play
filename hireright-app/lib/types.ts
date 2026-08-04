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

// ── Interviews (M4 outreach → M5 interview) ───────────────────────────
export type InterviewStatus = "invited" | "completed";

export interface TranscriptTurn {
  questionId: string;
  question: string;
  answer: string;
}

export interface Interview {
  id: string;
  clientId: string;
  jobId: string;
  candidateId: string;
  status: InterviewStatus;
  channel: "email";
  transcript: TranscriptTurn[];
  createdAt: string;
  completedAt: string | null;
}

// ── Scorecard (M6) ────────────────────────────────────────────────────
export interface CompetencyScore {
  competencyId: string;
  label: string;
  score: number; // 0..100
  evidence: string; // VERBATIM quote from the candidate's answer
}

export interface Scorecard {
  id: string;
  interviewId: string;
  candidateId: string;
  jobId: string;
  competencyScores: CompetencyScore[];
  overallScore: number;
  recommendation: { value: "advance" | "hold" | "pass"; rationale: string; isFinal: false };
  createdAt: string;
}

// ── Client actions (M7) + mocked outbox (M4/M7) ───────────────────────
export type ActionType = "send_email" | "schedule_meeting";

export interface ClientAction {
  id: string;
  clientId: string;
  jobId: string;
  candidateId: string;
  type: ActionType;
  detail: string;
  triggeredBy: string; // client_user id — NEVER the AI
  triggeredAt: string;
}

export interface OutboxMessage {
  id: string;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  kind: "invite" | "action";
  createdAt: string;
}

// ── Compliance audit log (M-Compliance) ───────────────────────────────
export interface AuditEvent {
  eventId: string;
  timestamp: string;
  actorType: "ai" | "client_user" | "system" | "candidate";
  actorId: string;
  action: string; // e.g. "plan.generated", "gate.plan_approved"
  entityType: string;
  entityId: string;
  rationale?: string;
}

// ── Candidate portal (M8) + mock interview (M9) ───────────────────────
// A CandidateUser is a self-registered job-seeker — a DIFFERENT persona
// from ClientUser (employer) and from Candidate (a client's applicant
// record). Candidates own their data; it is never client-scoped.
export interface CandidateUser {
  id: string;
  name: string;
  email: string;
  resumeText: string;
  skills: string[];
  createdAt: string;
}

// A candidate applying to a job links their portal identity to an
// employer-side Candidate record (created on apply, so they enter that
// client's screening pipeline). Live status is DERIVED from the employer
// pipeline — never stored mutably here — so the two sides can't disagree.
export interface Application {
  id: string;
  candidateUserId: string;
  jobId: string;
  clientId: string;
  candidateId: string; // the employer-side Candidate created on apply
  createdAt: string;
}

// M9 mock interview — coaching practice, PRIVATE to the candidate. Never
// visible to any employer and never part of a real screening decision.
export interface MockTurn {
  question: string;
  answer: string;
  score: number; // 0..100
  feedback: string;
}
export interface MockInterview {
  id: string;
  candidateUserId: string;
  jobId: string;
  jobTitle: string;
  turns: MockTurn[];
  overallScore: number;
  createdAt: string;
}

// ── Persisted DB shape ────────────────────────────────────────────────
export interface DB {
  clients: Client[];
  users: ClientUser[];
  jobs: Job[];
  plans: ClosurePlan[];
  candidates: Candidate[];
  rankings: RankingResult[];
  interviews: Interview[];
  scorecards: Scorecard[];
  actions: ClientAction[];
  outbox: OutboxMessage[];
  audit: AuditEvent[];
  // Candidate portal (M8/M9)
  candidateUsers: CandidateUser[];
  applications: Application[];
  mockInterviews: MockInterview[];
}
