import { describe, expect, it } from "vitest";
import { createActivityReport, localDayAndTime, scheduleIsDue } from "../lib/automation-policy";
import { isCrossSiteMutation } from "../lib/request-policy";

describe("schedule policy", () => {
  it("evaluates the user's timezone instead of the server timezone", () => {
    const now = new Date("2026-01-15T13:00:00.000Z");
    expect(localDayAndTime(now, "Asia/Kolkata")).toEqual({ day: "2026-01-15", time: "18:30" });
    expect(scheduleIsDue({ timezone: "Asia/Kolkata", localTime: "09:00" }, now)).toBe(true);
    expect(scheduleIsDue({ timezone: "America/New_York", localTime: "09:00" }, now)).toBe(false);
  });

  it("creates deterministic bounded report content", () => {
    const metadata = { full_name: "owner/repo", default_branch: "main", pushed_at: "2026-01-14T00:00:00Z", open_issues_count: 2, visibility: "private" };
    const first = createActivityReport(metadata, "2026-01-15");
    expect(createActivityReport(metadata, "2026-01-15")).toBe(first);
    expect(first).toContain("owner/repo");
    expect(first).not.toContain("token");
  });
});

describe("request policy", () => {
  it("rejects unsafe cross-site browser mutations", () => {
    expect(isCrossSiteMutation("POST", "https://evil.example", "https://commitkeep.example", "cross-site")).toBe(true);
    expect(isCrossSiteMutation("DELETE", "https://commitkeep.example", "https://commitkeep.example", "same-origin")).toBe(false);
  });

  it("allows cross-site navigation reads and server calls without browser origin headers", () => {
    expect(isCrossSiteMutation("GET", "https://evil.example", "https://commitkeep.example", "cross-site")).toBe(false);
    expect(isCrossSiteMutation("POST", null, "https://commitkeep.example", null)).toBe(false);
  });
});
