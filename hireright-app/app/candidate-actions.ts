"use server";

import { redirect } from "next/navigation";
import { getRepo } from "@/lib/db/repo";
import { uid, nowISO } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { getCandidate, setCandidateSession, clearCandidateSession } from "@/lib/candidate-auth";
import { isOpen } from "@/lib/matching";
import { getAI } from "@/lib/ai";
import { practiceQuestions, coachAnswer, overall } from "@/lib/practice";
import { CandidateUser, Candidate, Application, MockInterview, MockTurn } from "@/lib/types";

// ── Candidate portal server actions (M8/M9) ───────────────────────────

// Register or sign in (demo-style: name + email, no password). An existing
// email signs the candidate back in rather than duplicating them.
export async function candidateRegister(formData: FormData): Promise<void> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const resumeText = String(formData.get("resumeText") || "").trim();

  if (!name || !email) redirect("/portal?error=missing");

  const repo = getRepo();
  const existing = await repo.candidateUserByEmail(email);
  if (existing) {
    setCandidateSession(existing.id);
    redirect("/portal/jobs");
  }

  const me: CandidateUser = {
    id: uid("canduser"),
    name,
    email,
    resumeText,
    skills: await getAI().extractSkills(resumeText),
    createdAt: nowISO()
  };
  await repo.createCandidateUser(me);
  setCandidateSession(me.id);
  redirect("/portal/jobs");
}

export async function candidateLogout(): Promise<void> {
  clearCandidateSession();
  redirect("/portal");
}

export async function updateResume(formData: FormData): Promise<void> {
  const me = await getCandidate();
  if (!me) redirect("/portal");
  const resumeText = String(formData.get("resumeText") || "").trim();
  await getRepo().saveCandidateUser({ ...me, resumeText, skills: await getAI().extractSkills(resumeText) });
  redirect("/portal/profile?saved=1");
}

// Apply to a job: creates the candidate's employer-side applicant record so
// they enter that client's screening pipeline, and links it via Application.
export async function applyToJob(jobId: string): Promise<void> {
  const me = await getCandidate();
  if (!me) redirect("/portal");

  const repo = getRepo();
  const db = await repo.snapshot();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job || !isOpen(job)) redirect("/portal/jobs?error=closed");

  // No duplicate applications to the same role.
  if (db.applications.some((a) => a.candidateUserId === me.id && a.jobId === jobId)) {
    redirect("/portal/applications");
  }

  const candidateId = uid("cand");
  const applicant: Candidate = {
    id: candidateId,
    clientId: job.clientId,
    name: me.name,
    source: "portal:application",
    fileName: `${me.name.toLowerCase().replace(/\s+/g, "_")}.txt`,
    resumeText: me.resumeText,
    skills: me.skills,
    ingestedAt: nowISO()
    // NB: no demographics — self-applied candidates disclose nothing here.
  };
  await repo.addCandidate(applicant);

  const application: Application = {
    id: uid("app"),
    candidateUserId: me.id,
    jobId,
    clientId: job.clientId,
    candidateId,
    createdAt: nowISO()
  };
  await repo.addApplication(application);

  await logAudit({
    actorType: "candidate",
    actorId: me.id,
    action: "candidate.applied",
    entityType: "job",
    entityId: jobId,
    rationale: `${me.name} applied to "${job.title}" via the candidate portal; entered ${job.clientId} screening pool.`
  });

  redirect("/portal/applications");
}

// Submit a mock-interview practice session (M9). Private to the candidate —
// never surfaced to any employer, never part of a real screening decision.
export async function submitPractice(jobId: string, formData: FormData): Promise<void> {
  const me = await getCandidate();
  if (!me) redirect("/portal");

  const repo = getRepo();
  const db = await repo.snapshot();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) redirect("/portal/jobs");

  const questions = practiceQuestions(job);
  const turns: MockTurn[] = questions.map((q, i) => {
    const answer = String(formData.get(`a${i}`) || "").trim();
    const { score, feedback } = coachAnswer(q, answer);
    return { question: q.text, answer, score, feedback };
  });

  const mock: MockInterview = {
    id: uid("mock"),
    candidateUserId: me.id,
    jobId,
    jobTitle: job.title,
    turns,
    overallScore: overall(turns.map((t) => t.score)),
    createdAt: nowISO()
  };
  await repo.addMockInterview(mock);
  redirect(`/portal/practice/${jobId}?done=${mock.id}`);
}
