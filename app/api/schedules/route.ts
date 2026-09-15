import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { repositories, schedules } from "@/db/schema";
import { isValidTimezone, nextOccurrence, normalizeTimes, validateDateRange } from "@/lib/scheduling";

const createSchema=z.object({repositoryIds:z.array(z.string().uuid()).min(1).max(50),action:z.enum(["activity_report","activity_journal"]),mode:z.literal("update"),times:z.array(z.string()).min(1).max(8),timezone:z.string().min(1).max(100),startDate:z.string(),endDate:z.string().nullable().optional(),journalAcknowledged:z.boolean().optional(),organizationJournalEnabled:z.boolean().optional()}).strict();
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}

export async function GET(){
  const account=await getChatGPTUser();if(!account)return Response.json({error:"Sign in to view schedules."},{status:401});
  if(!env.DB)return Response.json({error:"Database is unavailable."},{status:503});
  const rows=await env.DB.prepare(`SELECT s.id,s.repository_id,s.rule action,s.mode,s.timezone,s.start_date,s.end_date,s.status,s.version,s.paused_at,st.id time_id,st.local_time,st.next_run_at FROM schedules s LEFT JOIN schedule_times st ON st.schedule_id=s.id WHERE s.owner_id=? ORDER BY s.created_at,st.local_time`).bind(account.userId).all<Record<string,unknown>>();
  const grouped=new Map<string,Record<string,unknown>&{times:{id:string;localTime:string;nextRunAt:string|null}[]}>();
  for(const row of rows.results){const id=String(row.id);if(!grouped.has(id))grouped.set(id,{id,repositoryId:row.repository_id,action:row.action,mode:row.mode,timezone:row.timezone,startDate:row.start_date,endDate:row.end_date,status:row.status,version:row.version,pausedAt:row.paused_at,times:[]});if(row.time_id)grouped.get(id)!.times.push({id:String(row.time_id),localTime:String(row.local_time),nextRunAt:row.next_run_at?String(row.next_run_at):null})}
  return Response.json({schedules:[...grouped.values()]});
}

export async function POST(request:Request){
  const account=await getChatGPTUser();if(!account)return Response.json({error:"Sign in to create schedules."},{status:401});
  const key=request.headers.get("idempotency-key");if(!key||!z.string().uuid().safeParse(key).success)return Response.json({error:"A valid Idempotency-Key header is required.",code:"IDEMPOTENCY_KEY_REQUIRED"},{status:400});
  const parsed=createSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"Review the repository, time, timezone, and date fields.",code:"VALIDATION_FAILED",issues:parsed.error.issues},{status:400});
  let times:string[];try{times=normalizeTimes(parsed.data.times);validateDateRange(parsed.data.startDate,parsed.data.endDate)}catch(error){return Response.json({error:"Times must be unique and dates must form a valid inclusive range.",code:error instanceof Error?error.message:"VALIDATION_FAILED"},{status:400})}
  if(!isValidTimezone(parsed.data.timezone))return Response.json({error:"Choose a valid IANA timezone.",code:"INVALID_TIMEZONE"},{status:400});
  if(parsed.data.action==="activity_journal"&&(!parsed.data.journalAcknowledged||times.length!==1))return Response.json({error:"Activity journal requires acknowledgement and exactly one daily time.",code:"JOURNAL_SAFEGUARD_REQUIRED"},{status:400});
  const repositoryIds=[...new Set(parsed.data.repositoryIds)].sort();if(repositoryIds.length!==parsed.data.repositoryIds.length)return Response.json({error:"Select each repository once.",code:"DUPLICATE_REPOSITORY"},{status:400});
  const canonical=JSON.stringify({...parsed.data,repositoryIds,times,endDate:parsed.data.endDate??null});const requestHash=await hash(canonical);if(!env.DB)return Response.json({error:"Database is unavailable."},{status:503});
  const prior=await env.DB.prepare("SELECT request_hash,response_json FROM schedule_requests WHERE id=? AND owner_id=?").bind(key,account.userId).first<{request_hash:string;response_json:string}>();
  if(prior){if(prior.request_hash!==requestHash)return Response.json({error:"This idempotency key was used for different settings.",code:"IDEMPOTENCY_KEY_REUSED"},{status:409});return Response.json(JSON.parse(prior.response_json));}
  const owned=await getDb().select().from(repositories).where(and(eq(repositories.ownerId,account.userId),eq(repositories.enabled,true),inArray(repositories.id,repositoryIds)));
  if(owned.length!==repositoryIds.length)return Response.json({error:"One or more repositories are unavailable.",code:"REPOSITORY_NOT_AUTHORIZED"},{status:404});
  const now=new Date();const statements:D1PreparedStatement[]=[];const result:{id:string;repositoryId:string;version:number;times:string[]}[]=[];
  for(const repository of owned){
    const existing=(await getDb().select().from(schedules).where(and(eq(schedules.ownerId,account.userId),eq(schedules.repositoryId,repository.id),eq(schedules.rule,parsed.data.action))).limit(1))[0];const id=existing?.id??crypto.randomUUID();const version=(existing?.version??0)+1;
    const installation=await env.DB.prepare("SELECT account_type FROM github_installations WHERE installation_id=? AND owner_id=? AND status='active'").bind(repository.installationId,account.userId).first<{account_type:string}>();
    if(parsed.data.action==="activity_journal"&&installation?.account_type==="Organization"&&!parsed.data.organizationJournalEnabled)return Response.json({error:"Organization repositories require explicit activity-journal authorization.",code:"ORGANIZATION_JOURNAL_CONFIRMATION_REQUIRED"},{status:400});
    statements.push(env.DB.prepare(`INSERT INTO schedules(id,owner_id,repository_id,rule,mode,local_time,timezone,enabled,next_run_at,start_date,end_date,status,version,paused_at,paused_by,journal_acknowledged_at,organization_journal_enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,NULL,?,?,'active',?,NULL,NULL,?,?,?,?) ON CONFLICT(owner_id,repository_id,rule) DO UPDATE SET mode=excluded.mode,local_time=excluded.local_time,timezone=excluded.timezone,start_date=excluded.start_date,end_date=excluded.end_date,status='active',enabled=1,version=excluded.version,paused_at=NULL,paused_by=NULL,journal_acknowledged_at=excluded.journal_acknowledged_at,organization_journal_enabled=excluded.organization_journal_enabled,updated_at=excluded.updated_at`).bind(id,account.userId,repository.id,parsed.data.action,parsed.data.mode,times[0],parsed.data.timezone,parsed.data.startDate,parsed.data.endDate??null,version,parsed.data.action==="activity_journal"?now.toISOString():null,parsed.data.organizationJournalEnabled?1:0,existing?.createdAt??now.toISOString(),now.toISOString()));
    const priorTimes=existing?(await env.DB.prepare("SELECT id,local_time localTime,status FROM schedule_times WHERE schedule_id=?").bind(existing.id).all<{id:string;localTime:string;status:string}>()).results:[];const timeDiff=diffScheduleTimes(priorTimes,times);
    for(const prior of timeDiff.removed)statements.push(env.DB.prepare("UPDATE schedule_times SET status='disabled',disabled_at=?,next_run_at=NULL,updated_at=? WHERE id=? AND schedule_id=?").bind(now.toISOString(),now.toISOString(),prior.id,id));
    for(const prior of timeDiff.retained){const next=nextOccurrence({timezone:parsed.data.timezone,times:[prior.localTime],startDate:parsed.data.startDate,endDate:parsed.data.endDate},now);statements.push(env.DB.prepare("UPDATE schedule_times SET next_run_at=?,status=?,schedule_version=?,disabled_at=NULL,updated_at=? WHERE id=? AND schedule_id=?").bind(next?.scheduledFor??null,next?"active":"expired",version,now.toISOString(),prior.id,id));}
    for(const localTime of timeDiff.added){const next=nextOccurrence({timezone:parsed.data.timezone,times:[localTime],startDate:parsed.data.startDate,endDate:parsed.data.endDate},now);statements.push(env.DB.prepare("INSERT INTO schedule_times(id,schedule_id,local_time,next_run_at,last_occurrence_id,status,schedule_version,disabled_at,created_at,updated_at) VALUES(?,?,?,?,NULL,?,?,NULL,?,?)").bind(crypto.randomUUID(),id,localTime,next?.scheduledFor??null,next?"active":"expired",version,now.toISOString(),now.toISOString()))}
    statements.push(env.DB.prepare(`INSERT INTO repository_automation_controls(repository_id,owner_id,status,version,paused_at,paused_by,created_at,updated_at) VALUES(?,?,'active',1,NULL,NULL,?,?) ON CONFLICT(repository_id) DO NOTHING`).bind(repository.id,account.userId,now.toISOString(),now.toISOString()));
    result.push({id,repositoryId:repository.id,version,times});
    if(parsed.data.action==="activity_journal")statements.push(env.DB.prepare("INSERT INTO audit_events(id,owner_id,actor_type,event,target_type,target_id,correlation_id,result,metadata_json,created_at) VALUES(?,?,'user','activity_journal_enabled','schedule',?,?,'succeeded',?,?)").bind(crypto.randomUUID(),account.userId,id,key,JSON.stringify({path:".commitkeep/log/YYYY-MM.md",dailyLimit:1}),now.toISOString()));
  }
  const response={schedules:result,timezone:parsed.data.timezone,startDate:parsed.data.startDate,endDate:parsed.data.endDate??null};statements.push(env.DB.prepare("INSERT INTO schedule_requests(id,owner_id,request_hash,response_json,created_at) VALUES(?,?,?,?,?)").bind(key,account.userId,requestHash,JSON.stringify(response),now.toISOString()));await env.DB.batch(statements);return Response.json(response,{status:201});
}
import { diffScheduleTimes } from "@/lib/schedule-time-diff";
