"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/db/repo";
import { setSession, clearSession, requireSession, assertCanMutate } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getAI, ACTIVE_PROVIDER } from "@/lib/ai";
import { uid, nowISO } from "@/lib/ids";
import { extractText, deriveSkills, guessName } from "@/lib/ingestion/parse";
import { deriveKeywords } from "@/lib/ai/mock";
import { Job, Interview, Scorecard, ClientAction, ActionType, Criterion, ClosurePlan } from "@/lib/types";

// ── Auth ──────────────────────────────────────────────────────────────
export async function login() {
  const db = await getRepo().snapshot();
  setSession(db.users[0].id);
  redirect("/dashboard");
}

export async function logout() {
  clearSession();
  redirect("/login");
}

// ── Create job (M2: JD upload) ────────────────────────────────────────
export async function createJob(formData: FormData) {
  const user = await requireSession();
  assertCanMutate(user);
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
  await getRepo().createJob(job);
  await logAudit({
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
  const repo = getRepo();
  const db = await repo.snapshot();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Job not found");

  const plan = await getAI().generatePlan(job);
  await repo.supersedePlans(jobId);
  await repo.addPlan(plan);
  await repo.setJobStage(jobId, "PLAN_GENERATED");

  await logAudit({
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
// Apply every field edit from the criteria form onto the plan (in place):
// labels, type, weight, knockout, interview questions, and an optional new
// criterion from the blank add-row. Renaming a criterion re-derives its
// scoring keywords so the screener matches the new requirement, not the old.
function applyPlanFormEdits(plan: ClosurePlan, formData: FormData) {
  const cv = formData.get("cutoffValue");
  if (cv !== null) plan.cutoffValue = Number(cv || plan.cutoffValue || 5);

  plan.criteria.forEach((c) => {
    const lbl = formData.get(`label_${c.id}`);
    if (lbl !== null && String(lbl).trim() && String(lbl).trim() !== c.label) {
      c.label = String(lbl).trim();
      c.keywords = deriveKeywords(c.label);
    }
    const kind = formData.get(`kind_${c.id}`);
    if (kind === "must_have" || kind === "nice_to_have") c.kind = kind;
    const w = formData.get(`weight_${c.id}`);
    if (w !== null) c.weight = Math.max(0, Math.min(1, Number(w)));
    c.isKnockout = formData.get(`knockout_${c.id}`) === "on";
  });

  plan.interviewBlueprint.forEach((q) => {
    const t = formData.get(`q_${q.id}`);
    if (t !== null && String(t) !== q.text) {
      q.text = String(t);
      q.editedByClient = true;
    }
  });

  const newLabel = String(formData.get("new_label") || "").trim();
  if (newLabel) {
    const newKind = formData.get("new_kind") === "nice_to_have" ? "nice_to_have" : "must_have";
    const nc: Criterion = {
      id: uid("crit"),
      label: newLabel,
      weight: Math.max(0, Math.min(1, Number(formData.get("new_weight") || 0.1))),
      isKnockout: formData.get("new_knockout") === "on",
      kind: newKind,
      keywords: deriveKeywords(newLabel)
    };
    plan.criteria.push(nc);
  }
}

export async function updatePlan(formData: FormData) {
  const user = await requireSession();
  assertCanMutate(user);
  const repo = getRepo();
  const db = await repo.snapshot();
  const plan = db.plans.find((p) => p.planId === String(formData.get("planId")));
  if (!plan || plan.status !== "draft") return;

  applyPlanFormEdits(plan, formData);
  await repo.savePlan(plan);
  await logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "plan.edited",
    entityType: "plan",
    entityId: plan.planId,
    rationale: "Client edited plan criteria (labels/type/weights/knockouts, additions) and/or interview questions."
  });
  revalidatePath(`/jobs/${plan.jobId}`);
}

// Remove one criterion. The id is BOUND into the action (not read from a submit
// button's name) — React server actions don't serialize the submitter's
// name/value, so a bound arg is the reliable way to say which row to drop. Any
// other pending field edits in the form are applied too, so nothing is lost.
export async function removeCriterion(planId: string, critId: string, formData: FormData) {
  const user = await requireSession();
  assertCanMutate(user);
  const repo = getRepo();
  const db = await repo.snapshot();
  const plan = db.plans.find((p) => p.planId === planId);
  if (!plan || plan.status !== "draft") return;

  applyPlanFormEdits(plan, formData);
  if (plan.criteria.length > 1) {
    plan.criteria = plan.criteria.filter((c) => c.id !== critId); // never leave zero
  }
  await repo.savePlan(plan);
  await logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "plan.criterion_removed",
    entityType: "plan",
    entityId: plan.planId,
    rationale: `Client removed a criterion (${critId}) from the draft plan.`
  });
  revalidatePath(`/jobs/${plan.jobId}`);
}

// ── Approve plan (GATE 1) ─────────────────────────────────────────────
export async function approvePlan(formData: FormData) {
  const user = await requireSession();
  assertCanMutate(user);
  const planId = String(formData.get("planId"));

  const repo = getRepo();
  const db = await repo.snapshot();
  const plan = db.plans.find((p) => p.planId === planId);
  if (!plan) return;

  plan.status = "approved";
  plan.approvedBy = user.id;
  plan.approvedAt = nowISO();
  await repo.savePlan(plan);
  await repo.setJobStage(plan.jobId, "PLAN_APPROVED");

  await logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "gate.plan_approved",
    entityType: "plan",
    entityId: planId,
    rationale: "APPROVAL GATE 1: plan locked (immutable). Screening unlocked."
  });
  revalidatePath(`/jobs/${plan.jobId}`);
  redirect(`/jobs/${plan.jobId}`);
}

// ── Run screening (M3) ────────────────────────────────────────────────
export async function runScreening(jobId: string) {
  assertCanMutate(await requireSession());
  const repo = getRepo();
  const db = await repo.snapshot();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job || job.stage !== "PLAN_APPROVED") throw new Error("Plan not approved");
  const plan = db.plans.find((p) => p.jobId === jobId && p.status === "approved");
  if (!plan) throw new Error("No approved plan");

  const pool = db.candidates.filter((c) => c.clientId === job.clientId);
  const rankedCandidates = await getAI().rankCandidates(plan, pool);

  const runId = uid("run");
  await repo.addRanking({
    runId,
    jobId,
    planVersion: plan.version,
    candidates: rankedCandidates,
    createdAt: nowISO()
  });
  await repo.setJobStage(jobId, "SCREEN_COMPLETE");

  await logAudit({
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

// ── M4: advance candidate to interview (GATE 2) + outreach ────────────
export async function advanceCandidate(jobId: string, candidateId: string) {
  const user = await requireSession();
  assertCanMutate(user);
  const repo = getRepo();
  const db = await repo.snapshot();
  const cand = db.candidates.find((c) => c.id === candidateId);
  const job = db.jobs.find((j) => j.id === jobId);
  if (!cand || !job) throw new Error("Not found");

  if (!db.interviews.some((i) => i.jobId === jobId && i.candidateId === candidateId)) {
    const interview: Interview = {
      id: uid("intv"),
      clientId: user.clientId,
      jobId,
      candidateId,
      status: "invited",
      channel: "email",
      transcript: [],
      createdAt: nowISO(),
      completedAt: null
    };
    await repo.addInterview(interview);
    await repo.addOutbox({
      id: uid("msg"),
      clientId: user.clientId,
      candidateId: cand.id,
      to: `${cand.name} <candidate@example.com>`,
      subject: `Interview invite — ${job.title}`,
      body: `Hi ${cand.name},\n\nYou've been shortlisted for ${job.title} at ${db.clients.find((c) => c.id === user.clientId)?.name}. We'd like to run a short first-round interview by email. Reply to begin — the interview is conducted by an AI assistant on the hiring team's behalf.`,
      kind: "invite",
      createdAt: nowISO()
    });
    await logAudit({
      actorType: "client_user",
      actorId: user.id,
      action: "gate.advance_approved",
      entityType: "candidate",
      entityId: candidateId,
      rationale: `APPROVAL GATE 2: ${cand.name} advanced to interview; invite DRAFT created for review (not sent).`
    });
  }
  revalidatePath(`/jobs/${jobId}/candidate/${candidateId}`);
  redirect(`/jobs/${jobId}/candidate/${candidateId}`);
}

// ── M5: conduct the async AI interview ────────────────────────────────
export async function runInterview(interviewId: string) {
  assertCanMutate(await requireSession());
  const repo = getRepo();
  const db = await repo.snapshot();
  const intv = db.interviews.find((i) => i.id === interviewId);
  if (!intv) throw new Error("Interview not found");
  const plan = db.plans.find((p) => p.jobId === intv.jobId && p.status === "approved");
  const cand = db.candidates.find((c) => c.id === intv.candidateId);
  if (!plan || !cand) throw new Error("Missing plan/candidate");

  const transcript = await getAI().conductInterview(plan, cand);
  intv.transcript = transcript;
  intv.status = "completed";
  intv.completedAt = nowISO();
  await repo.saveInterview(intv);

  await logAudit({
    actorType: "ai",
    actorId: `${ACTIVE_PROVIDER()}-interviewer`,
    action: "interview.completed",
    entityType: "interview",
    entityId: intv.id,
    rationale: `Async ${intv.channel} first-round interview completed (${transcript.length} Q&A). AI use disclosed to candidate.`
  });
  revalidatePath(`/jobs/${intv.jobId}/candidate/${intv.candidateId}`);
}

// ── M6: score the completed interview ─────────────────────────────────
export async function scoreInterviewAction(interviewId: string) {
  assertCanMutate(await requireSession());
  const repo = getRepo();
  const db = await repo.snapshot();
  const intv = db.interviews.find((i) => i.id === interviewId);
  if (!intv || intv.status !== "completed") throw new Error("Interview not completed");
  const plan = db.plans.find((p) => p.jobId === intv.jobId && p.status === "approved");
  if (!plan) throw new Error("No approved plan");

  const res = await getAI().scoreInterview(plan, intv.transcript);
  const sc: Scorecard = {
    id: uid("sc"),
    interviewId: intv.id,
    candidateId: intv.candidateId,
    jobId: intv.jobId,
    competencyScores: res.competencyScores,
    overallScore: res.overallScore,
    recommendation: res.recommendation,
    createdAt: nowISO()
  };
  await repo.addScorecard(sc);

  await logAudit({
    actorType: "ai",
    actorId: `${ACTIVE_PROVIDER()}-scorer`,
    action: "interview.scored",
    entityType: "scorecard",
    entityId: sc.id,
    rationale: `Scorecard: ${res.overallScore}/100; recommendation "${res.recommendation.value}" (RECOMMENDATION — pending client approval).`
  });
  revalidatePath(`/jobs/${intv.jobId}/candidate/${intv.candidateId}`);
}

// ── M7: client-initiated action (GATE 3) ──────────────────────────────
export async function triggerAction(jobId: string, candidateId: string, type: ActionType) {
  const user = await requireSession();
  assertCanMutate(user);
  const repo = getRepo();
  const db = await repo.snapshot();
  const cand = db.candidates.find((c) => c.id === candidateId);
  const job = db.jobs.find((j) => j.id === jobId);
  if (!cand || !job) throw new Error("Not found");

  const detail = type === "send_email" ? `Email draft created for ${cand.name}` : `Meeting-invite draft created for ${cand.name}`;
  const action: ClientAction = {
    id: uid("act"),
    clientId: user.clientId,
    jobId,
    candidateId,
    type,
    detail,
    triggeredBy: user.id, // NEVER the AI
    triggeredAt: nowISO()
  };
  await repo.addAction(action);
  await repo.addOutbox({
    id: uid("msg"),
    clientId: user.clientId,
    candidateId: cand.id,
    to: `${cand.name} <candidate@example.com>`,
    subject: type === "send_email" ? `Next steps — ${job.title}` : `Interview scheduling — ${job.title}`,
    body:
      type === "send_email"
        ? `Hi ${cand.name},\n\nThanks for interviewing for ${job.title}. We'd like to move forward — a member of the team will follow up shortly.`
        : `Hi ${cand.name},\n\nWe'd like to schedule your next interview for ${job.title}. Please pick a time from the link we'll send.`,
    kind: "action",
    createdAt: nowISO()
  });
  await logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: `action.${type}`,
    entityType: "candidate",
    entityId: candidateId,
    rationale: `GATE 3 (client-initiated, never the AI): ${detail} — draft for review, not sent.`
  });
  revalidatePath(`/jobs/${jobId}/candidate/${candidateId}`);
}

// ── Folder ingestion (M1) ─────────────────────────────────────────────
const MAX_FILES_PER_UPLOAD = 200;

export async function ingestFolder(formData: FormData) {
  const user = await requireSession();
  assertCanMutate(user);
  const repo = getRepo();
  const files = (formData.getAll("files") as File[]).slice(0, MAX_FILES_PER_UPLOAD);

  let ingested = 0;
  const skipped: string[] = [];

  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== "function") continue;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const text = await extractText(file.name, buf); // throws on bad type/size/empty
      await repo.addCandidate({
        id: uid("cand"),
        clientId: user.clientId,
        name: guessName(file.name, text),
        source: "folder:upload",
        fileName: file.name,
        resumeText: text,
        skills: deriveSkills(text),
        ingestedAt: nowISO()
      });
      ingested++;
    } catch (e) {
      skipped.push(`${file.name} (${(e as Error).message})`);
    }
  }

  await logAudit({
    actorType: "client_user",
    actorId: user.id,
    action: "candidates.ingested",
    entityType: "client",
    entityId: user.clientId,
    rationale:
      `Folder ingestion: ${ingested} resume(s) parsed` +
      (skipped.length ? `; ${skipped.length} skipped — ${skipped.slice(0, 5).join("; ")}${skipped.length > 5 ? "…" : ""}` : ".")
  });
  revalidatePath("/candidates");
}

// ── Demo reset ────────────────────────────────────────────────────────
export async function resetDemo() {
  assertCanMutate(await requireSession());
  await getRepo().reset();
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
