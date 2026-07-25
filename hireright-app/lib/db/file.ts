import fs from "fs";
import path from "path";
import { DB, ClientUser, Job, JobStage, ClosurePlan, RankingResult, Candidate, AuditEvent, Interview, Scorecard, ClientAction, OutboxMessage } from "../types";
import { seedDB } from "../seed";
import { Repo } from "./repo";

// ── File-backed JSON store ────────────────────────────────────────────
// Zero-config default persistence at .data/db.json. Survives restarts.
// Implements the same async Repo contract as Postgres.

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export class FileRepo implements Repo {
  private cache: DB | null = null;

  private load(): DB {
    if (this.cache) return this.cache;
    if (fs.existsSync(DB_PATH)) {
      this.cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
    } else {
      this.cache = seedDB();
      this.persist();
    }
    return this.cache;
  }

  private persist() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(this.cache, null, 2), "utf8");
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

  async reset(): Promise<void> {
    this.cache = seedDB();
    this.persist();
  }
}
