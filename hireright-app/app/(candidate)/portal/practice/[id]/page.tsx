import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCandidate } from "@/lib/candidate-auth";
import { getRepo } from "@/lib/db/repo";
import { practiceQuestions } from "@/lib/practice";
import { submitPractice } from "@/app/candidate-actions";

function band(score: number): string {
  return score >= 75 ? "green" : score >= 50 ? "amber" : "red";
}

export default async function Practice({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { done?: string };
}) {
  const me = await getCandidate();
  if (!me) redirect("/portal");
  const db = await getRepo().snapshot();
  const job = db.jobs.find((j) => j.id === params.id);
  if (!job) notFound();

  // Results view — show a just-completed (or past) private mock.
  if (searchParams.done) {
    const mock = db.mockInterviews.find((m) => m.id === searchParams.done && m.candidateUserId === me.id);
    if (!mock) notFound();
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Practice results — {mock.jobTitle}</h1>
            <p>Private coaching. Only you can see this — it&apos;s never shared with any employer.</p>
          </div>
          <Link className="btn ghost" href={`/portal/jobs/${job.id}`}>← Back to role</Link>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>Overall</strong>
            <span className={`badge ${band(mock.overallScore)}`}>{mock.overallScore}/100</span>
          </div>
          <div className="score-bar" style={{ marginTop: ".5rem" }}><div style={{ width: `${mock.overallScore}%` }} /></div>
        </div>

        {mock.turns.map((t, i) => (
          <div className="card" key={i}>
            <div className="small muted" style={{ marginBottom: ".3rem" }}>Question {i + 1}</div>
            <strong style={{ display: "block", marginBottom: ".4rem" }}>{t.question}</strong>
            <div className="evidence" style={{ marginBottom: ".5rem" }}>{t.answer || <span className="muted">(no answer)</span>}</div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: ".3rem" }}>
              <span className="small muted">Coaching</span>
              <span className={`badge ${band(t.score)}`}>{t.score}/100</span>
            </div>
            <p className="small">{t.feedback}</p>
          </div>
        ))}

        <form action={submitPractice.bind(null, job.id)} style={{ marginTop: "1rem" }}>
          {/* Re-render blank inputs so they can try again */}
          {practiceQuestions(job).map((q, i) => <input key={i} type="hidden" name={`a${i}`} value="" />)}
          <Link className="btn" href={`/portal/practice/${job.id}`}>Try again</Link>
        </form>
      </>
    );
  }

  // Practice form.
  const questions = practiceQuestions(job);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mock interview — {job.title}</h1>
          <p>Answer as you would in a real first round. You&apos;ll get instant, private coaching on each answer. Nothing here is shared with employers.</p>
        </div>
        <Link className="btn ghost" href={`/portal/jobs/${job.id}`}>← Back to role</Link>
      </div>

      <form action={submitPractice.bind(null, job.id)}>
        {questions.map((q, i) => (
          <div className="card" key={q.id}>
            <div className="small muted" style={{ marginBottom: ".3rem" }}>Question {i + 1} of {questions.length}</div>
            <strong style={{ display: "block", marginBottom: ".5rem" }}>{q.text}</strong>
            <textarea
              name={`a${i}`}
              rows={4}
              placeholder="Structure it as Situation → Task → Action → Result, with a concrete outcome…"
              style={{ width: "100%", padding: ".6rem .7rem", border: "1px solid #cbd5e1", borderRadius: 8, fontFamily: "inherit", fontSize: ".85rem" }}
            />
          </div>
        ))}
        <button className="btn">Get my coaching →</button>
      </form>
    </>
  );
}
