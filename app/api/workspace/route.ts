import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { drafts, githubInstallations, repositories, repositoryAutomationControls, runs, scheduleTimes, schedules, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to open your workspace." }, { status: 401 });

  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(users).values({
    id: account.userId,
    displayName: account.displayName,
    email: account.email,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({ target: users.id, set: { displayName: account.displayName, email: account.email, updatedAt: now } });

  const [installationRows, repositoryRows, controlRows, scheduleRows, scheduleTimeRows, runRows, draftRows] = await Promise.all([
    db.select({ installationId: githubInstallations.installationId, accountLogin: githubInstallations.accountLogin, status: githubInstallations.status }).from(githubInstallations).where(eq(githubInstallations.ownerId, account.userId)),
    db.select().from(repositories).where(eq(repositories.ownerId, account.userId)),
    db.select().from(repositoryAutomationControls).where(eq(repositoryAutomationControls.ownerId, account.userId)),
    db.select().from(schedules).where(eq(schedules.ownerId, account.userId)),
    db.select({ id: scheduleTimes.id, scheduleId: scheduleTimes.scheduleId, localTime: scheduleTimes.localTime, nextRunAt: scheduleTimes.nextRunAt, status: scheduleTimes.status }).from(scheduleTimes).innerJoin(schedules, and(eq(scheduleTimes.scheduleId, schedules.id), eq(schedules.ownerId, account.userId))),
    db.select().from(runs).where(eq(runs.ownerId, account.userId)).orderBy(desc(runs.createdAt)).limit(50),
    db.select({ id: drafts.id, repositoryId: drafts.repositoryId, path: drafts.path, preview: drafts.content, updatedAt: drafts.updatedAt }).from(drafts).where(and(eq(drafts.ownerId, account.userId), eq(drafts.status, "pending"))).orderBy(desc(drafts.updatedAt)).limit(50),
  ]);

  return Response.json({
    account: { displayName: account.displayName },
    github: { connected: installationRows.some((row) => row.status === "active"), installations: installationRows },
    repositories: repositoryRows.map((repository) => ({ ...repository, automationStatus: controlRows.find((control) => control.repositoryId === repository.id)?.status ?? "active" })),
    schedules: scheduleRows.map((schedule) => ({ ...schedule, times: scheduleTimeRows.filter((time) => time.scheduleId === schedule.id) })),
    runs: runRows,
    drafts: draftRows.map((draft) => ({ ...draft, preview: draft.preview.slice(0, 240) })),
  });
}
