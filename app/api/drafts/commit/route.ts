import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { drafts, repositories, runs } from "@/db/schema";
import { githubInstallationFetch, githubInstallationRequest } from "@/lib/github-app";

const schema = z.object({ draftId: z.string().uuid(), expectedUpdatedAt: z.string().datetime() });

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Utf8(value: string) {
  const binary = atob(value.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export async function POST(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to commit saved work." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The draft request is invalid." }, { status: 400 });
  const db = getDb();
  const [row] = await db.select({ draft: drafts, repository: repositories }).from(drafts).innerJoin(repositories, and(eq(drafts.repositoryId, repositories.id), eq(drafts.ownerId, repositories.ownerId))).where(and(eq(drafts.id, parsed.data.draftId), eq(drafts.ownerId, account.userId), eq(drafts.status, "pending"), eq(repositories.enabled, true))).limit(1);
  if (!row) return Response.json({ error: "Pending draft is unavailable." }, { status: 404 });
  if (row.draft.updatedAt !== parsed.data.expectedUpdatedAt) return Response.json({ error: "The draft changed after preview. Review it again before committing." }, { status: 409 });
  const repository = row.repository; const draft = row.draft;
  const encodedName = repository.fullName.split("/").map(encodeURIComponent).join("/");
  const head = await githubInstallationRequest<{ object: { sha: string } }>(repository.installationId, `/repos/${encodedName}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`);
  const contentResponse = await githubInstallationFetch(repository.installationId, `/repos/${encodedName}/contents/${draft.path}?ref=${encodeURIComponent(repository.defaultBranch)}`);
  let existingFile: { sha: string; content?: string; encoding?: string } | undefined;
  if (contentResponse.ok) existingFile = (await contentResponse.json()) as typeof existingFile;
  else if (contentResponse.status !== 404) return Response.json({ error: "Existing repository content could not be verified." }, { status: 502 });
  if (existingFile?.encoding === "base64" && existingFile.content && base64Utf8(existingFile.content) === draft.content) {
    const now = new Date().toISOString();
    await db.update(drafts).set({ status: "committed", claimToken: null, committedAt: now, updatedAt: now }).where(and(eq(drafts.id, draft.id), eq(drafts.ownerId, account.userId), eq(drafts.status, "pending"), eq(drafts.updatedAt, parsed.data.expectedUpdatedAt)));
    const run = { id: crypto.randomUUID(), ownerId: account.userId, repositoryId: repository.id, scheduleId: null, source: "saved_work" as const, outcome: "skipped" as const, summary: `${draft.path} already matches the approved draft.`, branch: repository.defaultBranch, baseSha: head.object.sha, resultSha: null, commitUrl: null, changedPathsJson: "[]", errorCode: null, idempotencyKey: `draft:${draft.id}:${parsed.data.expectedUpdatedAt}`, createdAt: now, completedAt: now };
    await db.insert(runs).values(run).onConflictDoNothing({ target: runs.idempotencyKey });
    return Response.json({ run });
  }
  const rechecked = await githubInstallationRequest<{ object: { sha: string } }>(repository.installationId, `/repos/${encodedName}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`);
  if (rechecked.object.sha !== head.object.sha) return Response.json({ error: "The branch changed during preview. Nothing was committed." }, { status: 409 });
  const claimTime = new Date().toISOString();
  const claimToken = crypto.randomUUID();
  await db.update(drafts).set({ status: "committing", claimToken, updatedAt: claimTime }).where(and(eq(drafts.id, draft.id), eq(drafts.ownerId, account.userId), eq(drafts.status, "pending"), eq(drafts.updatedAt, parsed.data.expectedUpdatedAt)));
  const [claimed] = await db.select({ id: drafts.id }).from(drafts).where(and(eq(drafts.id, draft.id), eq(drafts.ownerId, account.userId), eq(drafts.status, "committing"), eq(drafts.claimToken, claimToken))).limit(1);
  if (!claimed) return Response.json({ error: "Another request already claimed this draft version." }, { status: 409 });
  const write = await githubInstallationFetch(repository.installationId, `/repos/${encodedName}/contents/${draft.path}`, { method: "PUT", body: JSON.stringify({ message: `docs(commitkeep): save ${draft.path.split("/").at(-1)}`, content: utf8Base64(draft.content), branch: repository.defaultBranch, ...(existingFile ? { sha: existingFile.sha } : {}) }) });
  if (!write.ok) {
    await db.update(drafts).set({ status: "pending", claimToken: null, updatedAt: parsed.data.expectedUpdatedAt }).where(and(eq(drafts.id, draft.id), eq(drafts.ownerId, account.userId), eq(drafts.status, "committing"), eq(drafts.claimToken, claimToken)));
    return Response.json({ error: `GitHub rejected the commit (${write.status}).` }, { status: 502 });
  }
  const result = await write.json() as { commit: { sha: string; html_url: string } };
  const now = new Date().toISOString();
  await db.update(drafts).set({ status: "committed", claimToken: null, committedAt: now, updatedAt: now }).where(and(eq(drafts.id, draft.id), eq(drafts.ownerId, account.userId), eq(drafts.status, "committing"), eq(drafts.claimToken, claimToken)));
  const run = { id: crypto.randomUUID(), ownerId: account.userId, repositoryId: repository.id, scheduleId: null, source: "saved_work" as const, outcome: "committed" as const, summary: `Saved ${draft.path} from an approved web draft.`, branch: repository.defaultBranch, baseSha: head.object.sha, resultSha: result.commit.sha, commitUrl: result.commit.html_url, changedPathsJson: JSON.stringify([draft.path]), errorCode: null, idempotencyKey: `draft:${draft.id}:${parsed.data.expectedUpdatedAt}`, createdAt: now, completedAt: now };
  await db.insert(runs).values(run);
  return Response.json({ run });
}
