// ── Google OAuth (authorization-code flow, no external library) ───────
// Self-contained: builds the auth URL, exchanges the code, fetches the
// user's email/name. Enabled only when GOOGLE_CLIENT_ID + SECRET are set.

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  name: string;
}

export async function googleExchange(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status}).`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google token response missing access_token.");

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status}).`);
  const info = (await infoRes.json()) as { email?: string; name?: string };
  if (!info.email) throw new Error("Google profile missing email.");
  return { email: info.email, name: info.name || info.email.split("@")[0] };
}
