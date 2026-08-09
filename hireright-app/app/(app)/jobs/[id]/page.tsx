import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";
import Stages from "@/components/Stages";
import { updatePlan, approvePlan, runScreening } from "@/app/actions";

export default async function JobPage({ params }: { params: { id: string } }) {
  await requireSession();
  const db = await getRepo().snapshot();
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

            <h3 style={{ margin: "1rem 0 .5rem" }}>Criteria <span className="muted small">(fully editable — the AI&apos;s draft is a starting point)</span></h3>
            <table>
              <thead><tr><th>Requirement</th><th>Type</th><th>Weight</th><th>Knockout</th><th>Remove</th></tr></thead>
              <tbody>
                {plan.criteria.map((c) => (
                  <tr key={c.id}>
                    <td><input type="text" name={`label_${c.id}`} defaultValue={c.label} style={{ width: "100%", minWidth: 220 }} /></td>
                    <td>
                      <select name={`kind_${c.id}`} defaultValue={c.kind}>
                        <option value="must_have">Must</option>
                        <option value="nice_to_have">Nice</option>
                      </select>
                    </td>
                    <td><input type="number" step="0.01" min="0" max="1" name={`weight_${c.id}`} defaultValue={c.weight} style={{ width: 80 }} /></td>
                    <td><input type="checkbox" name={`knockout_${c.id}`} defaultChecked={c.isKnockout} /></td>
                    <td>
                      <button
                        name={`remove_${c.id}`}
                        value="on"
                        formAction={updatePlan}
                        aria-label={`Remove "${c.label}"`}
                        title="Remove this criterion"
                        style={{ background: "none", border: "none", color: "#dc2626", fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, padding: ".2rem .45rem" }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td><input type="text" name="new_label" placeholder="+ Add a requirement (e.g. 5+ years Python)" style={{ width: "100%", minWidth: 220 }} /></td>
                  <td>
                    <select name="new_kind" defaultValue="must_have">
                      <option value="must_have">Must</option>
                      <option value="nice_to_have">Nice</option>
                    </select>
                  </td>
                  <td><input type="number" step="0.01" min="0" max="1" name="new_weight" defaultValue={0.1} style={{ width: 80 }} /></td>
                  <td><input type="checkbox" name="new_knockout" /></td>
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="muted small" style={{ marginTop: ".4rem" }}>
              Edit any requirement text, switch Must/Nice, click <strong>✕</strong> to remove a row, or fill the last row to add one — then <strong>Save edits</strong>. Renaming a requirement re-derives what the screener looks for.
            </p>

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
