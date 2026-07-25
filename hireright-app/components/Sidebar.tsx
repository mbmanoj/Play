"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs/new", label: "+ New role (JD)" },
  { href: "/candidates", label: "Candidates" },
  { href: "/outbox", label: "Outbox" },
  { href: "/integrations", label: "Integrations" },
  { href: "/compliance", label: "Compliance" }
];

export default function Sidebar({ userName, role }: { userName: string; role: string }) {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">Hireright <span>✦</span></div>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={path === l.href || (l.href !== "/dashboard" && path.startsWith(l.href)) ? "active" : ""}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="foot">
        <div style={{ marginBottom: ".5rem" }}>
          {userName} <span className="badge indigo" style={{ marginLeft: ".25rem" }}>{role}</span>
        </div>
        <form action={logout}>
          <button className="btn ghost" style={{ color: "#c7d2fe", borderColor: "rgba(255,255,255,.2)" }}>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
