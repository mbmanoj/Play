import crypto from "crypto";
import { cookies } from "next/headers";
import { getRepo } from "./db/repo";
import { ClientUser, Role } from "./types";

// ── Auth (M0 → real) ──────────────────────────────────────────────────
// Cookie-based session, HMAC-signed so the stored user id cannot be forged.
// Works for both the Google OAuth flow and the demo login. Set AUTH_SECRET
// in production; a dev fallback keeps the demo running with zero config.

export const SESSION_COOKIE = "hr_session";

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

export function signSession(userId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}

export function verifySession(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const userId = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(userId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7 // 7 days
};

// ── Session read/write (server components & actions) ──────────────────
export async function getSession(): Promise<ClientUser | null> {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const userId = verifySession(raw);
  if (!userId) return null;
  return getRepo().userById(userId);
}

export function setSession(userId: string) {
  cookies().set(SESSION_COOKIE, signSession(userId), SESSION_COOKIE_OPTIONS);
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export async function requireSession(): Promise<ClientUser> {
  const s = await getSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}

// ── RBAC ──────────────────────────────────────────────────────────────
export function canMutate(user: ClientUser): boolean {
  return user.role === "admin" || user.role === "recruiter";
}

export function assertCanMutate(user: ClientUser): void {
  if (!canMutate(user)) {
    throw new Error(`Forbidden: role "${user.role}" is read-only and cannot modify data.`);
  }
}

export function assertRole(user: ClientUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}.`);
  }
}
