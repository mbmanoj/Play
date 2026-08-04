import { redirect } from "next/navigation";
import Link from "next/link";
import { getCandidate } from "@/lib/candidate-auth";
import { getRepo } from "@/lib/db/repo";
import { DB } from "@/lib/types";

// Live status derived from the EMPLOYER pipeline — never a stored value that
// could drift. This is the "where do I stand" transparency (M-Status) from
// the candidate's side: no black hole.
function statusFor(db: DB, candidateId: string): { step: number; label: string; badge: string } {
  const has = <T,>(arr: T[], f: (x: T) => boolean) => arr.some(f);
  if (has(db.actions, (a) => a.candidateId === candidateId))
    return { step: 4, label: "The hiring team has taken next steps — expect to hear from them", badge: "green" };
  if (has(db.scorecards, (s) => s.candidateId === candidateId))
    return { step: 3, label: "Interview reviewed — a hiring decision is pending", badge: "blue" };
  const iv = db.interviews.find((i) => i.candidateId === candidateId);
  if (iv?.status === "completed")
    return { step: 3, label: "Interview complete — being reviewed", badge: "blue" };
  if (iv?.status === "invited")
    return { step: 2, label: "Invited to a first-round interview", badge: "amber" };
  return { step: 1, label: "Application received — in the screening queue", badge: "gray" };
}

const STEPS = ["Applied", "Interview", "Reviewed", "Next steps"];

export default async function MyApplications() {
  const me = await getCandidate();
  if (!me) redirect("/portal");
  const db = await getRepo().snapshot();
  const mine = db.applications
    .filter((a) => a.candidateUserId === me.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My applications</h1>
          <p>Real-time status, straight from the hiring team&apos;s pipeline. No guessing, no black hole.</p>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className="card muted">
          You haven&apos;t applied to any roles yet. <Link href="/portal/jobs">Browse matched roles →</Link>
        </div>
      ) : (
        mine.map((app) => {
          const job = db.jobs.find((j) => j.id === app.jobId);
          const company = db.clients.find((c) => c.id === app.clientId)?.name || "A company";
          const st = statusFor(db, app.candidateId);
          return (
            <div className="card" key={app.id}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: ".5rem" }}>
                <div>
                  <strong>{job?.title || "Role"}</strong>
                  <div className="muted small">{company} · applied {new Date(app.createdAt).toLocaleDateString()}</div>
                </div>
                <span className={`badge ${st.badge}`}>{st.label}</span>
              </div>
              <div className="stages">
                {STEPS.map((s, i) => (
                  <div key={s} style={{ display: "contents" }}>
                    <div className={`stage-dot ${i + 1 < st.step ? "done" : i + 1 === st.step ? "active" : ""}`}>
                      <span className="dot" />
                      <span className="small">{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <span className="stage-sep" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
