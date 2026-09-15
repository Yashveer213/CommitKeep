import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { schedules } from "@/db/schema";
import { diffScheduleTimes } from "@/lib/schedule-time-diff";
import { isValidTimezone, nextOccurrence, normalizeTimes, validateDateRange } from "@/lib/scheduling";

const schema = z.object({
  expectedVersion: z.number().int().positive(),
  mode: z.literal("update"),
  times: z.array(z.string()).min(1).max(8),
  timezone: z.string().min(1).max(100),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to edit schedules." }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Schedule not found." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Review the schedule settings." }, { status: 400 });
  let times: string[];
  try { times = normalizeTimes(parsed.data.times); validateDateRange(parsed.data.startDate, parsed.data.endDate); }
  catch (error) { return Response.json({ error: "Times or dates are invalid.", code: error instanceof Error ? error.message : "VALIDATION_FAILED" }, { status: 400 }); }
  if (!isValidTimezone(parsed.data.timezone)) return Response.json({ error: "Choose a valid IANA timezone." }, { status: 400 });
  const row = (await getDb().select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.ownerId, account.userId))).limit(1))[0];
  if (!row) return Response.json({ error: "Schedule not found." }, { status: 404 });
  if (row.version !== parsed.data.expectedVersion) return Response.json({ error: "The schedule changed. Reload and try again.", code: "SCHEDULE_VERSION_CONFLICT" }, { status: 409 });
  if (!env.DB) return Response.json({ error: "Database unavailable." }, { status: 503 });

  const now = new Date(); const nextVersion = row.version + 1;
  const existing = (await env.DB.prepare("SELECT id,local_time localTime,status FROM schedule_times WHERE schedule_id=?").bind(id).all<{id:string;localTime:string;status:string}>()).results;
  const diff = diffScheduleTimes(existing, times);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE schedules SET mode='update',local_time=?,timezone=?,start_date=?,end_date=?,status='active',version=?,paused_at=NULL,paused_by=NULL,updated_at=? WHERE id=? AND owner_id=? AND version=?").bind(times[0], parsed.data.timezone, parsed.data.startDate, parsed.data.endDate ?? null, nextVersion, now.toISOString(), id, account.userId, row.version),
    env.DB.prepare("UPDATE scheduled_occurrences SET status='cancelled',updated_at=? WHERE schedule_id=? AND schedule_version=? AND status IN ('claimed','queued')").bind(now.toISOString(), id, row.version),
    env.DB.prepare("UPDATE runs SET outcome='skipped_stale_version',summary='The schedule changed after this run was queued.',completed_at=? WHERE schedule_id=? AND schedule_version=? AND outcome='queued'").bind(now.toISOString(), id, row.version),
  ];
  for (const prior of diff.removed) statements.push(env.DB.prepare("UPDATE schedule_times SET status='disabled',disabled_at=?,next_run_at=NULL,updated_at=? WHERE id=?").bind(now.toISOString(), now.toISOString(), prior.id));
  for (const prior of diff.retained) {
    const next = nextOccurrence({ timezone: parsed.data.timezone, times: [prior.localTime], startDate: parsed.data.startDate, endDate: parsed.data.endDate }, now);
    statements.push(env.DB.prepare("UPDATE schedule_times SET next_run_at=?,status=?,schedule_version=?,disabled_at=NULL,updated_at=? WHERE id=?").bind(next?.scheduledFor ?? null, next ? "active" : "expired", nextVersion, now.toISOString(), prior.id));
  }
  for (const time of diff.added) {
    const next = nextOccurrence({ timezone: parsed.data.timezone, times: [time], startDate: parsed.data.startDate, endDate: parsed.data.endDate }, now);
    statements.push(env.DB.prepare("INSERT INTO schedule_times(id,schedule_id,local_time,next_run_at,last_occurrence_id,status,schedule_version,disabled_at,created_at,updated_at) VALUES(?,?,?,?,NULL,?,?,NULL,?,?)").bind(crypto.randomUUID(), id, time, next?.scheduledFor ?? null, next ? "active" : "expired", nextVersion, now.toISOString(), now.toISOString()));
  }
  await env.DB.batch(statements);
  return Response.json({ id, version: nextVersion, times, timezone: parsed.data.timezone, startDate: parsed.data.startDate, endDate: parsed.data.endDate ?? null });
}
