import { env } from "cloudflare:workers";
import { nextOccurrence } from "@/lib/scheduling";

type LegacyRow={id:string;timezone:string;local_time:string;start_date:string|null;end_date:string|null;enabled:number;time_id:string};
export async function POST(request:Request){
  const secret=process.env.SCHEDULER_SECRET;if(!secret)return Response.json({error:"Reconciliation is not configured."},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${secret}`)return Response.json({error:"Unauthorized."},{status:401});
  if(!env.DB)return Response.json({error:"Database is unavailable."},{status:503});
  const now=new Date();const rows=await env.DB.prepare(`SELECT s.id,s.timezone,s.local_time,s.start_date,s.end_date,s.enabled,st.id time_id FROM schedules s JOIN schedule_times st ON st.schedule_id=s.id WHERE s.start_date IS NULL OR st.next_run_at IS NULL`).all<LegacyRow>();
  const statements:D1PreparedStatement[]=[];
  for(const row of rows.results){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:row.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const value=(type:string)=>parts.find(part=>part.type===type)?.value??"";const startDate=row.start_date??`${value("year")}-${value("month")}-${value("day")}`;
    const next=row.enabled?nextOccurrence({timezone:row.timezone,times:[row.local_time],startDate,endDate:row.end_date},now):null;
    statements.push(env.DB.prepare("UPDATE schedules SET start_date=?,status=?,updated_at=? WHERE id=?").bind(startDate,next?"active":"expired",now.toISOString(),row.id));
    statements.push(env.DB.prepare("UPDATE schedule_times SET next_run_at=?,status=?,updated_at=? WHERE id=?").bind(next?.scheduledFor??null,next?"active":"expired",now.toISOString(),row.time_id));
  }
  if(statements.length)await env.DB.batch(statements);return Response.json({reconciled:rows.results.length});
}
