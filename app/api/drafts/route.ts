import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { drafts, repositories } from "@/db/schema";

const draftSchema = z.object({
  repositoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/),
  content: z.string().min(1).max(100_000),
});

export async function GET() {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to view saved work." }, { status: 401 });
  const rows = await getDb().select().from(drafts).where(and(eq(drafts.ownerId, account.userId), eq(drafts.status, "pending"))).orderBy(desc(drafts.updatedAt)).limit(50);
  return Response.json({ drafts: rows.map(({ content, ...row }) => ({ ...row, preview: content.slice(0, 240) })) });
}

export async function POST(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to save work." }, { status: 401 });
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Use a simple note name and content under 100 KB." }, { status: 400 });
  const db = getDb();
  const [repository] = await db.select().from(repositories).where(and(eq(repositories.id, parsed.data.repositoryId), eq(repositories.ownerId, account.userId), eq(repositories.enabled, true))).limit(1);
  if (!repository) return Response.json({ error: "Repository access is unavailable." }, { status: 404 });
  const slug = parsed.data.name.trim().toLowerCase().replace(/\s+/g, "-");
  const path = `.commitkeep/notes/${slug}.md`;
  const now = new Date().toISOString();
  const [existing] = await db.select().from(drafts).where(and(eq(drafts.repositoryId, repository.id), eq(drafts.path, path), eq(drafts.status, "pending"))).limit(1);
  if (existing && existing.ownerId !== account.userId) return Response.json({ error: "Draft ownership could not be verified." }, { status: 403 });
  if (existing) {
    await db.update(drafts).set({ content: parsed.data.content, updatedAt: now }).where(eq(drafts.id, existing.id));
    return Response.json({ draft: { ...existing, content: parsed.data.content, updatedAt: now } });
  }
  const draft = { id: crypto.randomUUID(), ownerId: account.userId, repositoryId: repository.id, path, content: parsed.data.content, status: "pending" as const, createdAt: now, updatedAt: now, committedAt: null };
  await db.insert(drafts).values(draft);
  return Response.json({ draft }, { status: 201 });
}
