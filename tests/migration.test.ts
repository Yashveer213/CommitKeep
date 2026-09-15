import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("0006 additive scheduling migration",()=>{
  const sql=readFileSync(new URL("../drizzle/0006_omniscient_jocasta.sql",import.meta.url),"utf8");
  it("does not drop or recreate legacy tables",()=>{expect(sql).not.toMatch(/DROP TABLE|CREATE TABLE `schedules`|CREATE TABLE `runs`/)});
  it("backfills child times and repository controls",()=>{expect(sql).toContain("INSERT OR IGNORE INTO `schedule_times`");expect(sql).toContain("SELECT lower(hex(randomblob(16))),`id`,`local_time`");expect(sql).toContain("INSERT OR IGNORE INTO `repository_automation_controls`")});
  it("adds due, occurrence, and lease indexes",()=>{expect(sql).toContain("schedule_times_due_idx");expect(sql).toContain("scheduled_occurrences_identity_unique");expect(sql).toContain("repository_write_leases_repository_branch_unique")});
});
