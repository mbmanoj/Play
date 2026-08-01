import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";

function emailAddress(to: string): string {
  const m = /<([^>]+)>/.exec(to);
  return m ? m[1] : to;
}

function mailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(emailAddress(to))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function Drafts() {
  const user = await requireSession();
  const db = await getRepo().snapshot();
  const drafts = [...db.outbox].filter((m) => m.clientId === user.clientId).reverse();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email drafts</h1>
          <p>Nothing is auto-sent. Each interview invite and client action creates a <strong>draft to review</strong>. Open it in your email client to send, or connect Gmail to create the draft there.</p>
        </div>
      </div>

      <div className="info" style={{ marginBottom: "1rem" }}>
        <strong>Connect your email client:</strong> &ldquo;Open in your email client&rdquo; uses a <code>mailto:</code> link — it launches your default mail app (Gmail, Outlook, Apple Mail) with the draft pre-filled, so you review and send. A server-side &ldquo;Create draft in Gmail&rdquo; integration can be added on request.
      </div>

      {drafts.length === 0 ? (
        <div className="card muted">No drafts yet. Advance a candidate or trigger a client action to create one.</div>
      ) : (
        drafts.map((m) => (
          <div className="card" key={m.id}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: ".35rem" }}>
              <strong>{m.subject}</strong>
              <span className={`badge ${m.kind === "invite" ? "blue" : "green"}`}>{m.kind} · draft</span>
            </div>
            <div className="muted small" style={{ marginBottom: ".5rem" }}>To: {m.to} · created {new Date(m.createdAt).toLocaleString()}</div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".85rem", color: "#334155", marginBottom: ".75rem" }}>{m.body}</pre>
            <a className="btn secondary" href={mailto(m.to, m.subject, m.body)}>✉ Open in your email client</a>
          </div>
        ))
      )}
    </>
  );
}
