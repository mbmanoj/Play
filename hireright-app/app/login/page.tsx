import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";
import { login } from "@/app/actions";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this server.",
  state: "Sign-in expired or was tampered with. Please try again.",
  exchange_failed: "Google sign-in failed. Please try again."
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  if (await getSession()) redirect("/dashboard");
  const hasGoogle = googleConfigured();
  const err = searchParams.error ? ERRORS[searchParams.error] || "Sign-in failed." : null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">Hireright ✦</div>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          AI recruiting — JD in, defensible shortlist out.
        </p>

        {err && (
          <div className="warn" style={{ marginBottom: "1rem", textAlign: "left" }}>{err}</div>
        )}

        {hasGoogle && (
          <a href="/api/auth/google" className="btn secondary"
            style={{ width: "100%", justifyContent: "center", marginBottom: ".75rem" }}>
            Continue with Google
          </a>
        )}

        <form action={login}>
          <button className="btn" style={{ width: "100%", justifyContent: "center" }}>
            {hasGoogle ? "Continue as Demo Recruiter" : "Sign in as Demo Recruiter"}
          </button>
        </form>

        <p className="small muted" style={{ marginTop: "1rem" }}>
          {hasGoogle ? "Google OAuth enabled" : "Demo mode"} · Acme Corp workspace
        </p>
      </div>
    </div>
  );
}
