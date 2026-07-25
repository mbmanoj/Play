"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { read, write, resetDB } from "@/lib/db";
import { setSession, clearSession, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getAI, ACTIVE_PROVIDER } from "@/lib/ai";
import { uid, nowISO } from "@/lib/ids";
import { extractText, deriveSkills, guessName } from "@/lib/ingestion/parse";
import { Job } from "@/lib/types";

// ── Auth ──────────────────────────────────────────────────────────────
export async function login() {
  const user = read().users[0];
  setSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  clearSession();
  redirect("/login");
}

// ── Create job (M2: JD upload) ────────────────────────────────────────
export async function createJob(formData: FormData) {
  const user = requireSession();
  const title = String(formData.get("title") || "Untitled role").trim();
  const jdText = String(formData.get("jdText") || "").trim();

  const job: Job = {
    id: uid("job"),
    clientId: user.clientId,
    title,
    jdText,
    stage: "JD_UPLOADED",
    createdAt: nowISO(),
    createdBy: user.id
  };
  write((db) => db.jobs.push(job));
  logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "job.created",
    entityType: "job",
    entityId: job.id,
    rationale: `JD uploaded: "${title}"`
  });

  await generatePlan(job.id);
  redirect(`/jobs/${job.id}`);
}

// ── Generate plan (M2) ────────────────────────────────────────────────
export async function generatePlan(jobId: string) {
  const job = read().jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Job not found");

  const plan = await getAI().generatePlan(job);
  write((db) => {
    db.plans.filter((p) => p.jobId === jobId).forEach((p) => (p.status = "superseded"));
    db.plans.push(plan);
    const j = db.jobs.find((x) => x.id === jobId)!;
    j.stage = "PLAN_GENERATED";
  });
  logAudit({
    actorType: "ai",
    actorId: `${ACTIVE_PROVIDER()}-planner`,
    action: "plan.generated",
    entityType: "plan",
    entityId: plan.planId,
    rationale: `${plan.criteria.length} criteria detected from JD (provider: ${ACTIVE_PROVIDER()}).`
  });
  revalidatePath(`/jobs/${jobId}`);
}

// ── Edit plan (M2) ────────────────────────────────────────────────────
export async function updatePlan(formData: FormData) {
  const user = requireSession();
  const planId = String(formData.get("planId"));
  const cutoffValue = Number(formData.get("cutoffValue") || 5);

  write((db) => {
    const plan = db.plans.find((p) => p.planId === planId);
    if (!plan || plan.status !== "draft") return;
    plan.cutoffValue = cutoffValue;
    plan.criteria.forEach((c) => {
      const w = formData.get(`weight_${c.id}`);
      const ko = formData.get(`knockout_${c.id}`);
      if (w !== null) c.weight = Math.max(0, Math.min(1, Number(w)));
      c.isKnockout = ko === "on";
    });
    plan.interviewBlueprint.forEach((q) => {
      const t = formData.get(`q_${q.id}`);
      if (t !== null && String(t) !== q.text) {
        q.text = String(t);
        q.editedByClient = true;
      }
    });
  });
  logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "plan.edited",
    entityType: "plan",
    entityId: planId,
    rationale: "Client edited criteria weights / interview questions."
  });
  const jobId = read().plans.find((p) => p.planId === planId)?.jobId;
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

// ── Approve plan (GATE 1) ─────────────────────────────────────────────
export async function approvePlan(formData: FormData) {
  const user = requireSession();
  const planId = String(formData.get("planId"));
  let jobId = "";

  write((db) => {
    const plan = db.plans.find((p) => p.planId === planId);
    if (!plan) return;
    plan.status = "approved";
    plan.approvedBy = user.id;
    plan.approvedAt = nowISO();
    jobId = plan.jobId;
    const job = db.jobs.find((j) => j.id === jobId)!;
    job.stage = "PLAN_APPROVED";
  });
  logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "gate.plan_approved",
    entityType: "plan",
    entityId: planId,
    rationale: "APPROVAL GATE 1: plan locked (immutable). Screening unlocked."
  });
  if (jobId) {
    revalidatePath(`/jobs/${jobId}`);
    redirect(`/jobs/${jobId}`);
  }
}

// ── Run screening (M3) ────────────────────────────────────────────────
export async function runScreening(jobId: string) {
  const db0 = read();
  const job = db0.jobs.find((j) => j.id === jobId);
  if (!job || job.stage !== "PLAN_APPROVED") throw new Error("Plan not approved");
  const plan = db0.plans.find((p) => p.jobId === jobId && p.status === "approved");
  if (!plan) throw new Error("No approved plan");

  const pool = db0.candidates.filter((c) => c.clientId === job.clientId);
  const rankedCandidates = await getAI().rankCandidates(plan, pool);

  const runId = uid("run");
  write((db) => {
    db.rankings.push({
      runId,
      jobId,
      planVersion: plan.version,
      candidates: rankedCandidates,
      createdAt: nowISO()
    });
    db.jobs.find((j) => j.id === jobId)!.stage = "SCREEN_COMPLETE";
  });
  logAudit({
    actorType: "ai",
    actorId: `${ACTIVE_PROVIDER()}-ranker`,
    action: "candidates.scored",
    entityType: "ranking",
    entityId: runId,
    rationale: `${pool.length} candidates scored against approved plan v${plan.version}. Evidence-cited, demographics firewalled (provider: ${ACTIVE_PROVIDER()}).`
  });
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/shortlist`);
}

// ── Folder ingestion (M1) ─────────────────────────────────────────────
export async function ingestFolder(formData: FormData) {
  const user = requireSession();
  const files = formData.getAll("files") as File[];
  let count = 0;

  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== "function") continue;
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractText(file.name, buf);
    write((db) =>
      db.candidates.push({
        id: uid("cand"),
        clientId: user.clientId,
        name: guessName(file.name, text),
        source: "folder:upload",
        fileName: file.name,
        resumeText: text,
        skills: deriveSkills(text),
        ingestedAt: nowISO()
      })
    );
    count++;
  }
  logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "candidates.ingested",
    entityType: "client",
    entityId: user.clientId,
    rationale: `Folder ingestion: ${count} resume(s) parsed.`
  });
  revalidatePath("/candidates");
}

// ── Demo reset ────────────────────────────────────────────────────────
export async function resetDemo() {
  requireSession();
  resetDB();
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
