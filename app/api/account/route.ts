import { eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { githubInstallations, users } from "@/db/schema";
import { deleteGitHubInstallation } from "@/lib/github-app";

const schema = z.object({ confirmation: z.literal("DELETE") });

export async function DELETE(request: Request) {
  const account = await getChatGPTUser();
  if (!account) return Response.json({ error: "Sign in to delete your account." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  const db = getDb();
  const installations = await db.select({ installationId: githubInstallations.installationId }).from(githubInstallations).where(eq(githubInstallations.ownerId, account.userId));
  try {
    for (const installation of installations) await deleteGitHubInstallation(installation.installationId);
  } catch {
    return Response.json({ error: "GitHub access could not be revoked, so account deletion stopped safely." }, { status: 502 });
  }
  await db.delete(users).where(eq(users.id, account.userId));
  return Response.json({ deleted: true });
}
