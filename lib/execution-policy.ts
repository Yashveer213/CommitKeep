export function retryPolicy(status:number,retryAfter:string|null,attempt:number){
  if(status!==429&&status<500)return null;
  const supplied=Number(retryAfter??"");
  const delaySeconds=Number.isFinite(supplied)&&supplied>0?supplied:15*2**Math.min(attempt,7);
  return {delaySeconds:Math.min(3600,Math.max(5,delaySeconds))};
}

export function writeAuthority(input:{scheduleVersion:number;occurrenceVersion:number;scheduleStatus:string;automationStatus:string;repositoryEnabled:boolean;installationStatus:string;leaseValid:boolean}){
  if(input.scheduleVersion!==input.occurrenceVersion)return "skipped_stale_version";
  if(input.scheduleStatus==="expired")return "skipped_expired";
  if(input.scheduleStatus!=="active"||input.automationStatus==="paused")return "skipped_paused";
  if(!input.repositoryEnabled||input.installationStatus!=="active")return "revoked";
  if(!input.leaseValid)return "cancelled";
  return "authorized";
}
