import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const githubInstallations = sqliteTable("github_installations", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull(),
  accountId: text("account_id").notNull(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  status: text("status", { enum: ["active", "suspended", "removed"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("github_installations_installation_id_unique").on(table.installationId),
  index("github_installations_owner_id_idx").on(table.ownerId),
]);

export const githubConnectionStates = sqliteTable("github_connection_states", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("github_connection_states_owner_id_idx").on(table.ownerId)]);

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull().references(() => githubInstallations.installationId),
  githubRepositoryId: text("github_repository_id").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull(),
  private: integer("private", { mode: "boolean" }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("repositories_owner_github_id_unique").on(table.ownerId, table.githubRepositoryId),
  index("repositories_owner_id_idx").on(table.ownerId),
]);

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  rule: text("rule", { enum: ["activity_report"] }).notNull(),
  mode: text("mode", { enum: ["update", "save", "both"] }).notNull(),
  localTime: text("local_time").notNull(),
  timezone: text("timezone").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("schedules_owner_id_idx").on(table.ownerId)]);

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "committing", "committed", "discarded"] }).notNull(),
  claimToken: text("claim_token"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  committedAt: text("committed_at"),
}, (table) => [
  index("drafts_owner_status_idx").on(table.ownerId, table.status),
  index("drafts_repository_path_status_idx").on(table.repositoryId, table.path, table.status),
]);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  scheduleId: text("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
  source: text("source", { enum: ["automatic", "saved_work", "manual"] }).notNull(),
  outcome: text("outcome", { enum: ["queued", "running", "committed", "skipped", "conflict", "failed"] }).notNull(),
  summary: text("summary").notNull(),
  branch: text("branch"),
  baseSha: text("base_sha"),
  resultSha: text("result_sha"),
  commitUrl: text("commit_url"),
  changedPathsJson: text("changed_paths_json").notNull(),
  errorCode: text("error_code"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("runs_idempotency_key_unique").on(table.idempotencyKey),
  index("runs_owner_created_at_idx").on(table.ownerId, table.createdAt),
]);

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  receivedAt: text("received_at").notNull(),
}, (table) => [index("webhook_deliveries_received_at_idx").on(table.receivedAt)]);
