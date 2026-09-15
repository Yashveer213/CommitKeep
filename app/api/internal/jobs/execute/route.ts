import { z } from "zod";
import { env } from "cloudflare:workers";
import { executeScheduledOccurrence } from "@/lib/scheduled-execution";

const schema=z.object({occurrenceId:z.string().min(8).max(300),runId:z.string().min(8).max(320),attemptId:z.string().min(8).max(400)}).strict();
export async function POST(request:Request){
  const secret=env.SCHEDULER_SECRET;if(!secret)return Response.json({error:"Job execution is not configured."},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${secret}`)return Response.json({error:"Unauthorized."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"Invalid job identifier."},{status:400});
  try{return Response.json(await executeScheduledOccurrence(parsed.data.occurrenceId,parsed.data.runId,parsed.data.attemptId));}catch(error){
    const code=error instanceof Error?error.message:"JOB_FAILED";const transient=code==="REPOSITORY_BUSY"||/^GITHUB_.*_(429|5\d\d)$/.test(code);const attempt=Math.max(1,Number(request.headers.get("x-queue-attempt")??"1"));
    if(!transient||attempt>=5){const now=new Date().toISOString();await env.DB?.batch([
      env.DB.prepare("UPDATE runs SET outcome='failed',summary='Scheduled work could not be completed.',error_code=?,completed_at=? WHERE id=? AND occurrence_id=? AND completed_at IS NULL").bind(code,now,parsed.data.runId,parsed.data.occurrenceId),
      env.DB.prepare("UPDATE scheduled_occurrences SET status='completed',attempts=?,updated_at=? WHERE id=?").bind(attempt,now,parsed.data.occurrenceId),
    ]);}
    else await env.DB?.prepare("UPDATE scheduled_occurrences SET attempts=?,updated_at=? WHERE id=?").bind(attempt,new Date().toISOString(),parsed.data.occurrenceId).run();
    const headers=new Headers();const retryAfter=(error as Error&{retryAfter?:string}).retryAfter;if(retryAfter)headers.set("Retry-After",retryAfter);
    return Response.json({error:transient&&attempt<5?"Scheduled work will be retried.":"Scheduled work could not be completed.",code},{status:transient&&attempt<5?503:409,headers});
  }
}
