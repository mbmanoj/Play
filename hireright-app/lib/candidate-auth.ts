import { cookies } from "next/headers";
import { signSession, verifySession } from "./auth";
import { getRepo } from "./db/repo";
import { CandidateUser } from "./types";

// ── Candidate portal auth (M8) ────────────────────────────────────────
// A SEPARATE session domain from the employer app. Distinct cookie, reusing
// the same HMAC signing, so an employer cookie can never resolve to a
// candidate and vice-versa — the two personas are cryptographically isolated.

export const CANDIDATE_COOKIE = "hr_cand_session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30 // 30 days
};

export async function getCandidate(): Promise<CandidateUser | null> {
  const raw = cookies().get(CANDIDATE_COOKIE)?.value;
  const id = verifySession(raw);
  if (!id) return null;
  return getRepo().candidateUserById(id);
}

export function setCandidateSession(id: string) {
  cookies().set(CANDIDATE_COOKIE, signSession(id), COOKIE_OPTIONS);
}

export function clearCandidateSession() {
  cookies().delete(CANDIDATE_COOKIE);
}
