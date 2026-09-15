import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubConnectionStates, users } from "@/db/schema";
import { getGitHubAppConfig } from "@/lib/github-app";

export async function GET() {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in before connecting GitHub." }, { status: 401 });

  const config = getGitHubAppConfig();
  if (!config) {
    return Response.json({
      error: "GitHub App setup is required before repositories can be connected.",
      code: "GITHUB_APP_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const db = getDb();
  const now = new Date();
  const state = crypto.randomUUID();
  await db.insert(users).values({ id: account.userId, displayName: account.displayName, email: account.email, createdAt: now.toISOString(), updatedAt: now.toISOString() })
    .onConflictDoUpdate({ target: users.id, set: { displayName: account.displayName, email: account.email, updatedAt: now.toISOString() } });
  await db.insert(githubConnectionStates).values({ id: state, ownerId: account.userId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString() });

  const target = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  target.searchParams.set("state", state);
  const response = new Response(null, { status: 302, headers: { Location: target.toString() } });
  response.headers.append("Set-Cookie", `commitkeep_github_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  return response;
}
