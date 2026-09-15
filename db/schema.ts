import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  githubLogin: text("github_login"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);

export const githubInstallations = sqliteTable("github_installations", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull(),
  accountId: text("account_id").notNull(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  status: text("status", { enum: ["active", "suspended", "removed"] }).notNull(),
  htmlUrl: text("html_url"),
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
  rule: text("rule", { enum: ["activity_report", "activity_journal"] }).notNull(),
  mode: text("mode", { enum: ["update", "save", "both"] }).notNull(),
  localTime: text("local_time").notNull(),
  timezone: text("timezone").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  nextRunAt: text("next_run_at"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status", { enum: ["active", "paused", "expired", "disabled"] }).notNull().default("active"),
  version: integer("version").notNull().default(1),
  pausedAt: text("paused_at"),
  pausedBy: text("paused_by"),
  journalAcknowledgedAt: text("journal_acknowledged_at"),
  organizationJournalEnabled: integer("organization_journal_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("schedules_owner_repository_rule_unique").on(table.ownerId, table.repositoryId, table.rule),
  index("schedules_owner_id_idx").on(table.ownerId),
]);

export const scheduleTimes = sqliteTable("schedule_times", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").notNull().references(() => schedules.id, { onDelete: "cascade" }),
  localTime: text("local_time").notNull(),
  nextRunAt: text("next_run_at"),
  lastOccurrenceId: text("last_occurrence_id"),
  status: text("status", { enum: ["active", "expired", "disabled"] }).notNull().default("active"),
  scheduleVersion: integer("schedule_version").notNull().default(1),
  disabledAt: text("disabled_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("schedule_times_schedule_local_time_unique").on(table.scheduleId, table.localTime),
  index("schedule_times_due_idx").on(table.status, table.nextRunAt),
]);

export const repositoryAutomationControls = sqliteTable("repository_automation_controls", {
  repositoryId: text("repository_id").primaryKey().references(() => repositories.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  version: integer("version").notNull().default(1),
  pausedAt: text("paused_at"),
  pausedBy: text("paused_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("repository_automation_owner_status_idx").on(table.ownerId, table.status)]);

export const scheduledOccurrences = sqliteTable("scheduled_occurrences", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  scheduleId: text("schedule_id").notNull().references(() => schedules.id, { onDelete: "cascade" }),
  scheduleTimeId: text("schedule_time_id").notNull().references(() => scheduleTimes.id, { onDelete: "cascade" }),
  scheduleVersion: integer("schedule_version").notNull(),
  localDate: text("local_date").notNull(),
  localTime: text("local_time").notNull(),
  scheduledFor: text("scheduled_for").notNull(),
  status: text("status", { enum: ["claimed", "queued", "running", "completed", "cancelled"] }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  claimedAt: text("claimed_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dispatchOwner: text("dispatch_owner"),
  dispatchExpiresAt: text("dispatch_expires_at"),
  executionAttemptId: text("execution_attempt_id"),
  executionExpiresAt: text("execution_expires_at"),
}, (table) => [
  uniqueIndex("scheduled_occurrences_identity_unique").on(table.scheduleId, table.scheduleVersion, table.localDate, table.localTime),
  index("scheduled_occurrences_status_scheduled_idx").on(table.status, table.scheduledFor),
]);

export const repositoryWriteLeases = sqliteTable("repository_write_leases", {
  repositoryId: text("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  branch: text("branch").notNull(),
  leaseOwner: text("lease_owner").notNull(),
  fencingToken: integer("fencing_token").notNull(),
  leaseExpiresAt: text("lease_expires_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("repository_write_leases_repository_branch_unique").on(table.repositoryId, table.branch)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorType: text("actor_type", { enum: ["user", "system"] }).notNull(),
  event: text("event").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  result: text("result", { enum: ["requested", "succeeded", "failed", "skipped"] }).notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("audit_events_owner_created_idx").on(table.ownerId, table.createdAt)]);

export const scheduleRequests = sqliteTable("schedule_requests", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestHash: text("request_hash").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("schedule_requests_owner_id_unique").on(table.ownerId, table.id)]);

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
  outcome: text("outcome", { enum: ["queued", "running", "committed", "skipped", "skipped_no_changes", "skipped_paused", "skipped_expired", "skipped_stale_version", "conflict", "conflicted", "revoked", "failed", "cancelled"] }).notNull(),
  summary: text("summary").notNull(),
  branch: text("branch"),
  baseSha: text("base_sha"),
  resultSha: text("result_sha"),
  commitUrl: text("commit_url"),
  changedPathsJson: text("changed_paths_json").notNull(),
  errorCode: text("error_code"),
  idempotencyKey: text("idempotency_key").notNull(),
  occurrenceId: text("occurrence_id").references(() => scheduledOccurrences.id, { onDelete: "set null" }),
  scheduleVersion: integer("schedule_version"),
  scheduledFor: text("scheduled_for"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("runs_idempotency_key_unique").on(table.idempotencyKey),
  index("runs_owner_created_at_idx").on(table.ownerId, table.createdAt),
  uniqueIndex("runs_occurrence_id_unique").on(table.occurrenceId),
]);

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  receivedAt: text("received_at").notNull(),
}, (table) => [index("webhook_deliveries_received_at_idx").on(table.receivedAt)]);
