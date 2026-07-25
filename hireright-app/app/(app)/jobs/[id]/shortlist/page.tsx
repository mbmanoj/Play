import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";
import { advanceCandidate } from "@/app/actions";

function confBadge(c: string) {
  return c === "high" ? "green" : c === "medium" ? "amber" : "red";
}

export default async function Shortlist({ params }: { params: { id: string } }) {
  await requireSession();
  const db = await getRepo().snapshot();
  const job = db.jobs.find((j) => j.id === params.id);
  if (!job) notFound();
  const ranking = [...db.rankings].reverse().find((r) => r.jobId === job.id);
  const plan = db.plans.find((p) => p.jobId === job.id && p.status === "approved");
  if (!ranking) {
    return (
      <div className="card">
        No shortlist yet. <Link href={`/jobs/${job.id}`} style={{ color: "var(--accent)" }}>Run screening first.</Link>
      </div>
    );
  }
  const cutoff = plan?.cutoffValue ?? 5;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shortlist — {job.title}</h1>
          <p>
            <Link href={`/jobs/${job.id}`} style={{ color: "var(--muted)" }}>← Role</Link>
            {"  ·  "}{ranking.candidates.length} candidates scored against approved plan v{ranking.planVersion}
          </p>
        </div>
      </div>

      <div className="info" style={{ marginBottom: "1.5rem" }}>
        Top {cutoff} shown as the recommended shortlist. Every score cites verbatim resume evidence.
        Advancing a candidate (Gate 2) queues an interview invite and opens their interview.
      </div>

      {ranking.candidates.map((c) => {
        const recommended = c.rank <= cutoff && c.knockoutFailures.length === 0;
        const interview = db.interviews.find((i) => i.jobId === job.id && i.candidateId === c.candidateId);
        const scorecard = db.scorecards.find((s) => s.jobId === job.id && s.candidateId === c.candidateId);
        return (
          <div className="card" key={c.candidateId} style={recommended ? { borderColor: "#a5b4fc" } : {}}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="row" style={{ gap: ".75rem" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)", width: 36 }}>#{c.rank}</div>
                <div>
                  <h2>{c.name}</h2>
                  <div className="row" style={{ gap: ".4rem", marginTop: ".25rem" }}>
                    <span className="badge indigo">Score {c.overallScore}/100</span>
                    <span className={`badge ${confBadge(c.confidence)}`}>{c.confidence} confidence</span>
                    {recommended && <span className="badge green">Recommended</span>}
                    {c.knockoutFailures.length > 0 && <span className="badge red">Knockout: {c.knockoutFailures.length}</span>}
                    {interview && <span className="badge blue">{interview.status === "completed" ? "Interviewed" : "Invited"}</span>}
                    {scorecard && <span className="badge amber">Rec: {scorecard.recommendation.value}</span>}
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: ".5rem" }}>
                {interview ? (
                  <Link className="btn secondary" href={`/jobs/${job.id}/candidate/${c.candidateId}`}>Open →</Link>
                ) : (
                  <>
                    <Link className="btn ghost" href={`/jobs/${job.id}/candidate/${c.candidateId}`}>Details</Link>
                    <form action={advanceCandidate.bind(null, job.id, c.candidateId)}>
                      <button className="btn green">Advance to interview</button>
                    </form>
                  </>
                )}
              </div>
            </div>

            <p className="small" style={{ margin: ".75rem 0 0" }}>{c.summary}</p>

            <details style={{ marginTop: ".5rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: ".85rem", color: "var(--accent)" }}>
                Show evidence ({c.criterionScores.length} criteria)
              </summary>
              <table style={{ marginTop: ".75rem" }}>
                <thead><tr><th>Criterion</th><th style={{ width: 120 }}>Score</th><th>Evidence (verbatim)</th></tr></thead>
                <tbody>
                  {c.criterionScores.map((s) => (
                    <tr key={s.criterionId}>
                      <td style={{ fontWeight: 600 }}>{s.label}</td>
                      <td>
                        <div className="row" style={{ gap: ".4rem" }}>
                          <div className="score-bar"><div style={{ width: `${s.score}%`, background: s.score < 40 ? "var(--red)" : "var(--accent)" }} /></div>
                          <span className="small">{s.score}</span>
                        </div>
                      </td>
                      <td><div className="evidence">&ldquo;{s.evidence}&rdquo;</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        );
      })}
    </>
  );
}
