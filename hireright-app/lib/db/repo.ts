import {
  DB,
  ClientUser,
  Job,
  JobStage,
  ClosurePlan,
  RankingResult,
  Candidate,
  AuditEvent,
  Interview,
  Scorecard,
  ClientAction,
  OutboxMessage,
  CandidateUser,
  Application,
  MockInterview
} from "../types";

// ── Repository interface (async) ──────────────────────────────────────
// The single persistence contract. Two implementations:
//   • FileRepo  — file-backed JSON (.data/db.json), zero-config default.
//   • PgRepo    — Postgres, active when DATABASE_URL is set.
// Swap is transparent to every call site.

export interface Repo {
  snapshot(): Promise<DB>;
  userById(id: string): Promise<ClientUser | null>;
  createUser(user: ClientUser): Promise<void>;

  createJob(job: Job): Promise<void>;
  setJobStage(jobId: string, stage: JobStage): Promise<void>;

  addPlan(plan: ClosurePlan): Promise<void>;
  supersedePlans(jobId: string): Promise<void>;
  savePlan(plan: ClosurePlan): Promise<void>; // upsert by planId

  addRanking(r: RankingResult): Promise<void>;
  addCandidate(c: Candidate): Promise<void>;
  appendAudit(e: AuditEvent): Promise<void>;

  addInterview(i: Interview): Promise<void>;
  saveInterview(i: Interview): Promise<void>;
  addScorecard(s: Scorecard): Promise<void>;
  addAction(a: ClientAction): Promise<void>;
  addOutbox(m: OutboxMessage): Promise<void>;

  // Candidate portal (M8/M9)
  candidateUserById(id: string): Promise<CandidateUser | null>;
  candidateUserByEmail(email: string): Promise<CandidateUser | null>;
  createCandidateUser(u: CandidateUser): Promise<void>;
  saveCandidateUser(u: CandidateUser): Promise<void>; // upsert (profile edits)
  addApplication(a: Application): Promise<void>;
  addMockInterview(m: MockInterview): Promise<void>;

  reset(): Promise<void>;
}

import { FileRepo } from "./file";
import { PgRepo } from "./pg";
import { MemoryRepo } from "./memory";

let _repo: Repo | null = null;

// Serverless hosts (Vercel/Lambda) have a read-only filesystem, so the
// file store can't write there. Selection order:
//   DATABASE_URL set      → Postgres (durable, production)
//   serverless, no DB     → in-memory (zero-config demo, ephemeral)
//   local, no DB          → file-backed (persists across restarts)
function isServerless(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

export function getRepo(): Repo {
  if (_repo) return _repo;
  if (process.env.DATABASE_URL) _repo = new PgRepo();
  else if (isServerless()) _repo = new MemoryRepo();
  else _repo = new FileRepo();
  return _repo;
}

export function dbBackend(): "postgres" | "memory" | "file" {
  if (process.env.DATABASE_URL) return "postgres";
  if (isServerless()) return "memory";
  return "file";
}
