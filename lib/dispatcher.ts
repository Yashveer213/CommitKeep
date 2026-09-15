import { env } from "cloudflare:workers";
import { nextOccurrence, occurrenceIdentity } from "@/lib/scheduling";

type DueRow = { time_id: string; schedule_id: string; owner_id: string; repository_id: string; version: number; timezone: string; start_date: string; end_date: string | null; local_time: string; next_run_at: string };
type AutomationQueue = { send(message: { occurrenceId: string; runId: string }): Promise<void> };

export async function dispatchDueOccurrences(now = new Date(), limit = 50) {
  const db = env.DB;
  if (!db) throw new Error("DATABASE_NOT_CONFIGURED");
  const queue = (env as unknown as { AUTOMATION_QUEUE?: AutomationQueue }).AUTOMATION_QUEUE;
  if (!queue) throw new Error("AUTOMATION_QUEUE_NOT_CONFIGURED");
  const rows = await db.prepare(`SELECT st.id AS time_id, st.schedule_id, st.local_time, st.next_run_at, s.owner_id, s.repository_id, s.version, s.timezone, s.start_date, s.end_date
    FROM schedule_times st JOIN schedules s ON s.id=st.schedule_id JOIN repositories r ON r.id=s.repository_id
    WHERE st.status='active' AND s.status='active' AND r.enabled=1 AND st.next_run_at IS NOT NULL AND st.next_run_at<=?
    ORDER BY st.next_run_at, st.id LIMIT ?`).bind(now.toISOString(), limit).all<DueRow>();
  const dispatched: string[] = [];
  for (const row of rows.results) {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.next_run_at));
    const occurrenceId = occurrenceIdentity(row.schedule_id, row.version, localDate, row.local_time);
    const runId = `run:${occurrenceId}`;
    const following = nextOccurrence({ timezone: row.timezone, times: [row.local_time], startDate: row.start_date, endDate: row.end_date }, new Date(row.next_run_at));
    const updatedAt = now.toISOString();
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO scheduled_occurrences (id,owner_id,repository_id,schedule_id,schedule_time_id,schedule_version,local_date,local_time,scheduled_for,status,attempts,claimed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'claimed',0,?,?)`).bind(occurrenceId,row.owner_id,row.repository_id,row.schedule_id,row.time_id,row.version,localDate,row.local_time,row.next_run_at,updatedAt,updatedAt),
      db.prepare(`INSERT OR IGNORE INTO runs (id,owner_id,repository_id,schedule_id,source,outcome,summary,branch,base_sha,result_sha,commit_url,changed_paths_json,error_code,idempotency_key,occurrence_id,schedule_version,scheduled_for,created_at,completed_at) SELECT ?,?,?,?,'automatic','queued','Scheduled action queued.',NULL,NULL,NULL,NULL,'[]',NULL,?,?,?,?,?,NULL WHERE EXISTS (SELECT 1 FROM scheduled_occurrences WHERE id=?)`).bind(runId,row.owner_id,row.repository_id,row.schedule_id,occurrenceId,occurrenceId,row.version,row.next_run_at,updatedAt,occurrenceId),
      db.prepare(`UPDATE scheduled_occurrences SET status='queued', updated_at=? WHERE id=? AND status='claimed'`).bind(updatedAt,occurrenceId),
    ]);
    await queue.send({ occurrenceId, runId });
    await db.prepare(`UPDATE schedule_times SET last_occurrence_id=?, next_run_at=?, status=?, updated_at=? WHERE id=? AND next_run_at=?`).bind(occurrenceId,following?.scheduledFor ?? null,following ? "active" : "expired",updatedAt,row.time_id,row.next_run_at).run();
    dispatched.push(occurrenceId);
  }
  return dispatched;
}
