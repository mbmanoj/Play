import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { googleConfigured, googleAuthUrl } from "@/lib/oauth";

// GET /api/auth/google — start the OAuth flow.
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", origin));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/auth/google/callback`;

  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  res.cookies.set("hr_oauth_state", state, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600
  });
  return res;
}
