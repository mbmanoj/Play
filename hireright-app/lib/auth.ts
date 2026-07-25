import { cookies } from "next/headers";
import { read } from "./db";
import { ClientUser } from "./types";

// ── Mock auth (M0) ────────────────────────────────────────────────────
// A simple cookie-based session for the demo. Real SSO/auth slots in here.
const COOKIE = "hr_session";

export function getSession(): ClientUser | null {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  return read().users.find((u) => u.id === id) || null;
}

export function setSession(userId: string) {
  cookies().set(COOKIE, userId, { httpOnly: true, path: "/", sameSite: "lax" });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export function requireSession(): ClientUser {
  const s = getSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}
