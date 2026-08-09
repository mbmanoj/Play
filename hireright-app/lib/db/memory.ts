import { DB, ClientUser, Job, JobStage, ClosurePlan, RankingResult, Candidate, AuditEvent, Interview, Scorecard, ClientAction, OutboxMessage, CandidateUser, Application, MockInterview } from "../types";
import { seedDB } from "../seed";
import { Repo } from "./repo";

// ── In-memory store ───────────────────────────────────────────────────
// Zero-dependency, no-disk persistence. Used on read-only/serverless hosts
// (e.g. Vercel) when no DATABASE_URL is set, so the demo runs with no
// external services. Data lives only for the process lifetime — perfect for
// a throwaway demo, not for production (use Postgres for durability).

export class MemoryRepo implements Repo {
  private db: DB = seedDB();

  async snapshot(): Promise<DB> {
    return this.db;
  }

  async userById(id: string): Promise<ClientUser | null> {
    return this.db.users.find((u) => u.id === id) || null;
  }
  async createUser(user: ClientUser): Promise<void> {
    if (!this.db.users.some((u) => u.id === user.id)) this.db.users.push(user);
  }

  async createJob(job: Job): Promise<void> {
    this.db.jobs.push(job);
  }
  async setJobStage(jobId: string, stage: JobStage): Promise<void> {
    const j = this.db.jobs.find((x) => x.id === jobId);
    if (j) j.stage = stage;
  }

  async addPlan(plan: ClosurePlan): Promise<void> {
    this.db.plans.push(plan);
  }
  async supersedePlans(jobId: string): Promise<void> {
    this.db.plans.filter((p) => p.jobId === jobId).forEach((p) => (p.status = "superseded"));
  }
  async savePlan(plan: ClosurePlan): Promise<void> {
    const i = this.db.plans.findIndex((p) => p.planId === plan.planId);
    if (i >= 0) this.db.plans[i] = plan;
    else this.db.plans.push(plan);
  }

  async addRanking(r: RankingResult): Promise<void> {
    this.db.rankings.push(r);
  }
  async addCandidate(c: Candidate): Promise<void> {
    this.db.candidates.push(c);
  }
  async appendAudit(e: AuditEvent): Promise<void> {
    this.db.audit.push(e);
  }

  async addInterview(i: Interview): Promise<void> {
    this.db.interviews.push(i);
  }
  async saveInterview(i: Interview): Promise<void> {
    const k = this.db.interviews.findIndex((x) => x.id === i.id);
    if (k >= 0) this.db.interviews[k] = i;
    else this.db.interviews.push(i);
  }
  async addScorecard(s: Scorecard): Promise<void> {
    this.db.scorecards.push(s);
  }
  async addAction(a: ClientAction): Promise<void> {
    this.db.actions.push(a);
  }
  async addOutbox(m: OutboxMessage): Promise<void> {
    this.db.outbox.push(m);
  }

  // Candidate portal (M8/M9)
  async candidateUserById(id: string): Promise<CandidateUser | null> {
    return this.db.candidateUsers.find((u) => u.id === id) || null;
  }
  async candidateUserByEmail(email: string): Promise<CandidateUser | null> {
    const e = email.toLowerCase();
    return this.db.candidateUsers.find((u) => u.email.toLowerCase() === e) || null;
  }
  async createCandidateUser(u: CandidateUser): Promise<void> {
    if (!this.db.candidateUsers.some((x) => x.id === u.id)) this.db.candidateUsers.push(u);
  }
  async saveCandidateUser(u: CandidateUser): Promise<void> {
    const i = this.db.candidateUsers.findIndex((x) => x.id === u.id);
    if (i >= 0) this.db.candidateUsers[i] = u;
    else this.db.candidateUsers.push(u);
  }
  async addApplication(a: Application): Promise<void> {
    this.db.applications.push(a);
  }
  async addMockInterview(m: MockInterview): Promise<void> {
    this.db.mockInterviews.push(m);
  }

  async reset(): Promise<void> {
    this.db = seedDB();
  }
}
