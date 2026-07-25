import { Pool } from "pg";
import {
  DB,
  ClientUser,
  Job,
  JobStage,
  ClosurePlan,
  RankingResult,
  Candidate,
  AuditEvent,
  Role
} from "../types";
import { seedDB } from "../seed";
import { Repo } from "./repo";

// ── Postgres store ────────────────────────────────────────────────────
// Real relational persistence. Top-level entities are columns; nested
// structures (plan criteria/blueprint, ranking candidates, skills,
// demographics) are JSONB. Schema auto-migrates and seeds on first use.
// Works with any Postgres (local, Neon, Supabase, RDS).

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clients (
  id   text PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id        text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  name      text NOT NULL,
  email     text NOT NULL,
  role      text NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id         text PRIMARY KEY,
  client_id  text NOT NULL REFERENCES clients(id),
  title      text NOT NULL,
  jd_text    text NOT NULL,
  stage      text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  plan_id    text PRIMARY KEY,
  job_id     text NOT NULL REFERENCES jobs(id),
  version    integer NOT NULL,
  status     text NOT NULL,
  data       jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_job_idx ON plans(job_id);
CREATE TABLE IF NOT EXISTS candidates (
  id           text PRIMARY KEY,
  client_id    text NOT NULL REFERENCES clients(id),
  name         text NOT NULL,
  source       text NOT NULL,
  file_name    text NOT NULL,
  resume_text  text NOT NULL,
  skills       jsonb NOT NULL,
  ingested_at  timestamptz NOT NULL,
  demographics jsonb
);
CREATE INDEX IF NOT EXISTS candidates_client_idx ON candidates(client_id);
CREATE TABLE IF NOT EXISTS rankings (
  run_id       text PRIMARY KEY,
  job_id       text NOT NULL REFERENCES jobs(id),
  plan_version integer NOT NULL,
  candidates   jsonb NOT NULL,
  created_at   timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  event_id    text PRIMARY KEY,
  ts          timestamptz NOT NULL,
  actor_type  text NOT NULL,
  actor_id    text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  rationale   text
);
`;

export class PgRepo implements Repo {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.DATABASE_URL!;
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new Pool({
      connectionString: url,
      ssl: local ? undefined : { rejectUnauthorized: false }
    });
  }

  private init(): Promise<void> {
    if (!this.ready) this.ready = this.migrateAndSeed();
    return this.ready;
  }

  private async migrateAndSeed(): Promise<void> {
    await this.pool.query(SCHEMA);
    const { rows } = await this.pool.query<{ count: string }>("SELECT count(*)::int AS count FROM clients");
    if (Number(rows[0].count) === 0) await this.seed();
  }

  private async seed(): Promise<void> {
    const db = seedDB();
    for (const c of db.clients) await this.pool.query("INSERT INTO clients(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING", [c.id, c.name]);
    for (const u of db.users)
      await this.pool.query(
        "INSERT INTO users(id,client_id,name,email,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [u.id, u.clientId, u.name, u.email, u.role]
      );
    for (const c of db.candidates) await this.insertCandidate(c);
    for (const e of db.audit) await this.insertAudit(e);
  }

  private async insertCandidate(c: Candidate): Promise<void> {
    await this.pool.query(
      `INSERT INTO candidates(id,client_id,name,source,file_name,resume_text,skills,ingested_at,demographics)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.clientId, c.name, c.source, c.fileName, c.resumeText, JSON.stringify(c.skills), c.ingestedAt, c.demographics ? JSON.stringify(c.demographics) : null]
    );
  }

  private async insertAudit(e: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit(event_id,ts,actor_type,actor_id,action,entity_type,entity_id,rationale)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (event_id) DO NOTHING`,
      [e.eventId, e.timestamp, e.actorType, e.actorId, e.action, e.entityType, e.entityId, e.rationale ?? null]
    );
  }

  // ── reads ───────────────────────────────────────────────────────────
  async snapshot(): Promise<DB> {
    await this.init();
    const [clients, users, jobs, plans, candidates, rankings, audit] = await Promise.all([
      this.pool.query("SELECT * FROM clients"),
      this.pool.query("SELECT * FROM users"),
      this.pool.query("SELECT * FROM jobs ORDER BY created_at"),
      this.pool.query("SELECT * FROM plans ORDER BY created_at"),
      this.pool.query("SELECT * FROM candidates ORDER BY ingested_at"),
      this.pool.query("SELECT * FROM rankings ORDER BY created_at"),
      this.pool.query("SELECT * FROM audit ORDER BY ts")
    ]);
    return {
      clients: clients.rows.map((r) => ({ id: r.id, name: r.name })),
      users: users.rows.map((r) => ({ id: r.id, clientId: r.client_id, name: r.name, email: r.email, role: r.role as Role })),
      jobs: jobs.rows.map((r) => ({
        id: r.id, clientId: r.client_id, title: r.title, jdText: r.jd_text,
        stage: r.stage as JobStage, createdAt: new Date(r.created_at).toISOString(), createdBy: r.created_by
      })),
      plans: plans.rows.map((r) => r.data as ClosurePlan),
      candidates: candidates.rows.map((r) => ({
        id: r.id, clientId: r.client_id, name: r.name, source: r.source, fileName: r.file_name,
        resumeText: r.resume_text, skills: r.skills, ingestedAt: new Date(r.ingested_at).toISOString(),
        demographics: r.demographics || undefined
      })),
      rankings: rankings.rows.map((r) => ({
        runId: r.run_id, jobId: r.job_id, planVersion: r.plan_version,
        candidates: r.candidates, createdAt: new Date(r.created_at).toISOString()
      })),
      audit: audit.rows.map((r) => ({
        eventId: r.event_id, timestamp: new Date(r.ts).toISOString(), actorType: r.actor_type,
        actorId: r.actor_id, action: r.action, entityType: r.entity_type, entityId: r.entity_id,
        rationale: r.rationale || undefined
      }))
    };
  }

  async userById(id: string): Promise<ClientUser | null> {
    await this.init();
    const { rows } = await this.pool.query("SELECT * FROM users WHERE id=$1", [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, clientId: r.client_id, name: r.name, email: r.email, role: r.role as Role };
  }

  // ── writes ──────────────────────────────────────────────────────────
  async createJob(job: Job): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO jobs(id,client_id,title,jd_text,stage,created_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [job.id, job.clientId, job.title, job.jdText, job.stage, job.createdAt, job.createdBy]
    );
  }

  async setJobStage(jobId: string, stage: JobStage): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE jobs SET stage=$1 WHERE id=$2", [stage, jobId]);
  }

  async addPlan(plan: ClosurePlan): Promise<void> {
    await this.savePlan(plan);
  }

  async supersedePlans(jobId: string): Promise<void> {
    await this.init();
    await this.pool.query(
      `UPDATE plans SET status='superseded', data = data || '{"status":"superseded"}'::jsonb
       WHERE job_id=$1 AND status <> 'superseded'`,
      [jobId]
    );
  }

  async savePlan(plan: ClosurePlan): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO plans(plan_id,job_id,version,status,data,created_at) VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT (plan_id) DO UPDATE SET status=EXCLUDED.status, version=EXCLUDED.version, data=EXCLUDED.data`,
      [plan.planId, plan.jobId, plan.version, plan.status, JSON.stringify(plan), plan.createdAt]
    );
  }

  async addRanking(r: RankingResult): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO rankings(run_id,job_id,plan_version,candidates,created_at) VALUES($1,$2,$3,$4,$5)`,
      [r.runId, r.jobId, r.planVersion, JSON.stringify(r.candidates), r.createdAt]
    );
  }

  async addCandidate(c: Candidate): Promise<void> {
    await this.init();
    await this.insertCandidate(c);
  }

  async appendAudit(e: AuditEvent): Promise<void> {
    await this.init();
    await this.insertAudit(e);
  }

  async reset(): Promise<void> {
    await this.init();
    await this.pool.query("TRUNCATE rankings, plans, jobs, candidates, users, audit, clients CASCADE");
    await this.seed();
  }
}
