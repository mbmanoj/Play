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
  OutboxMessage
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

  reset(): Promise<void>;
}

import { FileRepo } from "./file";
import { PgRepo } from "./pg";

let _repo: Repo | null = null;

export function getRepo(): Repo {
  if (_repo) return _repo;
  _repo = process.env.DATABASE_URL ? new PgRepo() : new FileRepo();
  return _repo;
}

export function dbBackend(): "postgres" | "file" {
  return process.env.DATABASE_URL ? "postgres" : "file";
}
