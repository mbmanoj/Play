import fs from "fs";
import path from "path";
import { DB, ClientUser, Job, JobStage, ClosurePlan, RankingResult, Candidate, AuditEvent, Interview, Scorecard, ClientAction, OutboxMessage, CandidateUser, Application, MockInterview } from "../types";
import { seedDB } from "../seed";
import { Repo } from "./repo";

// ── File-backed JSON store ────────────────────────────────────────────
// Zero-config default persistence at .data/db.json. Survives restarts.
// Implements the same async Repo contract as Postgres.

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export class FileRepo implements Repo {
  private cache: DB | null = null;
  private mtimeMs = 0;

  // Re-read from disk whenever the file has changed since we last read it.
  // Next.js can instantiate this module more than once (server actions vs.
  // RSC renders in dev, separate bundles), so a write from one instance must
  // be visible to reads from another — otherwise a just-created job 404s.
  private load(): DB {
    if (fs.existsSync(DB_PATH)) {
      const { mtimeMs } = fs.statSync(DB_PATH);
      if (!this.cache || mtimeMs !== this.mtimeMs) {
        const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
        // Backfill arrays added after a store was first written, so older
        // db.json files keep working across upgrades.
        db.candidateUsers ??= [];
        db.applications ??= [];
        db.mockInterviews ??= [];
        this.cache = db;
        this.mtimeMs = mtimeMs;
      }
      return this.cache;
    }
    if (!this.cache) {
      this.cache = seedDB();
      this.persist();
    }
    return this.cache;
  }

  private persist() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(this.cache, null, 2), "utf8");
    this.mtimeMs = fs.statSync(DB_PATH).mtimeMs; // don't re-read our own write
  }

  private mutate<T>(fn: (db: DB) => T): T {
    const db = this.load();
    const r = fn(db);
    this.persist();
    return r;
  }

  async snapshot(): Promise<DB> {
    return this.load();
  }

  async userById(id: string): Promise<ClientUser | null> {
    return this.load().users.find((u) => u.id === id) || null;
  }

  async createUser(user: ClientUser): Promise<void> {
    this.mutate((db) => {
      if (!db.users.some((u) => u.id === user.id)) db.users.push(user);
    });
  }

  async createJob(job: Job): Promise<void> {
    this.mutate((db) => db.jobs.push(job));
  }

  async setJobStage(jobId: string, stage: JobStage): Promise<void> {
    this.mutate((db) => {
      const j = db.jobs.find((x) => x.id === jobId);
      if (j) j.stage = stage;
    });
  }

  async addPlan(plan: ClosurePlan): Promise<void> {
    this.mutate((db) => db.plans.push(plan));
  }

  async supersedePlans(jobId: string): Promise<void> {
    this.mutate((db) =>
      db.plans.filter((p) => p.jobId === jobId).forEach((p) => (p.status = "superseded"))
    );
  }

  async savePlan(plan: ClosurePlan): Promise<void> {
    this.mutate((db) => {
      const i = db.plans.findIndex((p) => p.planId === plan.planId);
      if (i >= 0) db.plans[i] = plan;
      else db.plans.push(plan);
    });
  }

  async addRanking(r: RankingResult): Promise<void> {
    this.mutate((db) => db.rankings.push(r));
  }

  async addCandidate(c: Candidate): Promise<void> {
    this.mutate((db) => db.candidates.push(c));
  }

  async appendAudit(e: AuditEvent): Promise<void> {
    this.mutate((db) => db.audit.push(e));
  }

  async addInterview(i: Interview): Promise<void> {
    this.mutate((db) => db.interviews.push(i));
  }

  async saveInterview(i: Interview): Promise<void> {
    this.mutate((db) => {
      const k = db.interviews.findIndex((x) => x.id === i.id);
      if (k >= 0) db.interviews[k] = i;
      else db.interviews.push(i);
    });
  }

  async addScorecard(s: Scorecard): Promise<void> {
    this.mutate((db) => db.scorecards.push(s));
  }

  async addAction(a: ClientAction): Promise<void> {
    this.mutate((db) => db.actions.push(a));
  }

  async addOutbox(m: OutboxMessage): Promise<void> {
    this.mutate((db) => db.outbox.push(m));
  }

  // ── Candidate portal (M8/M9) ────────────────────────────────────────
  async candidateUserById(id: string): Promise<CandidateUser | null> {
    return this.load().candidateUsers.find((u) => u.id === id) || null;
  }

  async candidateUserByEmail(email: string): Promise<CandidateUser | null> {
    const e = email.toLowerCase();
    return this.load().candidateUsers.find((u) => u.email.toLowerCase() === e) || null;
  }

  async createCandidateUser(u: CandidateUser): Promise<void> {
    this.mutate((db) => {
      if (!db.candidateUsers.some((x) => x.id === u.id)) db.candidateUsers.push(u);
    });
  }

  async saveCandidateUser(u: CandidateUser): Promise<void> {
    this.mutate((db) => {
      const i = db.candidateUsers.findIndex((x) => x.id === u.id);
      if (i >= 0) db.candidateUsers[i] = u;
      else db.candidateUsers.push(u);
    });
  }

  async addApplication(a: Application): Promise<void> {
    this.mutate((db) => db.applications.push(a));
  }

  async addMockInterview(m: MockInterview): Promise<void> {
    this.mutate((db) => db.mockInterviews.push(m));
  }

  async reset(): Promise<void> {
    this.cache = seedDB();
    this.persist();
  }
}
