import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { diffScheduleTimes } from "../lib/schedule-time-diff";

describe("phase 1 additive migration", () => {
  const sql = readFileSync(new URL("../drizzle/0008_release_safety.sql", import.meta.url), "utf8");
  it("adds delivery fencing without destructive table changes", () => {
    expect(sql).toContain("execution_attempt_id");
    expect(sql).toContain("dispatch_owner");
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM/);
  });
  it("migrates unsupported legacy modes to the daily report", () => {
    expect(sql).toContain("WHERE `mode` IN ('save', 'both')");
  });
});

describe("schedule-time lifecycle", () => {
  it("retains IDs and identifies added and removed rows", () => {
    const diff = diffScheduleTimes([
      { id: "time-a", localTime: "09:00", status: "active" },
      { id: "time-b", localTime: "13:00", status: "active" },
    ], ["09:00", "18:00"]);
    expect(diff.retained.map((row) => row.id)).toEqual(["time-a"]);
    expect(diff.added).toEqual(["18:00"]);
    expect(diff.removed.map((row) => row.id)).toEqual(["time-b"]);
  });
});

describe("delivery identity invariant", () => {
  it("passes a unique attempt through the consumer into fencing", () => {
    const consumer = readFileSync(new URL("../workers/job-consumer.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/api/internal/jobs/execute/route.ts", import.meta.url), "utf8");
    const execution = readFileSync(new URL("../lib/scheduled-execution.ts", import.meta.url), "utf8");
    expect(consumer).toContain("crypto.randomUUID()");
    expect(route).toContain("attemptId");
    expect(execution).toContain("execution_attempt_id=?");
    expect(execution).toContain("lease_owner=? AND fencing_token=?");
  });
});
