import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubInstallations, repositories } from "@/db/schema";
import { githubInstallationRequest } from "@/lib/github-app";
import { env } from "cloudflare:workers";

type GitHubRepository = { id: number; full_name: string; default_branch: string; private: boolean };
const selectionSchema = z.object({ repositoryIds: z.array(z.string().regex(/^\d+$/)).max(50) });

async function installationForOwner(ownerId: string) {
  const db = getDb();
  const [installation] = await db.select().from(githubInstallations).where(and(eq(githubInstallations.ownerId, ownerId), eq(githubInstallations.status, "active"))).limit(1);
  return installation;
}

export async function GET() {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to view repositories." }, { status: 401 });
  const installation = await installationForOwner(account.userId);
  if (!installation) return Response.json({ error: "Connect GitHub first." }, { status: 409 });
  const result = await githubInstallationRequest<{ repositories: GitHubRepository[] }>(installation.installationId, "/installation/repositories?per_page=100");
  const selected = await getDb().select({ githubRepositoryId: repositories.githubRepositoryId }).from(repositories).where(and(eq(repositories.ownerId, account.userId),eq(repositories.enabled,true)));
  const selectedIds = new Set(selected.map((row) => row.githubRepositoryId));
  return Response.json({ repositories: result.repositories.map((repo) => ({ id: String(repo.id), fullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, selected: selectedIds.has(String(repo.id)) })) });
}

export async function POST(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to select repositories." }, { status: 401 });
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose up to 50 valid repositories." }, { status: 400 });
  const installation = await installationForOwner(account.userId);
  if (!installation) return Response.json({ error: "Connect GitHub first." }, { status: 409 });
  const result = await githubInstallationRequest<{ repositories: GitHubRepository[] }>(installation.installationId, "/installation/repositories?per_page=100");
  const allowed = new Map(result.repositories.map((repo) => [String(repo.id), repo]));
  if (parsed.data.repositoryIds.some((id) => !allowed.has(id))) return Response.json({ error: "A selected repository is outside this installation." }, { status: 403 });

  const db = getDb();
  const d1 = env.DB;
  if (!d1) return Response.json({ error: "Database is unavailable." }, { status: 503 });
  const now = new Date().toISOString();
  const currentRows = await db.select().from(repositories).where(eq(repositories.ownerId, account.userId));
  const currentByGitHubId = new Map(currentRows.map((row) => [row.githubRepositoryId, row]));
  const selectedSet = new Set(parsed.data.repositoryIds);
  const statements: D1PreparedStatement[] = [];
  for (const row of currentRows) if (!selectedSet.has(row.githubRepositoryId) && row.enabled) statements.push(d1.prepare("UPDATE repositories SET enabled=0,updated_at=? WHERE id=? AND owner_id=?").bind(now,row.id,account.userId));
  const savedRepositories = [];
  for (const id of parsed.data.repositoryIds) {
    const repo = allowed.get(id)!;
    const current = currentByGitHubId.get(id);
    const saved = { id: current?.id ?? crypto.randomUUID(), ownerId: account.userId, installationId: installation.installationId, githubRepositoryId: id, fullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, enabled: true, createdAt: current?.createdAt ?? now, updatedAt: now };
    if (current) statements.push(d1.prepare("UPDATE repositories SET installation_id=?,full_name=?,default_branch=?,private=?,enabled=1,updated_at=? WHERE id=? AND owner_id=?").bind(saved.installationId,saved.fullName,saved.defaultBranch,saved.private?1:0,now,current.id,account.userId));
    else statements.push(d1.prepare("INSERT INTO repositories(id,owner_id,installation_id,github_repository_id,full_name,default_branch,private,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)").bind(saved.id,saved.ownerId,saved.installationId,saved.githubRepositoryId,saved.fullName,saved.defaultBranch,saved.private?1:0,saved.createdAt,saved.updatedAt));
    savedRepositories.push(saved);
  }
  if(statements.length)await d1.batch(statements);
  return Response.json({ saved: savedRepositories.length, repositories: savedRepositories });
}
