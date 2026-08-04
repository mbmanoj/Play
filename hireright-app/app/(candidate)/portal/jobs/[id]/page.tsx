import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCandidate } from "@/lib/candidate-auth";
import { getRepo } from "@/lib/db/repo";
import { isOpen, matchJob } from "@/lib/matching";
import { applyToJob } from "@/app/candidate-actions";

export default async function RoleDetail({ params }: { params: { id: string } }) {
  const me = await getCandidate();
  if (!me) redirect("/portal");
  const db = await getRepo().snapshot();
  const job = db.jobs.find((j) => j.id === params.id);
  if (!job || !isOpen(job)) notFound();

  const clientName = db.clients.find((c) => c.id === job.clientId)?.name || "A company";
  const match = matchJob(me.skills, job);
  const applied = db.applications.some((a) => a.candidateUserId === me.id && a.jobId === job.id);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p>{clientName} · <span className="badge green">{match.score}% match</span></p>
        </div>
        <Link className="btn ghost" href="/portal/jobs">← All roles</Link>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <strong>Role description</strong>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".85rem", color: "#334155", marginTop: ".5rem" }}>
            {job.jdText}
          </pre>
        </div>

        <div>
          <div className="card">
            <strong>How you line up</strong>
            <div className="score-bar" style={{ margin: ".6rem 0" }}>
              <div style={{ width: `${match.score}%` }} />
            </div>
            {match.matched.length > 0 && (
              <p className="small" style={{ marginBottom: ".35rem" }}>✓ Matched: <strong>{match.matched.join(", ")}</strong></p>
            )}
            {match.missing.length > 0 && (
              <p className="small muted">Not evidenced yet: {match.missing.join(", ")}</p>
            )}
          </div>

          <div className="card">
            {applied ? (
              <>
                <p className="small">✓ You&apos;ve applied to this role.</p>
                <Link className="btn ghost" href="/portal/applications">Track your application →</Link>
              </>
            ) : (
              <>
                <p className="small" style={{ marginBottom: ".5rem" }}>
                  Applying shares your resume with {clientName}&apos;s hiring team and enters you into their AI screening.
                </p>
                <form action={applyToJob.bind(null, job.id)}>
                  <button className="btn" style={{ width: "100%", justifyContent: "center" }}>Apply to this role</button>
                </form>
              </>
            )}
            <div style={{ marginTop: ".6rem" }}>
              <Link className="btn secondary" href={`/portal/practice/${job.id}`} style={{ width: "100%", justifyContent: "center" }}>
                🎤 Practise interview (private)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
