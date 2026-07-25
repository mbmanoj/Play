import { requireSession } from "@/lib/auth";
import { CONNECTORS, connectorEnabled } from "@/lib/ingestion";
import { ACTIVE_PROVIDER } from "@/lib/ai";

export default function Integrations() {
  requireSession();
  const provider = ACTIVE_PROVIDER();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p>Connect resume sources and the AI provider. Credentials are read from environment / .env.local — never entered in chat.</p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: ".25rem" }}>AI provider</h3>
        <p className="muted small" style={{ marginBottom: ".75rem" }}>Plan generation & candidate ranking.</p>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><strong>{provider === "mock" ? "Mock AI (deterministic)" : "Anthropic Claude (claude-opus-5)"}</strong>
            <div className="muted small">Set <code>AI_PROVIDER=anthropic</code> + <code>ANTHROPIC_API_KEY</code> in <code>.env.local</code> to use real Claude. The mock stays as an automatic per-call fallback.</div>
          </div>
          <span className={`badge ${provider === "mock" ? "indigo" : "green"}`}>{provider === "mock" ? "Mock (active)" : "Claude (live)"}</span>
        </div>
      </div>

      <h3 style={{ margin: "1.5rem 0 .75rem" }}>Resume sources</h3>
      <div className="grid cols-2">
        {CONNECTORS.map((c) => {
          const on = connectorEnabled(c);
          return (
            <div className="card" key={c.id} style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: ".5rem" }}>
                <strong>{c.name}</strong>
                <span className={`badge ${c.status === "live" ? "green" : on ? "blue" : "gray"}`}>
                  {c.status === "live" ? "Live" : on ? "Configured" : "Coming soon"}
                </span>
              </div>
              <p className="muted small">{c.description}</p>
              {c.requiresCredential && (
                <p className="small" style={{ marginTop: ".5rem" }}>
                  Needs <code>{c.requiresCredential}</code> in <code>.env.local</code>.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="info" style={{ marginTop: "1rem" }}>
        <strong>Why no LinkedIn yet?</strong> LinkedIn has no open resume API. Enabling it requires either
        LinkedIn partner approval (Recruiter System Connect) or a 3rd-party aggregator with a ToS/legal review.
        Folder ingestion is live and covers the demo end-to-end.
      </div>
    </>
  );
}
