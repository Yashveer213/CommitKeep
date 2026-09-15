import { z } from "zod";
import { executeScheduledOccurrence } from "@/lib/scheduled-execution";

const schema=z.object({occurrenceId:z.string().min(8).max(300),runId:z.string().min(8).max(320)}).strict();
export async function POST(request:Request){
  const secret=process.env.SCHEDULER_SECRET;if(!secret)return Response.json({error:"Job execution is not configured."},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${secret}`)return Response.json({error:"Unauthorized."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"Invalid job identifier."},{status:400});
  try{return Response.json(await executeScheduledOccurrence(parsed.data.occurrenceId,parsed.data.runId));}catch(error){
    const code=error instanceof Error?error.message:"JOB_FAILED";const transient=code==="REPOSITORY_BUSY"||/^GITHUB_.*_(429|5\d\d)$/.test(code);
    return Response.json({error:transient?"Scheduled work will be retried.":"Scheduled work could not be completed.",code},{status:transient?503:409});
  }
}
