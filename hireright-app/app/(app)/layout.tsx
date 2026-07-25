import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");
  return (
    <div className="shell">
      <Sidebar userName={session.name} />
      <main className="main">{children}</main>
    </div>
  );
}
