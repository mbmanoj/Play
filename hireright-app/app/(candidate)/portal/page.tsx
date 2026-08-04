import { redirect } from "next/navigation";
import { getCandidate } from "@/lib/candidate-auth";
import { candidateRegister } from "@/app/candidate-actions";

export default async function PortalLogin({ searchParams }: { searchParams: { error?: string } }) {
  if (await getCandidate()) redirect("/portal/jobs");
  const err = searchParams.error === "missing" ? "Please enter your name and email." : null;

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="logo">Hireright ✦</div>
        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          Find roles matched to your resume, see exactly where you stand, and practise with an AI mock interview.
        </p>

        {err && <div className="warn" style={{ marginBottom: "1rem", textAlign: "left" }}>{err}</div>}

        <form action={candidateRegister} style={{ textAlign: "left" }}>
          <div className="field">
            <label className="small muted">Name</label>
            <input name="name" required placeholder="Jordan Rivera" style={INPUT} />
          </div>
          <div className="field">
            <label className="small muted">Email</label>
            <input name="email" type="email" required placeholder="you@example.com" style={INPUT} />
          </div>
          <div className="field">
            <label className="small muted">Paste your resume (optional — powers matching)</label>
            <textarea name="resumeText" rows={5} placeholder="Senior engineer, 6 years. Python, React, AWS…" style={INPUT} />
          </div>
          <button className="btn" style={{ width: "100%", justifyContent: "center" }}>
            Continue
          </button>
        </form>

        <p className="small muted" style={{ marginTop: "1rem" }}>
          Demo sign-in · returning? Use the same email to pick up where you left off.
        </p>
        <a href="/login" className="small muted" style={{ display: "block", marginTop: ".5rem" }}>
          I&apos;m hiring — employer sign-in →
        </a>
      </div>
    </div>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: ".55rem .7rem",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: ".9rem",
  fontFamily: "inherit"
};
