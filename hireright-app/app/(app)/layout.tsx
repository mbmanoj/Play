import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="shell">
      <Sidebar userName={session.name} role={session.role} />
      <main className="main">{children}</main>
    </div>
  );
}
