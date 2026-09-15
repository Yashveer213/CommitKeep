import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { repositories, schedules } from "@/db/schema";

const schema = z.object({ repositoryId: z.string().uuid(), mode: z.enum(["update", "save", "both"]), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().min(1).max(100) });

export async function POST(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to create a schedule." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The schedule settings are invalid." }, { status: 400 });
  try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone }).format(); } catch { return Response.json({ error: "Choose a valid timezone." }, { status: 400 }); }
  const db = getDb();
  const [repository] = await db.select().from(repositories).where(and(eq(repositories.id, parsed.data.repositoryId), eq(repositories.ownerId, account.userId), eq(repositories.enabled, true))).limit(1);
  if (!repository) return Response.json({ error: "Repository access is unavailable." }, { status: 404 });
  const now = new Date().toISOString();
  const [existing] = await db.select({ id: schedules.id }).from(schedules).where(and(
    eq(schedules.ownerId, account.userId),
    eq(schedules.repositoryId, repository.id),
    eq(schedules.rule, "activity_report"),
  )).limit(1);
  const id = existing?.id ?? crypto.randomUUID();

  await db.insert(schedules).values({ id, ownerId: account.userId, repositoryId: repository.id, rule: "activity_report", mode: parsed.data.mode, localTime: parsed.data.localTime, timezone: parsed.data.timezone, enabled: true, nextRunAt: null, createdAt: now, updatedAt: now }).onConflictDoUpdate({
    target: [schedules.ownerId, schedules.repositoryId, schedules.rule],
    set: { mode: parsed.data.mode, localTime: parsed.data.localTime, timezone: parsed.data.timezone, enabled: true, nextRunAt: null, updatedAt: now },
  });
  return Response.json({ id }, { status: existing ? 200 : 201 });
}
