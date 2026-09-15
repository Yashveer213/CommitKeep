import { env } from "cloudflare:workers";
import { createActivityJournal, createActivityReport } from "@/lib/automation-policy";
import { githubInstallationFetch, githubInstallationRequest } from "@/lib/github-app";

type JobRow = { occurrence_id:string; occurrence_status:string; execution_attempt_id:string|null; schedule_id:string; rule:"activity_report"|"activity_journal"; organization_journal_enabled:number; schedule_version:number; current_version:number; schedule_status:string; start_date:string; end_date:string|null; local_date:string; local_time:string; repository_id:string; owner_id:string; full_name:string; default_branch:string; repository_enabled:number; installation_id:string; installation_status:string; automation_status:string|null };
type ContentFile={sha:string;content?:string;encoding?:string};
function database(){if(!env.DB)throw new Error("DATABASE_NOT_CONFIGURED");return env.DB;}

function utf8Base64(value:string){const bytes=new TextEncoder().encode(value);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function decode(value:string){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g,"")),c=>c.charCodeAt(0)));}

async function remoteContentMatches(installationId:string,encoded:string,path:string,branch:string,expected:string){
  const response=await githubInstallationFetch(installationId,`/repos/${encoded}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if(!response.ok)return false;const file=await response.json() as ContentFile;
  return file.encoding==="base64"&&Boolean(file.content)&&decode(file.content!)===expected;
}

async function finish(row:JobRow, runId:string, outcome:string, summary:string, extra:{baseSha?:string;resultSha?:string;commitUrl?:string;errorCode?:string;paths?:string[]}={}){
  const now=new Date().toISOString();
  const db=database();await db.batch([
    db.prepare("UPDATE runs SET outcome=?,summary=?,base_sha=?,result_sha=?,commit_url=?,changed_paths_json=?,error_code=?,completed_at=? WHERE id=? AND occurrence_id=?").bind(outcome,summary,extra.baseSha??null,extra.resultSha??null,extra.commitUrl??null,JSON.stringify(extra.paths??[]),extra.errorCode??null,now,runId,row.occurrence_id),
    db.prepare("UPDATE scheduled_occurrences SET status=?,updated_at=? WHERE id=?").bind(outcome==="cancelled"?"cancelled":"completed",now,row.occurrence_id),
    db.prepare("INSERT INTO audit_events(id,owner_id,actor_type,event,target_type,target_id,correlation_id,result,metadata_json,created_at) VALUES(?,?,'system',?,'occurrence',?,?,?, ?,?)").bind(crypto.randomUUID(),row.owner_id,row.rule==="activity_journal"?`activity_journal_${outcome}`:`scheduled_action_${outcome}`,row.occurrence_id,row.occurrence_id,outcome==="failed"?"failed":outcome.startsWith("skipped")?"skipped":"succeeded",JSON.stringify({scheduleId:row.schedule_id,path:extra.paths?.[0]??null}),now),
  ]);
  return {outcome};
}

async function effectiveState(occurrenceId:string){
  return database().prepare(`SELECT o.id occurrence_id,o.status occurrence_status,o.execution_attempt_id,o.schedule_id,o.schedule_version,s.rule,s.organization_journal_enabled,s.version current_version,s.status schedule_status,s.start_date,s.end_date,o.local_date,o.local_time,r.id repository_id,r.owner_id,r.full_name,r.default_branch,r.enabled repository_enabled,r.installation_id,i.status installation_status,c.status automation_status
    FROM scheduled_occurrences o JOIN schedules s ON s.id=o.schedule_id JOIN repositories r ON r.id=o.repository_id AND r.owner_id=o.owner_id JOIN github_installations i ON i.installation_id=r.installation_id AND i.owner_id=o.owner_id LEFT JOIN repository_automation_controls c ON c.repository_id=r.id AND c.owner_id=o.owner_id WHERE o.id=?`).bind(occurrenceId).first<JobRow>();
}

async function acquireLease(row:JobRow,attemptId:string){
  const now=new Date();const expires=new Date(now.getTime()+120_000).toISOString();
  const db=database();await db.prepare(`INSERT INTO repository_write_leases(repository_id,branch,lease_owner,fencing_token,lease_expires_at,updated_at) VALUES(?,?,?,1,?,?) ON CONFLICT(repository_id,branch) DO UPDATE SET lease_owner=excluded.lease_owner,fencing_token=repository_write_leases.fencing_token+1,lease_expires_at=excluded.lease_expires_at,updated_at=excluded.updated_at WHERE repository_write_leases.lease_expires_at<=?`).bind(row.repository_id,row.default_branch,attemptId,expires,now.toISOString(),now.toISOString()).run();
  const lease=await db.prepare("SELECT lease_owner,fencing_token FROM repository_write_leases WHERE repository_id=? AND branch=?").bind(row.repository_id,row.default_branch).first<{lease_owner:string;fencing_token:number}>();
  if(!lease||lease.lease_owner!==attemptId)throw new Error("REPOSITORY_BUSY");return lease.fencing_token;
}

async function leaseValid(row:JobRow,attemptId:string,token:number){
  const lease=await database().prepare("SELECT 1 ok FROM repository_write_leases WHERE repository_id=? AND branch=? AND lease_owner=? AND fencing_token=? AND lease_expires_at>?").bind(row.repository_id,row.default_branch,attemptId,token,new Date().toISOString()).first();return Boolean(lease);
}

export async function executeScheduledOccurrence(occurrenceId:string,runId:string,attemptId:string){
  const existing=await database().prepare("SELECT outcome,completed_at FROM runs WHERE id=? AND occurrence_id=?").bind(runId,occurrenceId).first<{outcome:string;completed_at:string|null}>();
  if(!existing)throw new Error("RUN_NOT_FOUND");if(existing.completed_at)return {outcome:existing.outcome,duplicate:true};
  const claimNow=new Date().toISOString();const claimExpiry=new Date(Date.now()+120_000).toISOString();const claim=await database().prepare("UPDATE scheduled_occurrences SET status='running',execution_attempt_id=?,execution_expires_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND (status='queued' OR (status='running' AND execution_expires_at<=?))").bind(attemptId,claimExpiry,claimNow,occurrenceId,claimNow).run();
  if(!claim.meta.changes)throw new Error("OCCURRENCE_ALREADY_CLAIMED");
  let row=await effectiveState(occurrenceId);if(!row)throw new Error("RUN_NOT_AUTHORIZED");
  if(row.schedule_version!==row.current_version)return finish(row,runId,"skipped_stale_version","The schedule changed after this run was queued.");
  if(row.schedule_status==="expired"||row.local_date<row.start_date||(row.end_date&&row.local_date>row.end_date))return finish(row,runId,"skipped_expired","The schedule is outside its active date range.");
  if(row.schedule_status!=="active"||row.automation_status==="paused")return finish(row,runId,"skipped_paused","Repository schedules were paused before execution.");
  if(!row.repository_enabled||row.installation_status!=="active")return finish(row,runId,"revoked","Repository or installation access is no longer active.",{errorCode:"ACCESS_REVOKED"});
  const fencingToken=await acquireLease(row,attemptId);
  await database().prepare("UPDATE runs SET outcome='running',summary='Preparing the scheduled repository action.' WHERE id=? AND completed_at IS NULL").bind(runId).run();
  const encoded=row.full_name.split("/").map(encodeURIComponent).join("/");const path=row.rule==="activity_journal"?`.commitkeep/log/${row.local_date.slice(0,7)}.md`:".commitkeep/activity.md";
  try{
    const [metadata,head]=await Promise.all([
      githubInstallationRequest<{full_name:string;default_branch:string;pushed_at:string;open_issues_count:number;visibility:string;archived:boolean;fork:boolean;permissions?:{push?:boolean};owner:{type:string}}>(row.installation_id,`/repos/${encoded}`),
      githubInstallationRequest<{object:{sha:string}}>(row.installation_id,`/repos/${encoded}/git/ref/heads/${encodeURIComponent(row.default_branch)}`),
    ]);
    if(row.rule==="activity_journal"&&(metadata.archived||metadata.fork||metadata.permissions?.push===false))return finish(row,runId,"revoked","Activity journal is unavailable for archived, forked, or read-only repositories.",{errorCode:"JOURNAL_REPOSITORY_RESTRICTED"});
    if(row.rule==="activity_journal"&&metadata.owner.type==="Organization"&&!row.organization_journal_enabled)return finish(row,runId,"revoked","Organization activity journal authorization is not enabled.",{errorCode:"ORGANIZATION_JOURNAL_NOT_ENABLED"});
    const content=await githubInstallationFetch(row.installation_id,`/repos/${encoded}/contents/${path}?ref=${encodeURIComponent(row.default_branch)}`);
    let file:ContentFile|null=null;if(content.ok)file=await content.json() as ContentFile;else if(content.status!==404)throw new Error(`GITHUB_CONTENT_READ_${content.status}`);
    const existingContent=file?.encoding==="base64"&&file.content?decode(file.content):"";const report=row.rule==="activity_journal"?createActivityJournal(existingContent,metadata,row.local_date,row.local_time,row.occurrence_id):createActivityReport(metadata,row.local_date);
    if(existingContent===report)return finish(row,runId,"skipped_no_changes","The scheduled action produced no repository tree change.",{baseSha:head.object.sha});
    const refreshed=await effectiveState(occurrenceId);if(!refreshed)return finish(row,runId,"revoked","Repository authorization disappeared before the write.",{errorCode:"ACCESS_REVOKED"});row=refreshed;if(row.schedule_version!==row.current_version)return finish(row,runId,"skipped_stale_version","The schedule changed before the write.");
    if(row.schedule_status!=="active"||row.automation_status==="paused")return finish(row,runId,"skipped_paused","Repository schedules were paused before the write.");
    if(row.installation_status!=="active"||!row.repository_enabled)return finish(row,runId,"revoked","Repository access was revoked before the write.");
    if(row.execution_attempt_id!==attemptId||!await leaseValid(row,attemptId,fencingToken))throw new Error("LEASE_FENCE_LOST");
    const rechecked=await githubInstallationRequest<{object:{sha:string}}>(row.installation_id,`/repos/${encoded}/git/ref/heads/${encodeURIComponent(row.default_branch)}`);
    if(rechecked.object.sha!==head.object.sha)return finish(row,runId,"conflicted","The branch changed before the scheduled write.",{baseSha:head.object.sha,errorCode:"BRANCH_HEAD_CHANGED"});
    const finalState=await effectiveState(occurrenceId);
    if(!finalState||finalState.execution_attempt_id!==attemptId||finalState.schedule_version!==finalState.current_version||finalState.schedule_status!=="active"||finalState.automation_status==="paused"||finalState.installation_status!=="active"||!finalState.repository_enabled||!await leaseValid(finalState,attemptId,fencingToken))return finish(row,runId,"skipped_paused","Authoritative state changed immediately before the repository write.");
    let write:Response;
    try{write=await githubInstallationFetch(row.installation_id,`/repos/${encoded}/contents/${path}`,{method:"PUT",body:JSON.stringify({message:row.rule==="activity_journal"?`chore(commitkeep): append disclosed activity journal for ${row.local_date}`:`chore(commitkeep): update activity report for ${row.local_date}`,content:utf8Base64(report),branch:row.default_branch,...(file?{sha:file.sha}:{})})});}
    catch(error){if(await remoteContentMatches(row.installation_id,encoded,path,row.default_branch,report))return finish(row,runId,"committed","The scheduled write succeeded and was reconciled after an ambiguous response.",{baseSha:head.object.sha,paths:[path]});throw error;}
    if(!write.ok){
      if(write.status>=500&&await remoteContentMatches(row.installation_id,encoded,path,row.default_branch,report))return finish(row,runId,"committed","The scheduled write succeeded and was reconciled after an ambiguous response.",{baseSha:head.object.sha,paths:[path]});
      const retry=write.headers.get("retry-after");const error=new Error(`GITHUB_CONTENT_WRITE_${write.status}`);(error as Error&{retryAfter?:string}).retryAfter=retry??undefined;throw error;
    }
    const result=await write.json() as {commit:{sha:string;html_url:string}};
    const acceptedState=await effectiveState(occurrenceId);
    if(acceptedState&&(acceptedState.schedule_status!=="active"||acceptedState.automation_status==="paused"))await database().prepare("INSERT INTO audit_events(id,owner_id,actor_type,event,target_type,target_id,correlation_id,result,metadata_json,created_at) VALUES(?,?,'system','write_accepted_during_state_change','occurrence',?,?,'succeeded',?,?)").bind(crypto.randomUUID(),row.owner_id,row.occurrence_id,row.occurrence_id,JSON.stringify({fencingToken}),new Date().toISOString()).run();
    return finish(row,runId,"committed",row.rule==="activity_journal"?"Appended a disclosed scheduled activity-journal entry.":"Updated the bounded scheduled repository activity report.",{baseSha:head.object.sha,resultSha:result.commit.sha,commitUrl:result.commit.html_url,paths:[path]});
  }finally{
    await database().prepare("DELETE FROM repository_write_leases WHERE repository_id=? AND branch=? AND lease_owner=? AND fencing_token=?").bind(row.repository_id,row.default_branch,attemptId,fencingToken).run();
  }
}
