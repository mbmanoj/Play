import { getCandidate } from "@/lib/candidate-auth";
import CandidateNav from "@/components/CandidateNav";

// The candidate portal is a separate persona from the employer app. When
// signed out, only the login page (/portal) renders (protected pages redirect
// there themselves); when signed in, we render the candidate chrome.
export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const me = await getCandidate();
  if (!me) return <>{children}</>;
  return (
    <div className="shell">
      <CandidateNav userName={me.name} />
      <main className="main">{children}</main>
    </div>
  );
}
