import Link from "next/link";
import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";
import { stageLabel } from "@/lib/pipeline/state";
import { resetDemo } from "@/app/actions";

const STAGE_BADGE: Record<string, string> = {
  JD_UPLOADED: "gray",
  PLAN_GENERATED: "indigo",
  PLAN_APPROVED: "amber",
  SCREENING: "blue",
  SCREEN_COMPLETE: "green"
};

export default async function Dashboard() {
  const user = await requireSession();
  const db = await getRepo().snapshot();
  const jobs = db.jobs.filter((j) => j.clientId === user.clientId);
  const candidates = db.candidates.filter((c) => c.clientId === user.clientId);
  const shortlisted = db.rankings.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{db.clients.find((c) => c.id === user.clientId)?.name} workspace</p>
        </div>
        <div className="row">
          <form action={resetDemo}><button className="btn ghost">Reset demo</button></form>
          <Link className="btn" href="/jobs/new">+ New role</Link>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: "1.5rem" }}>
        <div className="stat"><div className="n">{jobs.length}</div><div className="l">Open roles</div></div>
        <div className="stat"><div className="n">{candidates.length}</div><div className="l">Candidates in pool</div></div>
        <div className="stat"><div className="n">{shortlisted}</div><div className="l">Shortlists generated</div></div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1rem" }}>Roles</h2>
        {jobs.length === 0 ? (
          <p className="muted">
            No roles yet. <Link href="/jobs/new" style={{ color: "var(--accent)", fontWeight: 600 }}>Upload a JD</Link> to generate a hiring plan.
          </p>
        ) : (
          <table>
            <thead><tr><th>Role</th><th>Stage</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 600 }}>{j.title}</td>
                  <td><span className={`badge ${STAGE_BADGE[j.stage] || "gray"}`}>{stageLabel(j.stage)}</span></td>
                  <td className="muted small">{new Date(j.createdAt).toLocaleDateString()}</td>
                  <td><Link href={`/jobs/${j.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
