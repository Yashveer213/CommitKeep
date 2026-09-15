import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubConnectionStates, githubInstallations, users } from "@/db/schema";
import { getGitHubAppConfig, getGitHubInstallation } from "@/lib/github-app";
import { and, eq } from "drizzle-orm";

export async function POST() {
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
  await db.insert(users).values({ id: account.userId, displayName: account.displayName, email: account.email, githubLogin: account.githubLogin, avatarUrl: account.avatarUrl, createdAt: now.toISOString(), updatedAt: now.toISOString() })
    .onConflictDoUpdate({ target: users.id, set: { displayName: account.displayName, email: account.email, githubLogin: account.githubLogin, avatarUrl: account.avatarUrl, updatedAt: now.toISOString() } });
  await db.insert(githubConnectionStates).values({ id: state, ownerId: account.userId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString() });
  const [activeInstallation] = await db.select().from(githubInstallations).where(and(eq(githubInstallations.ownerId, account.userId), eq(githubInstallations.status, "active"))).limit(1);
  if (activeInstallation) {
    const installation = await getGitHubInstallation(activeInstallation.installationId);
    if (!installation.account || String(installation.account.id) !== activeInstallation.accountId) return Response.json({ error: "The GitHub installation owner could not be verified." }, { status: 409 });
    await db.update(githubInstallations).set({ htmlUrl: installation.html_url, updatedAt: new Date().toISOString() }).where(eq(githubInstallations.id, activeInstallation.id));
    const target=new URL(installation.html_url);target.searchParams.set("state",state);
    const response=Response.json({ redirectUrl: target.toString(), existingInstallation: true, message: "GitHub may ask you to verify your identity before changing repository access." });
    response.headers.append("Set-Cookie", `commitkeep_github_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
    return response;
  }

  const target = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  target.searchParams.set("state", state);
  const response = Response.json({ redirectUrl: target.toString() });
  response.headers.append("Set-Cookie", `commitkeep_github_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  return response;
}
