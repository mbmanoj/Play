"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { candidateLogout } from "@/app/candidate-actions";

const LINKS = [
  { href: "/portal/jobs", label: "Browse roles" },
  { href: "/portal/applications", label: "My applications" },
  { href: "/portal/profile", label: "My profile" }
];

export default function CandidateNav({ userName }: { userName: string }) {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">Hireright <span>✦</span></div>
      <div className="small muted" style={{ margin: "-.5rem 0 1rem" }}>Candidate portal</div>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="foot">
        <div style={{ marginBottom: ".5rem" }}>
          {userName} <span className="badge green" style={{ marginLeft: ".25rem" }}>candidate</span>
        </div>
        <form action={candidateLogout}>
          <button className="btn ghost" style={{ color: "#c7d2fe", borderColor: "rgba(255,255,255,.2)" }}>
            Sign out
          </button>
        </form>
        <a href="/login" className="small muted" style={{ display: "block", marginTop: ".75rem" }}>
          For employers →
        </a>
      </div>
    </aside>
  );
}
