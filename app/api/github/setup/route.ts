import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubConnectionStates, githubInstallations } from "@/db/schema";
import { getGitHubInstallation } from "@/lib/github-app";

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in before completing GitHub setup." }, { status: 401 });

  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const state = url.searchParams.get("state");
  if (!installationId || !state || readCookie(request, "commitkeep_github_state") !== state) {
    return Response.json({ error: "The GitHub connection request is invalid or expired." }, { status: 400 });
  }

  const db = getDb();
  const [pending] = await db.select().from(githubConnectionStates).where(and(eq(githubConnectionStates.id, state), eq(githubConnectionStates.ownerId, account.userId))).limit(1);
  if (!pending || pending.expiresAt < new Date().toISOString()) {
    return Response.json({ error: "The GitHub connection request has expired." }, { status: 400 });
  }

  const installation = await getGitHubInstallation(installationId);
  if (!installation.account) return Response.json({ error: "GitHub did not return an installation owner." }, { status: 502 });

  const [existing] = await db.select().from(githubInstallations).where(eq(githubInstallations.installationId, installationId)).limit(1);
  if (existing && existing.ownerId !== account.userId) {
    return Response.json({ error: "This GitHub installation is already linked to another CommitKeep account." }, { status: 409 });
  }

  const now = new Date().toISOString();
  if (existing) {
    await db.update(githubInstallations).set({ accountId: String(installation.account.id), accountLogin: installation.account.login, accountType: installation.account.type, status: "active", htmlUrl: installation.html_url, updatedAt: now }).where(eq(githubInstallations.id, existing.id));
  } else {
    await db.insert(githubInstallations).values({ id: crypto.randomUUID(), ownerId: account.userId, installationId, accountId: String(installation.account.id), accountLogin: installation.account.login, accountType: installation.account.type, status: "active", htmlUrl: installation.html_url, createdAt: now, updatedAt: now });
  }
  await db.delete(githubConnectionStates).where(eq(githubConnectionStates.id, state));

  const response = new Response(null, { status: 302, headers: { Location: new URL("/?github=connected", request.url).toString() } });
  response.headers.append("Set-Cookie", "commitkeep_github_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
