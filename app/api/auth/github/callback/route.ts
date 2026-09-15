import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashSessionToken } from "@/app/chatgpt-auth";
import { getGitHubOAuthConfig } from "@/lib/github-app";

function cookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const config = getGitHubOAuthConfig();
  if (!config) return Response.json({ error: "GitHub sign-in is not configured." }, { status: 503 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code"); const state = url.searchParams.get("state");
  if (!code || !state || cookie(request, "commitkeep_oauth_state") !== state) return Response.json({ error: "GitHub sign-in request is invalid or expired." }, { status: 400 });
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: new URL("/api/auth/github/callback", request.url).toString() }) });
  const tokenResult = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenResult.access_token) return Response.json({ error: "GitHub sign-in could not be completed." }, { status: 502 });
  const userResponse = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenResult.access_token}`, "User-Agent": "CommitKeep", "X-GitHub-Api-Version": "2022-11-28" } });
  if (!userResponse.ok) return Response.json({ error: "GitHub identity could not be verified." }, { status: 502 });
  const githubUser = await userResponse.json() as { id: number; login: string; name: string | null; email: string | null };
  const db = getDb(); const now = new Date(); const userId = `github:${githubUser.id}`;
  await db.insert(users).values({ id: userId, displayName: githubUser.name ?? githubUser.login, email: githubUser.email, createdAt: now.toISOString(), updatedAt: now.toISOString() }).onConflictDoUpdate({ target: users.id, set: { displayName: githubUser.name ?? githubUser.login, email: githubUser.email, updatedAt: now.toISOString() } });
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(sessions).values({ tokenHash: await hashSessionToken(sessionToken), userId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() });
  const response = new Response(null, { status: 302, headers: { Location: new URL("/", request.url).toString() } });
  response.headers.append("Set-Cookie", `commitkeep_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  response.headers.append("Set-Cookie", "commitkeep_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
