import { read } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { adverseImpact } from "@/lib/compliance";

export default function Compliance() {
  const user = requireSession();
  const db = read();
  const candidates = db.candidates.filter((c) => c.clientId === user.clientId);
  const audit = [...db.audit].reverse();

  const latest = [...db.rankings].reverse()[0];
  const job = latest ? db.jobs.find((j) => j.id === latest.jobId) : null;
  const plan = latest ? db.plans.find((p) => p.jobId === latest.jobId && p.status === "approved") : null;
  const stats = latest ? adverseImpact(candidates, latest, plan?.cutoffValue ?? 5) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compliance</h1>
          <p>Immutable audit trail + adverse-impact monitoring. Demographics are firewalled from scoring.</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: ".5rem" }}>Adverse-impact dashboard</h3>
        {!latest ? (
          <p className="muted">Run a screening to compute selection-rate impact ratios (four-fifths rule).</p>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: ".75rem" }}>
              Based on the latest shortlist for &ldquo;{job?.title}&rdquo;. Impact ratio = group selection rate ÷ highest group rate.
              Flagged below 0.80 (four-fifths rule). This data is computed for monitoring only and never feeds scoring.
            </p>
            <table>
              <thead><tr><th>Dimension</th><th>Group</th><th>Selected / Total</th><th>Selection rate</th><th>Impact ratio</th><th></th></tr></thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i}>
                    <td>{s.dimension}</td>
                    <td style={{ fontWeight: 600 }}>{s.group}</td>
                    <td>{s.selected} / {s.total}</td>
                    <td>{Math.round(s.selectionRate * 100)}%</td>
                    <td>{s.impactRatio === null ? "—" : s.impactRatio.toFixed(2)}</td>
                    <td>{s.flagged ? <span className="badge red">⚠ below 0.80</span> : <span className="badge green">ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: ".5rem" }}>Audit trail <span className="muted small">(append-only · {audit.length} events)</span></h3>
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.eventId}>
                <td className="muted small" style={{ whiteSpace: "nowrap" }}>{new Date(e.timestamp).toLocaleString()}</td>
                <td><span className={`badge ${e.actorType === "ai" ? "indigo" : e.actorType === "system" ? "gray" : "green"}`}>{e.actorType}</span></td>
                <td style={{ fontWeight: 600 }}><code>{e.action}</code></td>
                <td className="small muted">{e.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
