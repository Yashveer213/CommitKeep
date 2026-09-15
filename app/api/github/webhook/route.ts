import { getDb } from "@/db";
import { githubInstallations, repositories, webhookDeliveries } from "@/db/schema";
import { and, eq } from "drizzle-orm";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const delivery = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");
  if (!delivery || !event || !signature?.startsWith("sha256=")) return Response.json({ error: "Missing GitHub webhook headers." }, { status: 400 });
  const body = await request.text();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (!constantTimeEqual(signature, `sha256=${digest}`)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let payload: { action?: string; installation?: { id?: number }; repositories_removed?: { id?: number }[] } = {};
  try { payload = JSON.parse(body) as typeof payload; } catch { return Response.json({ error: "Invalid webhook payload." }, { status: 400 }); }
  const db = getDb();
  const [seen] = await db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(eq(webhookDeliveries.id, delivery)).limit(1);
  if (seen) return Response.json({ accepted: true, duplicate: true });
  await db.insert(webhookDeliveries).values({ id: delivery, event, receivedAt: new Date().toISOString() });
  if (event === "installation" || event === "installation_repositories") {
    const installationId=payload.installation?.id?String(payload.installation.id):null;
    if(installationId&&payload.action==="deleted")await db.update(githubInstallations).set({status:"removed",updatedAt:new Date().toISOString()}).where(eq(githubInstallations.installationId,installationId));
    if(installationId&&payload.action==="suspended")await db.update(githubInstallations).set({status:"suspended",updatedAt:new Date().toISOString()}).where(eq(githubInstallations.installationId,installationId));
    if(installationId&&payload.action==="unsuspended")await db.update(githubInstallations).set({status:"active",updatedAt:new Date().toISOString()}).where(eq(githubInstallations.installationId,installationId));
    if(installationId&&event==="installation_repositories"&&payload.action==="removed"&&payload.repositories_removed?.length){
      for(const repository of payload.repositories_removed)if(repository.id)await db.update(repositories).set({enabled:false,updatedAt:new Date().toISOString()}).where(and(eq(repositories.installationId,installationId),eq(repositories.githubRepositoryId,String(repository.id))));
    }
  }
  return Response.json({ accepted: true });
}
