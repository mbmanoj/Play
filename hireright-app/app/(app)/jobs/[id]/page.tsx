import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import Stages from "@/components/Stages";
import { updatePlan, approvePlan, runScreening } from "@/app/actions";

export default function JobPage({ params }: { params: { id: string } }) {
  requireSession();
  const db = read();
  const job = db.jobs.find((j) => j.id === params.id);
  if (!job) notFound();
  const plan = db.plans.find((p) => p.jobId === job.id && p.status !== "superseded");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p><Link href="/dashboard" style={{ color: "var(--muted)" }}>← Dashboard</Link></p>
        </div>
      </div>

      <div className="card"><Stages current={job.stage} /></div>

      {plan && plan.status === "draft" && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: ".5rem" }}>
            <h2>Requirement Closure Plan <span className="badge indigo">Draft v{plan.version}</span></h2>
          </div>
          <p className="muted" style={{ marginBottom: "1rem" }}>{plan.roleSummary}</p>

          {plan.openQuestions.length > 0 && (
            <div className="warn" style={{ marginBottom: "1rem" }}>
              <strong>Open questions for you:</strong>
              <ul style={{ margin: ".4rem 0 0 1.1rem" }}>
                {plan.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          <form action={updatePlan}>
            <input type="hidden" name="planId" value={plan.planId} />

            <h3 style={{ margin: "1rem 0 .5rem" }}>Criteria</h3>
            <table>
              <thead><tr><th>Requirement</th><th>Type</th><th>Weight</th><th>Knockout</th></tr></thead>
              <tbody>
                {plan.criteria.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.label}</td>
                    <td><span className={`badge ${c.kind === "must_have" ? "amber" : "gray"}`}>{c.kind === "must_have" ? "Must" : "Nice"}</span></td>
                    <td><input type="number" step="0.01" min="0" max="1" name={`weight_${c.id}`} defaultValue={c.weight} style={{ width: 80 }} /></td>
                    <td><input type="checkbox" name={`knockout_${c.id}`} defaultChecked={c.isKnockout} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ margin: "1.5rem 0 .5rem" }}>Interview blueprint <span className="muted small">(editable)</span></h3>
            {plan.interviewBlueprint.map((q, i) => (
              <div className="field" key={q.id}>
                <label>Q{i + 1} {q.editedByClient && <span className="badge green">edited</span>}</label>
                <input type="text" name={`q_${q.id}`} defaultValue={q.text} />
              </div>
            ))}

            <div className="field" style={{ maxWidth: 240 }}>
              <label>Shortlist size (top N)</label>
              <input type="number" name="cutoffValue" defaultValue={plan.cutoffValue} min={1} />
            </div>

            <div className="row">
              <button className="btn secondary" formAction={updatePlan}>Save edits</button>
              <button className="btn green" formAction={approvePlan}>✓ Approve plan (Gate 1)</button>
            </div>
            <p className="muted small" style={{ marginTop: ".5rem" }}>
              Approving locks this plan version (immutable) and unlocks screening.
            </p>
          </form>
        </div>
      )}

      {plan && plan.status === "approved" && (
        <div className="card">
          <h2>Approved plan <span className="badge green">v{plan.version} · locked</span></h2>
          <p className="muted small" style={{ margin: ".3rem 0 1rem" }}>
            Approved by {plan.approvedBy} on {plan.approvedAt && new Date(plan.approvedAt).toLocaleString()}
          </p>
          <ul style={{ margin: "0 0 1rem 1.1rem" }}>
            {plan.criteria.map((c) => (
              <li key={c.id}>{c.label} — <span className="muted">weight {c.weight}{c.isKnockout ? ", knockout" : ""}</span></li>
            ))}
          </ul>
          {job.stage === "PLAN_APPROVED" ? (
            <form action={runScreening.bind(null, job.id)}>
              <button className="btn">Run screening → rank candidates</button>
            </form>
          ) : (
            <Link className="btn green" href={`/jobs/${job.id}/shortlist`}>View shortlist →</Link>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: ".5rem" }}>Job description</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".85rem", color: "#334155" }}>{job.jdText}</pre>
      </div>
    </>
  );
}
