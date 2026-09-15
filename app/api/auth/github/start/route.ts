import { getGitHubOAuthConfig } from "@/lib/github-app";

export async function GET(request: Request) {
  const config = getGitHubOAuthConfig();
  if (!config) return Response.json({ error: "GitHub sign-in is not configured." }, { status: 503 });
  const state = crypto.randomUUID();
  const callback = new URL("/api/auth/github/callback", request.url);
  const target = new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", config.clientId);
  target.searchParams.set("redirect_uri", callback.toString());
  target.searchParams.set("state", state);
  const response = new Response(null, { status: 302, headers: { Location: target.toString() } });
  response.headers.append("Set-Cookie", `commitkeep_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  return response;
}
