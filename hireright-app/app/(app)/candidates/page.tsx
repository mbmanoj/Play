import { getRepo } from "@/lib/db/repo";
import { requireSession } from "@/lib/auth";
import FolderUpload from "@/components/FolderUpload";

export default async function Candidates() {
  const user = await requireSession();
  const db = await getRepo().snapshot();
  const candidates = db.candidates.filter((c) => c.clientId === user.clientId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Candidates</h1>
          <p>{candidates.length} resumes in the pool — ingested from folders/files.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginBottom: ".75rem" }}>Ingest resumes (folder / files)</h3>
        <FolderUpload />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: ".75rem" }}>Pool</h3>
        <table>
          <thead><tr><th>Name</th><th>Source</th><th>Skills detected</th><th>Ingested</th></tr></thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td><span className="badge gray">{c.source}</span></td>
                <td className="small">{c.skills.slice(0, 6).join(", ") || <span className="muted">—</span>}</td>
                <td className="muted small">{new Date(c.ingestedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
