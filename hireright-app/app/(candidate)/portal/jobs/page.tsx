import { redirect } from "next/navigation";
import Link from "next/link";
import { getCandidate } from "@/lib/candidate-auth";
import { getRepo } from "@/lib/db/repo";
import { isOpen, matchJob } from "@/lib/matching";

function matchBadge(score: number): string {
  return score >= 67 ? "green" : score >= 34 ? "amber" : "gray";
}

export default async function BrowseRoles() {
  const me = await getCandidate();
  if (!me) redirect("/portal");
  const db = await getRepo().snapshot();
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name || "A company";
  const appliedJobIds = new Set(db.applications.filter((a) => a.candidateUserId === me.id).map((a) => a.jobId));

  const roles = db.jobs
    .filter(isOpen)
    .map((job) => ({ job, match: matchJob(me.skills, job) }))
    .sort((a, b) => b.match.score - a.match.score);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Roles matched to you</h1>
          <p>Ranked by how well your resume skills line up with each role. {me.skills.length === 0 && "Add skills on your profile to improve matching."}</p>
        </div>
      </div>

      {roles.length === 0 ? (
        <div className="card muted">No open roles right now. Check back soon.</div>
      ) : (
        roles.map(({ job, match }) => (
          <div className="card" key={job.id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontSize: "1.05rem" }}>{job.title}</strong>
                <div className="muted small">{clientName(job.clientId)}</div>
              </div>
              <span className={`badge ${matchBadge(match.score)}`}>{match.score}% match</span>
            </div>

            <div className="score-bar" style={{ margin: ".6rem 0" }}>
              <div style={{ width: `${match.score}%` }} />
            </div>

            <div className="small" style={{ marginBottom: ".5rem" }}>
              {match.matched.length > 0 && (
                <span>✓ You have: <strong>{match.matched.join(", ")}</strong>. </span>
              )}
              {match.missing.length > 0 && (
                <span className="muted">Gaps: {match.missing.join(", ")}.</span>
              )}
            </div>

            <div className="row" style={{ gap: ".5rem" }}>
              <Link className="btn" href={`/portal/jobs/${job.id}`}>View role</Link>
              {appliedJobIds.has(job.id) ? (
                <span className="badge green">✓ Applied</span>
              ) : (
                <Link className="btn ghost" href={`/portal/practice/${job.id}`}>Practise interview</Link>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
