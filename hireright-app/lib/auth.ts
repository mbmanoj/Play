import { cookies } from "next/headers";
import { getRepo } from "./db/repo";
import { ClientUser } from "./types";

// ── Mock auth (M0) ────────────────────────────────────────────────────
// A simple cookie-based session for the demo. Real SSO/auth slots in here.
const COOKIE = "hr_session";

export async function getSession(): Promise<ClientUser | null> {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  return getRepo().userById(id);
}

export function setSession(userId: string) {
  cookies().set(COOKIE, userId, { httpOnly: true, path: "/", sameSite: "lax" });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function requireSession(): Promise<ClientUser> {
  const s = await getSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}
