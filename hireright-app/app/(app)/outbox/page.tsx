import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";

export default async function Outbox() {
  const user = await requireSession();
  const db = await getRepo().snapshot();
  const messages = [...db.outbox].filter((m) => m.clientId === user.clientId).reverse();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Outbox</h1>
          <p>Mocked email delivery — interview invites and client-triggered actions are recorded here (no real sending). Wire real email later via an <code>.env.local</code> key.</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="card muted">No messages yet. Advance a candidate or trigger a client action to queue one.</div>
      ) : (
        messages.map((m) => (
          <div className="card" key={m.id}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: ".35rem" }}>
              <strong>{m.subject}</strong>
              <span className={`badge ${m.kind === "invite" ? "blue" : "green"}`}>{m.kind}</span>
            </div>
            <div className="muted small" style={{ marginBottom: ".5rem" }}>To: {m.to} · {new Date(m.createdAt).toLocaleString()}</div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: ".85rem", color: "#334155" }}>{m.body}</pre>
          </div>
        ))
      )}
    </>
  );
}
