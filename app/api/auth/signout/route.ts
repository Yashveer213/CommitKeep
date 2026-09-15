import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { hashSessionToken } from "@/app/chatgpt-auth";

export async function POST() {
  const token = (await cookies()).get("commitkeep_session")?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await hashSessionToken(token)));
  const response = Response.json({ signedOut: true });
  response.headers.append("Set-Cookie", "commitkeep_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
