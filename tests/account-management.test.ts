import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("account and GitHub management", () => {
  it("stores GitHub identity fields additively", () => {
    const sql=readFileSync(new URL("../drizzle/0009_account_management.sql",import.meta.url),"utf8");
    expect(sql).toContain("github_login");
    expect(sql).toContain("avatar_url");
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM/);
  });
  it("logs out only the current hashed session and clears caches", () => {
    const route=readFileSync(new URL("../app/api/auth/signout/route.ts",import.meta.url),"utf8");
    expect(route).toContain("sessions.tokenHash");
    expect(route).toContain("Clear-Site-Data");
    expect(route).not.toContain("githubInstallations");
    expect(route).not.toContain("schedules");
  });
  it("configures an active installation instead of starting a new install", () => {
    const route=readFileSync(new URL("../app/api/github/connect/route.ts",import.meta.url),"utf8");
    expect(route).toContain("activeInstallation");
    expect(route).toContain("installation.html_url");
    expect(route).toContain("installations/new");
  });
});
