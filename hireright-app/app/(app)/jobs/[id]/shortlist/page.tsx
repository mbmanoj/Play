import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";

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
        Top {cutoff} shown as the recommended shortlist. Every score cites verbatim resume evidence
        (&ldquo;the receipts&rdquo;). Knockout failures are <strong>flagged, not auto-rejected</strong> — you decide.
      </div>

      {ranking.candidates.map((c) => {
        const recommended = c.rank <= cutoff && c.knockoutFailures.length === 0;
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
                  </div>
                </div>
              </div>
            </div>

            <p className="small" style={{ margin: ".75rem 0" }}>{c.summary}</p>

            <details>
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
