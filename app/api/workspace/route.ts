import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubInstallations, repositories, runs, schedules, users } from "@/db/schema";

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

  const [installationRows, repositoryRows, scheduleRows, runRows] = await Promise.all([
    db.select({ installationId: githubInstallations.installationId, accountLogin: githubInstallations.accountLogin, status: githubInstallations.status }).from(githubInstallations).where(eq(githubInstallations.ownerId, account.userId)),
    db.select().from(repositories).where(eq(repositories.ownerId, account.userId)),
    db.select().from(schedules).where(eq(schedules.ownerId, account.userId)),
    db.select().from(runs).where(eq(runs.ownerId, account.userId)).orderBy(desc(runs.createdAt)).limit(50),
  ]);

  return Response.json({
    account: { displayName: account.displayName },
    github: { connected: installationRows.some((row) => row.status === "active"), installations: installationRows },
    repositories: repositoryRows,
    schedules: scheduleRows,
    runs: runRows,
  });
}
