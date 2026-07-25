import { NextRequest, NextResponse } from "next/server";
import { googleExchange } from "@/lib/oauth";
import { getRepo } from "@/lib/db/repo";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { uid } from "@/lib/ids";
import { ClientUser } from "@/lib/types";

// GET /api/auth/google/callback — exchange code, find-or-create user, sign in.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("hr_oauth_state")?.value;

  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  if (!code || !state || !cookieState || state !== cookieState) return fail("state");

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const profile = await googleExchange(code, redirectUri);

    const repo = getRepo();
    const db = await repo.snapshot();
    let user = db.users.find((u) => u.email.toLowerCase() === profile.email.toLowerCase());

    if (!user) {
      // New sign-in: attach to the (demo) client as a recruiter.
      const clientId = db.clients[0]?.id || "client_demo";
      user = {
        id: uid("user"),
        clientId,
        name: profile.name,
        email: profile.email,
        role: "recruiter"
      } as ClientUser;
      await repo.createUser(user);
    }

    const res = NextResponse.redirect(new URL("/dashboard", origin));
    res.cookies.set(SESSION_COOKIE, signSession(user.id), SESSION_COOKIE_OPTIONS);
    res.cookies.delete("hr_oauth_state");
    return res;
  } catch (e) {
    return fail("exchange_failed");
  }
}
