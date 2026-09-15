import { env } from "cloudflare:workers";
import { createActivityReport } from "@/lib/automation-policy";
import { githubInstallationFetch, githubInstallationRequest } from "@/lib/github-app";

type JobRow = { occurrence_id:string; occurrence_status:string; schedule_id:string; schedule_version:number; current_version:number; schedule_status:string; start_date:string; end_date:string|null; local_date:string; local_time:string; repository_id:string; owner_id:string; full_name:string; default_branch:string; repository_enabled:number; installation_id:string; installation_status:string; automation_status:string|null };
type ContentFile={sha:string;content?:string;encoding?:string};
function database(){if(!env.DB)throw new Error("DATABASE_NOT_CONFIGURED");return env.DB;}

function utf8Base64(value:string){const bytes=new TextEncoder().encode(value);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function decode(value:string){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g,"")),c=>c.charCodeAt(0)));}

async function finish(row:JobRow, runId:string, outcome:string, summary:string, extra:{baseSha?:string;resultSha?:string;commitUrl?:string;errorCode?:string;paths?:string[]}={}){
  const now=new Date().toISOString();
  const db=database();await db.batch([
    db.prepare("UPDATE runs SET outcome=?,summary=?,base_sha=?,result_sha=?,commit_url=?,changed_paths_json=?,error_code=?,completed_at=? WHERE id=? AND occurrence_id=?").bind(outcome,summary,extra.baseSha??null,extra.resultSha??null,extra.commitUrl??null,JSON.stringify(extra.paths??[]),extra.errorCode??null,now,runId,row.occurrence_id),
    db.prepare("UPDATE scheduled_occurrences SET status=?,updated_at=? WHERE id=?").bind(outcome==="cancelled"?"cancelled":"completed",now,row.occurrence_id),
  ]);
  return {outcome};
}

async function effectiveState(occurrenceId:string){
  return database().prepare(`SELECT o.id occurrence_id,o.status occurrence_status,o.schedule_id,o.schedule_version,s.version current_version,s.status schedule_status,s.start_date,s.end_date,o.local_date,o.local_time,r.id repository_id,r.owner_id,r.full_name,r.default_branch,r.enabled repository_enabled,r.installation_id,i.status installation_status,c.status automation_status
    FROM scheduled_occurrences o JOIN schedules s ON s.id=o.schedule_id JOIN repositories r ON r.id=o.repository_id AND r.owner_id=o.owner_id JOIN github_installations i ON i.installation_id=r.installation_id AND i.owner_id=o.owner_id LEFT JOIN repository_automation_controls c ON c.repository_id=r.id AND c.owner_id=o.owner_id WHERE o.id=?`).bind(occurrenceId).first<JobRow>();
}

async function acquireLease(row:JobRow,runId:string){
  const now=new Date();const expires=new Date(now.getTime()+120_000).toISOString();
  const db=database();await db.prepare(`INSERT INTO repository_write_leases(repository_id,branch,lease_owner,fencing_token,lease_expires_at,updated_at) VALUES(?,?,?,1,?,?) ON CONFLICT(repository_id,branch) DO UPDATE SET lease_owner=excluded.lease_owner,fencing_token=repository_write_leases.fencing_token+1,lease_expires_at=excluded.lease_expires_at,updated_at=excluded.updated_at WHERE repository_write_leases.lease_expires_at<=?`).bind(row.repository_id,row.default_branch,runId,expires,now.toISOString(),now.toISOString()).run();
  const lease=await db.prepare("SELECT lease_owner,fencing_token FROM repository_write_leases WHERE repository_id=? AND branch=?").bind(row.repository_id,row.default_branch).first<{lease_owner:string;fencing_token:number}>();
  if(!lease||lease.lease_owner!==runId)throw new Error("REPOSITORY_BUSY");return lease.fencing_token;
}

async function leaseValid(row:JobRow,runId:string,token:number){
  const lease=await database().prepare("SELECT 1 ok FROM repository_write_leases WHERE repository_id=? AND branch=? AND lease_owner=? AND fencing_token=? AND lease_expires_at>?").bind(row.repository_id,row.default_branch,runId,token,new Date().toISOString()).first();return Boolean(lease);
}

export async function executeScheduledOccurrence(occurrenceId:string,runId:string){
  const existing=await database().prepare("SELECT outcome,completed_at FROM runs WHERE id=? AND occurrence_id=?").bind(runId,occurrenceId).first<{outcome:string;completed_at:string|null}>();
  if(!existing)throw new Error("RUN_NOT_FOUND");if(existing.completed_at)return {outcome:existing.outcome,duplicate:true};
  let row=await effectiveState(occurrenceId);if(!row)throw new Error("RUN_NOT_AUTHORIZED");
  if(row.schedule_version!==row.current_version)return finish(row,runId,"skipped_stale_version","The schedule changed after this run was queued.");
  if(row.schedule_status==="expired"||row.local_date<row.start_date||(row.end_date&&row.local_date>row.end_date))return finish(row,runId,"skipped_expired","The schedule is outside its active date range.");
  if(row.schedule_status!=="active"||row.automation_status==="paused")return finish(row,runId,"skipped_paused","Repository schedules were paused before execution.");
  if(!row.repository_enabled||row.installation_status!=="active")return finish(row,runId,"revoked","Repository or installation access is no longer active.",{errorCode:"ACCESS_REVOKED"});
  const fencingToken=await acquireLease(row,runId);
  await database().prepare("UPDATE runs SET outcome='running',summary='Preparing the scheduled repository action.' WHERE id=? AND completed_at IS NULL").bind(runId).run();
  const encoded=row.full_name.split("/").map(encodeURIComponent).join("/");const path=".commitkeep/activity.md";
  try{
    const [metadata,head]=await Promise.all([
      githubInstallationRequest<{full_name:string;default_branch:string;pushed_at:string;open_issues_count:number;visibility:string}>(row.installation_id,`/repos/${encoded}`),
      githubInstallationRequest<{object:{sha:string}}>(row.installation_id,`/repos/${encoded}/git/ref/heads/${encodeURIComponent(row.default_branch)}`),
    ]);
    const report=createActivityReport(metadata,row.local_date);const content=await githubInstallationFetch(row.installation_id,`/repos/${encoded}/contents/${path}?ref=${encodeURIComponent(row.default_branch)}`);
    let file:ContentFile|null=null;if(content.ok)file=await content.json() as ContentFile;else if(content.status!==404)throw new Error(`GITHUB_CONTENT_READ_${content.status}`);
    if(file?.encoding==="base64"&&file.content&&decode(file.content)===report)return finish(row,runId,"skipped_no_changes","The scheduled action produced no repository tree change.",{baseSha:head.object.sha});
    const refreshed=await effectiveState(occurrenceId);if(!refreshed)return finish(row,runId,"revoked","Repository authorization disappeared before the write.",{errorCode:"ACCESS_REVOKED"});row=refreshed;if(row.schedule_version!==row.current_version)return finish(row,runId,"skipped_stale_version","The schedule changed before the write.");
    if(row.schedule_status!=="active"||row.automation_status==="paused")return finish(row,runId,"skipped_paused","Repository schedules were paused before the write.");
    if(row.installation_status!=="active"||!row.repository_enabled)return finish(row,runId,"revoked","Repository access was revoked before the write.");
    if(!await leaseValid(row,runId,fencingToken))throw new Error("LEASE_FENCE_LOST");
    const rechecked=await githubInstallationRequest<{object:{sha:string}}>(row.installation_id,`/repos/${encoded}/git/ref/heads/${encodeURIComponent(row.default_branch)}`);
    if(rechecked.object.sha!==head.object.sha)return finish(row,runId,"conflicted","The branch changed before the scheduled write.",{baseSha:head.object.sha,errorCode:"BRANCH_HEAD_CHANGED"});
    const write=await githubInstallationFetch(row.installation_id,`/repos/${encoded}/contents/${path}`,{method:"PUT",body:JSON.stringify({message:`chore(commitkeep): update activity report for ${row.local_date}`,content:utf8Base64(report),branch:row.default_branch,...(file?{sha:file.sha}:{})})});
    if(!write.ok){const retry=write.headers.get("retry-after");const error=new Error(`GITHUB_CONTENT_WRITE_${write.status}`);(error as Error&{retryAfter?:string}).retryAfter=retry??undefined;throw error;}
    const result=await write.json() as {commit:{sha:string;html_url:string}};return finish(row,runId,"committed","Updated the bounded scheduled repository activity report.",{baseSha:head.object.sha,resultSha:result.commit.sha,commitUrl:result.commit.html_url,paths:[path]});
  }finally{
    await database().prepare("DELETE FROM repository_write_leases WHERE repository_id=? AND branch=? AND lease_owner=? AND fencing_token=?").bind(row.repository_id,row.default_branch,runId,fencingToken).run();
  }
}
