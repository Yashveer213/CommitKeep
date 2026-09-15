import {describe,expect,it} from "vitest";
import {instantForLocal,nextOccurrence,normalizeTimes,occurrenceIdentity,validateDateRange} from "../lib/scheduling";
import {retryPolicy,writeAuthority} from "../lib/execution-policy";

describe("calendar scheduling",()=>{
  it("normalizes one through eight unique times",()=>{expect(normalizeTimes(["18:00","09:00"])).toEqual(["09:00","18:00"]);expect(()=>normalizeTimes(["09:00","09:00"])).toThrow("DUPLICATE_TIME");expect(()=>normalizeTimes(Array(9).fill("09:00"))).toThrow("INVALID_TIME_COUNT")});
  it("validates inclusive date ranges",()=>{expect(()=>validateDateRange("2026-09-16","2026-09-15")).toThrow("INVALID_DATE_RANGE");expect(()=>validateDateRange("2026-02-29",null)).toThrow("INVALID_DATE")});
  it("uses the first valid instant after a DST gap",()=>{expect(instantForLocal("2026-03-08","02:30","America/New_York")).toMatchObject({scheduledFor:"2026-03-08T07:00:00.000Z",dstAdjustment:"forward_gap"})});
  it("uses the earlier instant during a DST overlap",()=>{expect(instantForLocal("2026-11-01","01:30","America/New_York").scheduledFor).toBe("2026-11-01T05:30:00.000Z")});
  it("does not backfill passed times and handles leap days",()=>{expect(nextOccurrence({timezone:"UTC",times:["09:00","18:00"],startDate:"2028-02-29"},new Date("2028-02-29T10:00:00Z"))?.scheduledFor).toBe("2028-02-29T18:00:00.000Z")});
  it("expires after an inclusive end date",()=>{expect(nextOccurrence({timezone:"UTC",times:["09:00"],startDate:"2026-01-01",endDate:"2026-01-01"},new Date("2026-01-01T09:00:00Z"))).toBeNull()});
  it("builds a stable versioned occurrence identity",()=>{expect(occurrenceIdentity("s1",2,"2026-09-15","09:00")).toBe("s1:2:2026-09-15:09:00")});
});

describe("write safety policy",()=>{
  const active={scheduleVersion:2,occurrenceVersion:2,scheduleStatus:"active",automationStatus:"active",repositoryEnabled:true,installationStatus:"active",leaseValid:true};
  it("blocks paused, stale, revoked and unfenced jobs",()=>{expect(writeAuthority({...active,automationStatus:"paused"})).toBe("skipped_paused");expect(writeAuthority({...active,scheduleVersion:3})).toBe("skipped_stale_version");expect(writeAuthority({...active,installationStatus:"removed"})).toBe("revoked");expect(writeAuthority({...active,leaseValid:false})).toBe("cancelled")});
  it("retries only rate limits and server failures with bounds",()=>{expect(retryPolicy(403,null,1)).toBeNull();expect(retryPolicy(429,"120",1)).toEqual({delaySeconds:120});expect(retryPolicy(503,null,20)).toEqual({delaySeconds:1920})});
});
