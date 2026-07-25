import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { login } from "@/app/actions";

export default function LoginPage() {
  if (getSession()) redirect("/dashboard");
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">Hireright ✦</div>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          AI recruiting — JD in, defensible shortlist out.
        </p>
        <form action={login}>
          <button className="btn" style={{ width: "100%", justifyContent: "center" }}>
            Sign in as Demo Recruiter
          </button>
        </form>
        <p className="small muted" style={{ marginTop: "1rem" }}>
          Demo mode · Acme Corp workspace
        </p>
      </div>
    </div>
  );
}
