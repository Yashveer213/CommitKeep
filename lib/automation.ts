import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { repositories, runs, schedules } from "@/db/schema";
import { githubInstallationFetch, githubInstallationRequest } from "@/lib/github-app";
import { createActivityReport, localDayAndTime, scheduleIsDue } from "@/lib/automation-policy";

type Repository = typeof repositories.$inferSelect;
type Schedule = typeof schedules.$inferSelect;
type RepoMetadata = { full_name: string; default_branch: string; pushed_at: string; open_issues_count: number; visibility: string };
type ContentFile = { sha: string; content: string; encoding: string };

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function executeActivityReport(schedule: Schedule, repository: Repository, now = new Date()) {
  const db = getDb();
  const local = localDayAndTime(now, schedule.timezone);
  const idempotencyKey = `schedule:${schedule.id}:${local.day}`;
  const runId = crypto.randomUUID();
  try {
    await db.insert(runs).values({ id: runId, ownerId: schedule.ownerId, repositoryId: repository.id, scheduleId: schedule.id, source: "automatic", outcome: "running", summary: "Preparing the daily repository activity report.", branch: repository.defaultBranch, baseSha: null, resultSha: null, commitUrl: null, changedPathsJson: "[]", errorCode: null, idempotencyKey, createdAt: now.toISOString(), completedAt: null });
  } catch (error) {
    const [existing] = await db.select({ id: runs.id }).from(runs).where(eq(runs.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) return { outcome: "duplicate" as const };
    throw error;
  }

  const finish = async (values: Partial<typeof runs.$inferInsert>) => {
    await db.update(runs).set({ ...values, completedAt: new Date().toISOString() }).where(eq(runs.id, runId));
    return { outcome: values.outcome, runId };
  };

  try {
    if (schedule.mode === "save") return finish({ outcome: "skipped", summary: "No pending web draft was available to save." });
    const encodedName = repository.fullName.split("/").map(encodeURIComponent).join("/");
    const [metadata, initialHead] = await Promise.all([
      githubInstallationRequest<RepoMetadata>(repository.installationId, `/repos/${encodedName}`),
      githubInstallationRequest<{ object: { sha: string } }>(repository.installationId, `/repos/${encodedName}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`),
    ]);
    const path = ".commitkeep/activity.md";
    const report = createActivityReport(metadata, local.day);
    const contentResponse = await githubInstallationFetch(repository.installationId, `/repos/${encodedName}/contents/${path}?ref=${encodeURIComponent(repository.defaultBranch)}`);
    let existing: ContentFile | null = null;
    if (contentResponse.ok) existing = await contentResponse.json() as ContentFile;
    else if (contentResponse.status !== 404) throw new Error(`GITHUB_CONTENT_READ_${contentResponse.status}`);
    if (existing?.encoding === "base64" && atob(existing.content.replace(/\n/g, "")) === report) return finish({ outcome: "skipped", summary: "The daily report already matches repository activity.", baseSha: initialHead.object.sha });
    const currentHead = await githubInstallationRequest<{ object: { sha: string } }>(repository.installationId, `/repos/${encodedName}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`);
    if (currentHead.object.sha !== initialHead.object.sha) return finish({ outcome: "conflict", summary: "The branch changed while the report was prepared, so CommitKeep stopped safely.", baseSha: initialHead.object.sha, errorCode: "BRANCH_HEAD_CHANGED" });
    const writeResponse = await githubInstallationFetch(repository.installationId, `/repos/${encodedName}/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: `chore(commitkeep): update activity report for ${local.day}`, content: utf8Base64(report), branch: repository.defaultBranch, ...(existing ? { sha: existing.sha } : {}) }) });
    if (!writeResponse.ok) throw new Error(`GITHUB_CONTENT_WRITE_${writeResponse.status}`);
    const result = await writeResponse.json() as { commit: { sha: string; html_url: string } };
    return finish({ outcome: "committed", summary: "Updated the bounded daily repository activity report.", baseSha: initialHead.object.sha, resultSha: result.commit.sha, commitUrl: result.commit.html_url, changedPathsJson: JSON.stringify([path]) });
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/[^A-Z0-9_]/g, "_").slice(0, 80) : "UNKNOWN_ERROR";
    return finish({ outcome: "failed", summary: "The run failed before a verified commit was completed.", errorCode: code });
  }
}

export async function runDueSchedules(now = new Date()) {
  const db = getDb();
  const rows = await db.select({ schedule: schedules, repository: repositories }).from(schedules).innerJoin(repositories, and(eq(schedules.repositoryId, repositories.id), eq(schedules.ownerId, repositories.ownerId))).where(and(eq(schedules.enabled, true), eq(repositories.enabled, true)));
  const due = rows.filter(({ schedule }) => scheduleIsDue(schedule, now)).slice(0, 25);
  return Promise.all(due.map(({ schedule, repository }) => executeActivityReport(schedule, repository, now)));
}
