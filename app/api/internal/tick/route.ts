import { runDueSchedules } from "@/lib/automation";

export async function POST(request: Request) {
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret) return Response.json({ error: "Scheduler is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const results = await runDueSchedules();
  return Response.json({ processed: results.length, results });
}
