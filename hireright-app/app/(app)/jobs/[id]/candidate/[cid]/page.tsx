import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";
import { runInterview, scoreInterviewAction, triggerAction, advanceCandidate } from "@/app/actions";

function recBadge(v: string) {
  return v === "advance" ? "green" : v === "hold" ? "amber" : "red";
}

function emailAddress(to: string): string {
  const m = /<([^>]+)>/.exec(to);
  return m ? m[1] : to;
}
function mailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(emailAddress(to))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function CandidateDetail({ params }: { params: { id: string; cid: string } }) {
  await requireSession();
  const db = await getRepo().snapshot();
  const job = db.jobs.find((j) => j.id === params.id);
  const cand = db.candidates.find((c) => c.id === params.cid);
  if (!job || !cand) notFound();

  const ranking = [...db.rankings].reverse().find((r) => r.jobId === job.id);
  const ranked = ranking?.candidates.find((c) => c.candidateId === cand.id);
  const interview = db.interviews.find((i) => i.jobId === job.id && i.candidateId === cand.id);
  const scorecard = db.scorecards.find((s) => s.jobId === job.id && s.candidateId === cand.id);
  const actions = db.actions.filter((a) => a.jobId === job.id && a.candidateId === cand.id);
  const drafts = db.outbox.filter((m) => m.candidateId === cand.id).slice().reverse();

  // ── M-Status timeline ──────────────────────────────────────────────
  const events: { t: string; label: string }[] = [];
  if (ranking) events.push({ t: ranking.createdAt, label: `Screened — ranked #${ranked?.rank} (${ranked?.overallScore}/100)` });
  if (interview) {
    events.push({ t: interview.createdAt, label: "Advanced to interview — invite drafted (Gate 2)" });
    if (interview.completedAt) events.push({ t: interview.completedAt, label: `First-round interview completed (${interview.transcript.length} Q&A)` });
  }
  if (scorecard) events.push({ t: scorecard.createdAt, label: `Scored — ${scorecard.overallScore}/100, recommendation "${scorecard.recommendation.value}"` });
  actions.forEach((a) => events.push({ t: a.triggeredAt, label: a.detail + " (Gate 3)" }));
  events.sort((a, b) => a.t.localeCompare(b.t));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{cand.name}</h1>
          <p><Link href={`/jobs/${job.id}/shortlist`} style={{ color: "var(--muted)" }}>← Shortlist</Link> · {job.title}</p>
        </div>
      </div>

      {/* Status timeline (M-Status) */}
      <div className="card">
        <h3 style={{ marginBottom: ".75rem" }}>Status timeline</h3>
        {events.length === 0 ? (
          <p className="muted small">Not yet advanced. This candidate is on the ranked shortlist.</p>
        ) : (
          <ul style={{ margin: "0 0 0 1.1rem" }}>
            {events.map((e, i) => (
              <li key={i} style={{ marginBottom: ".35rem" }}>
                <span className="muted small" style={{ marginRight: ".5rem" }}>{new Date(e.t).toLocaleString()}</span>
                {e.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interview (M4/M5) */}
      <div className="card">
        <h3 style={{ marginBottom: ".5rem" }}>First-round interview <span className="muted small">(email · async)</span></h3>
        {!interview ? (
          <form action={advanceCandidate.bind(null, job.id, cand.id)}>
            <p className="muted small" style={{ marginBottom: ".5rem" }}>Advancing sends an interview invite (Gate 2).</p>
            <button className="btn green">Advance to interview</button>
          </form>
        ) : interview.status === "invited" ? (
          <form action={runInterview.bind(null, interview.id)}>
            <div className="info" style={{ marginBottom: ".75rem" }}>
              Interview invite drafted. Run the AI first-round interview — AI use is disclosed to the candidate.
            </div>
            <button className="btn">Run interview</button>
          </form>
        ) : (
          <div>
            {interview.transcript.map((t, i) => (
              <div key={i} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600 }}>Q{i + 1}. {t.question}</div>
                <div className="evidence" style={{ borderLeftColor: "var(--green)", fontStyle: "normal" }}>{t.answer}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email drafts for this candidate — nothing auto-sent */}
      {drafts.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: ".25rem" }}>Email drafts</h3>
          <p className="muted small" style={{ marginBottom: ".75rem" }}>
            Nothing is auto-sent. Open a draft in your email client to review and send.
          </p>
          {drafts.map((m) => (
            <div key={m.id} style={{ borderTop: "1px solid var(--border)", paddingTop: ".6rem", marginTop: ".6rem" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: ".25rem" }}>
                <strong>{m.subject}</strong>
                <span className={`badge ${m.kind === "invite" ? "blue" : "green"}`}>{m.kind} · draft</span>
              </div>
              <div className="muted small" style={{ marginBottom: ".4rem" }}>To: {m.to} · {new Date(m.createdAt).toLocaleString()}</div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".82rem", color: "#334155", marginBottom: ".5rem" }}>{m.body}</pre>
              <a className="btn secondary" href={mailto(m.to, m.subject, m.body)}>✉ Open in your email client</a>
            </div>
          ))}
        </div>
      )}

      {/* Scorecard (M6) */}
      {interview?.status === "completed" && (
        <div className="card">
          <h3 style={{ marginBottom: ".5rem" }}>Scorecard</h3>
          {!scorecard ? (
            <form action={scoreInterviewAction.bind(null, interview.id)}>
              <button className="btn">Score interview</button>
            </form>
          ) : (
            <>
              <div className="row" style={{ gap: ".5rem", marginBottom: ".75rem" }}>
                <span className="badge indigo">Overall {scorecard.overallScore}/100</span>
                <span className={`badge ${recBadge(scorecard.recommendation.value)}`}>Recommendation: {scorecard.recommendation.value}</span>
                <span className="badge gray">not final — client decides</span>
              </div>
              <p className="small muted" style={{ marginBottom: ".75rem" }}>{scorecard.recommendation.rationale}</p>
              <table>
                <thead><tr><th>Competency</th><th style={{ width: 90 }}>Score</th><th>Evidence (from answer)</th></tr></thead>
                <tbody>
                  {scorecard.competencyScores.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.label}</td>
                      <td>{s.score}</td>
                      <td><div className="evidence">&ldquo;{s.evidence}&rdquo;</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Client actions (M7 — Gate 3) */}
      {scorecard && (
        <div className="card">
          <h3 style={{ marginBottom: ".5rem" }}>Client actions <span className="muted small">(you decide — never the AI)</span></h3>
          <p className="muted small" style={{ marginBottom: ".5rem" }}>These create a draft email for you to review — nothing is auto-sent.</p>
          <div className="row" style={{ gap: ".5rem" }}>
            <form action={triggerAction.bind(null, job.id, cand.id, "send_email")}>
              <button className="btn secondary">✉ Draft email</button>
            </form>
            <form action={triggerAction.bind(null, job.id, cand.id, "schedule_meeting")}>
              <button className="btn secondary">📅 Draft meeting invite</button>
            </form>
          </div>
          {actions.length > 0 && (
            <ul className="small muted" style={{ margin: ".75rem 0 0 1.1rem" }}>
              {actions.map((a) => <li key={a.id}>{a.detail} — {new Date(a.triggeredAt).toLocaleString()}</li>)}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
