import { redirect } from "next/navigation";
import { getCandidate } from "@/lib/candidate-auth";
import { updateResume } from "@/app/candidate-actions";

export default async function Profile({ searchParams }: { searchParams: { saved?: string } }) {
  const me = await getCandidate();
  if (!me) redirect("/portal");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p>Your resume powers role matching and mock-interview questions. Keep it current.</p>
        </div>
      </div>

      {searchParams.saved && <div className="info" style={{ marginBottom: "1rem" }}>✓ Profile saved — matches updated.</div>}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>{me.name}</strong>
            <div className="muted small">{me.email}</div>
          </div>
        </div>
        <div style={{ marginTop: ".6rem" }}>
          <span className="small muted">Detected skills: </span>
          {me.skills.length ? (
            me.skills.map((s) => <span key={s} className="badge indigo" style={{ marginRight: ".25rem" }}>{s}</span>)
          ) : (
            <span className="small muted">none yet — paste your resume below</span>
          )}
        </div>
      </div>

      <div className="card">
        <form action={updateResume}>
          <div className="field">
            <label className="small muted">Resume text</label>
            <textarea
              name="resumeText"
              rows={12}
              defaultValue={me.resumeText}
              placeholder="Paste your resume here…"
              style={{ width: "100%", padding: ".6rem .7rem", border: "1px solid #cbd5e1", borderRadius: 8, fontFamily: "inherit", fontSize: ".85rem" }}
            />
          </div>
          <button className="btn">Save profile</button>
        </form>
      </div>
    </>
  );
}
