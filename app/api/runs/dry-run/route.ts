import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { repositories, runs } from "@/db/schema";
import { githubInstallationRequest } from "@/lib/github-app";

const schema = z.object({ repositoryId: z.string().uuid() });

export async function POST(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to run a preview." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid repository." }, { status: 400 });
  const db = getDb();
  const [repository] = await db.select().from(repositories).where(and(eq(repositories.id, parsed.data.repositoryId), eq(repositories.ownerId, account.userId), eq(repositories.enabled, true))).limit(1);
  if (!repository) return Response.json({ error: "Repository access is unavailable." }, { status: 404 });
  const branch = await githubInstallationRequest<{ object: { sha: string } }>(repository.installationId, `/repos/${repository.fullName}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`);
  const now = new Date().toISOString();
  const run = { id: crypto.randomUUID(), ownerId: account.userId, repositoryId: repository.id, scheduleId: null, source: "manual" as const, outcome: "skipped" as const, summary: "Dry run completed. Repository access and branch head were verified; no files were changed.", branch: repository.defaultBranch, baseSha: branch.object.sha, resultSha: null, commitUrl: null, changedPathsJson: "[]", errorCode: null, idempotencyKey: `dry:${account.userId}:${repository.id}:${crypto.randomUUID()}`, createdAt: now, completedAt: now };
  await db.insert(runs).values(run);
  return Response.json({ run });
}
