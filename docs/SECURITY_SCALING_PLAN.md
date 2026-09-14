# Security, architecture, and scaling construction plan

## 1. System boundary

CommitKeep has four trust zones:

1. The browser/PWA, which is untrusted and may be compromised.
2. The public application/API edge, which authenticates and authorizes every request.
3. The job system, which performs repository operations with short-lived GitHub credentials.
4. The optional desktop companion, which has narrowly approved access to selected local folders.

The browser never receives a GitHub App private key or installation token. The desktop companion never receives server-wide credentials. The job runner treats repository contents, commit messages, and webhook payloads as untrusted input.

## 2. Proposed production architecture

```text
Browser / PWA
      |
      v
Edge application + API ----> D1 metadata and history
      |                         |
      |                         +--> R2 encrypted/sanitized large artifacts
      v
Scheduler ----> Queue / Workflow ----> GitHub API
                      |
                      +----> audit events, metrics, retries, dead-letter queue

Desktop companion --device session--> Companion API --enqueue--> job system
```

Use Workers for short request/response work. Put GitHub fetch, patch generation, retries, and commit creation in a queue consumer or durable workflow. This separates user traffic from automation spikes and supports controlled concurrency.

## 3. Data classification and retention

| Class | Examples | Storage rule | Default retention |
| --- | --- | --- | --- |
| Credentials | GitHub App key, wrapping key, OAuth verifier | Secret store only; never logs or D1 | Until rotation/revocation |
| Short-lived tokens | Installation/user access token | Memory for one job; encrypted only if a resumable workflow requires it | Minutes, then destroyed |
| Private repository metadata | Repository name, branch, file paths, commit SHAs | Encrypted transport, owner-scoped rows | Account lifetime or user-configured |
| Patch content | Diffs and generated file contents | Avoid storage; encrypted R2 only when preview/recovery requires it | 24 hours by default |
| Audit history | Action, actor, outcome, timestamps, sanitized error | Append-oriented D1 records | 12 months, configurable |
| Product analytics | Counts and latency without code/file contents | Aggregated and pseudonymous | 90 days |

Deletion removes active records promptly, revokes GitHub access, queues blob deletion, and retains only legally required or security-minimal tombstones. Define the exact policy before public launch.

## 4. Security layers

### Identity and session

- Standards-based sign-in with secure, HttpOnly, SameSite cookies.
- Rotate session identifiers after sign-in and sensitive account changes.
- Short idle and absolute session limits for repository-write surfaces.
- MFA recommendation for users and mandatory MFA/passkeys for operators.
- CSRF protection on every browser write; strict Origin checks for sensitive endpoints.

### Authorization and tenant isolation

- Resolve the authenticated user on the server for every request.
- Every owned table includes `owner_user_id`; every query includes it or uses a repository layer that requires it.
- Never accept an owner ID, installation ID, or repository permission claim from the client without server verification.
- Check GitHub installation access again when a job starts.
- Add negative authorization tests for read, update, delete, export, and job-trigger routes.

### GitHub credentials and permissions

- Request only the GitHub App permissions needed by enabled features.
- Prefer installation tokens minted just in time; do not store them after the job.
- Encrypt any refreshable user credential with envelope encryption and a versioned wrapping key.
- Rotate the GitHub App private key and webhook secret; support overlapping keys during rotation.
- Verify webhook signatures using constant-time comparison, reject stale timestamps, and deduplicate delivery IDs.
- Treat uninstall, suspension, and repository-removal webhooks as immediate access revocation.

### Repository-write guardrails

- Per-repository allowlist of branches and writable path patterns.
- Default deny for `.github/workflows/**`, secret/config files, generated credentials, and binary files.
- Cap changed files, total patch size, and individual file size.
- Compare the current branch head with the planned base SHA immediately before writing.
- Generate a deterministic tree and skip when it matches the current tree.
- Use an idempotency key and a uniqueness constraint so retries cannot create duplicate commits.
- Support pull-request mode for protected or higher-risk repositories.
- Run content rules in a restricted execution environment with outbound network allowlists and time/CPU/memory limits.

### API and edge protection

- TLS only, HSTS after domain verification, secure headers, restrictive Content Security Policy, and no framing.
- Schema validation for every input and bounded pagination for every list.
- Rate limits by user, installation, IP risk signal, and action type.
- Bot and abuse controls on unauthenticated and expensive endpoints.
- Do not expose sequential internal IDs; use cryptographically random public IDs.
- Redact credentials, source contents, diffs, email addresses, and webhook bodies from logs.

### Desktop companion

- Signed releases and automatic update verification.
- Explicit folder selection and visible revocation per device.
- OS keychain for device credentials; never plaintext configuration files.
- Device-bound, short-lived access with rotation and remote revocation.
- Local ignore rules plus secret scanning before upload.
- Send patches or Git objects required for the selected repository, never unrelated filesystem contents.
- Show the exact pending files and destination before the first write mode is enabled.

### Supply chain and operations

- Lock dependencies, review lockfile changes, run vulnerability and secret scanning in CI.
- Protect the main branch, require reviewed pull requests, and use signed release artifacts.
- Separate development, staging, and production accounts, databases, apps, and secrets.
- Least-privilege operator roles with audited administrative actions.
- Structured logs, traces, metrics, alerting, and an incident-response runbook.
- Backups and restoration drills; a backup is not accepted until a restore is tested.

## 5. Core data model

Minimum tables:

- `users`: stable identity, status, timestamps.
- `github_installations`: owner, GitHub installation/account identifiers, status, permissions snapshot.
- `repositories`: owner, installation, GitHub repository ID, default/selected branch, write mode, status.
- `schedules`: owner, repository, rule, IANA timezone, local time, next run, paused state.
- `content_rules`: owner, repository, rule type, allowed paths, bounded configuration, version.
- `devices`: owner, public device ID, key fingerprint, last seen, revoked timestamp.
- `drafts`: owner, repository, base SHA, summary, encrypted artifact reference, expiry.
- `runs`: owner, repository, schedule/device source, idempotency key, base/result SHA, state, timestamps, sanitized error.
- `run_files`: run, path, change type, additions/deletions, optional short-lived artifact reference.
- `audit_events`: owner/operator actor, action, target, request correlation ID, result, timestamp.

Indexes follow actual access patterns: owner plus updated time, repository plus run time, due schedules by next-run time, and a unique idempotency key. Do not place full repository files or large diffs in D1 rows.

## 6. Job state machine

```text
scheduled -> queued -> acquiring_token -> reading_repository -> planning_change
          -> awaiting_approval (when configured)
          -> writing_commit -> recording_result -> succeeded

Any executable state -> retrying -> same state
Any state -> skipped | conflicted | revoked | failed | cancelled
```

Transitions are append-audited. A run owns one idempotency key. Only the transition that successfully claims `writing_commit` may create the GitHub commit.

## 7. Scaling plan

### Initial release

- One edge application, one D1 database, and one job queue/workflow service.
- Indexed owner/repository/run queries and cursor pagination.
- Scheduled dispatcher scans only the indexed due-time window and enqueues small identifiers, not code or diffs.
- Queue consumers use bounded concurrency per GitHub installation to respect API limits and avoid branch races.
- R2 stores only short-lived large artifacts; history stores summaries and immutable GitHub links.

### Growth point

Measure D1 query latency, write contention, queue delay, GitHub secondary rate limits, and per-installation job concurrency. Partition when one database's write queue or storage approaches the agreed headroom threshold. Cloudflare documents D1 as a horizontal scale-out system and currently caps an individual paid database at 10 GB; per-tenant or hashed shards are the natural next step.

### Larger scale

- Route users to D1 shards through a small directory mapping.
- Partition jobs by repository or installation so writes remain ordered locally while different repositories execute in parallel.
- Separate API, scheduler, webhook, and job workers with service bindings.
- Add read replicas/caching only for measured read pressure; never cache authorization decisions longer than revocation requirements allow.
- Use queue backpressure, admission limits, and dead-letter queues instead of allowing automation spikes to exhaust interactive traffic.
- For enterprise requirements, consider tenant-isolated databases and encryption keys.

Cloudflare currently documents 5,000 messages/second per queue and up to 250 concurrent push consumers, while paid Workflows documents up to 50,000 concurrent instances. These are platform ceilings, not our launch targets; GitHub API limits and repository conflicts will usually require lower per-installation concurrency.

## 8. Capacity model and traffic handling

Define one automation unit as one repository read, one bounded rule evaluation, and zero or one write. Capacity planning uses:

```text
daily jobs = active repositories × schedules per repository
peak enqueue rate = daily jobs concentrated in the busiest scheduling window
worker concurrency = min(queue capacity, GitHub allowance, database allowance, repository locks)
```

The architecture can handle substantial traffic because interactive requests only validate/store intent and enqueue work. The queue absorbs daily-time spikes, and consumers scale horizontally. The critical limits are safe GitHub concurrency, database write contention, and patch-generation cost. We must prove targets with load tests rather than infer them from provider ceilings.

Suggested release targets:

- 99.9% monthly availability for authenticated reads and schedule management.
- 95% of interactive API requests under 500 ms at the edge, excluding GitHub operations.
- 99% of due jobs start within 5 minutes under normal load.
- 99% of successful bounded jobs finish within 10 minutes.
- Zero duplicate commits in idempotency and retry tests.
- Zero cross-user data access in automated authorization tests.

Load-test steps: 10× expected interactive request rate, a synchronized daily schedule spike, GitHub 429/5xx injection, slow database queries, queue backlog recovery, webhook replay, and duplicate job delivery.

## 9. Reliability and recovery

- Retry only transient failures with exponential backoff and jitter.
- Do not retry authorization failures, revoked access, invalid rules, or branch conflicts automatically.
- Move exhausted jobs to a dead-letter queue with a visible history entry and operator alert.
- Keep GitHub writes small and atomic; record the GitHub result before acknowledging the job.
- Reconcile ambiguous writes by searching for the idempotency marker/result SHA before retrying.
- Use point-in-time database recovery and periodic logical exports; test restoration quarterly.
- Define recovery targets before launch: suggested RPO 15 minutes for metadata and RTO 4 hours initially.

## 10. Privacy and user controls

- A clear data inventory and privacy notice before connecting GitHub.
- Repository-level disconnect, history retention controls, data export, account deletion, and device revocation.
- No selling repository metadata or training models on private code without a separate explicit opt-in.
- Minimize collection: store IDs and summaries where full names, emails, source files, or raw diffs are unnecessary.
- Record administrative access and make support tooling read-only by default.

## 11. Release gates

Stage 2 cannot enable production writes until:

- Tenant-isolation, webhook verification, token lifecycle, CSRF, idempotency, branch conflict, and path-allowlist tests pass.
- Secret scanning finds no committed credential.
- GitHub App permissions are documented and reviewed.
- Staging uses a separate app and test repositories.

Stage 3 cannot launch publicly until:

- Threat model, penetration test, dependency review, load test, backup restore, incident drill, and privacy/deletion test pass.
- Alerts and runbooks cover queue backlog, GitHub failure rates, auth failures, database overload, and deployment rollback.
- Custom domain, TLS, DNSSEC, CSP, security headers, and registrar protections are verified.

## 12. Current platform references

- Workers best practices: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 limits and scale-out guidance: https://developers.cloudflare.com/d1/platform/limits/
- Queues limits: https://developers.cloudflare.com/queues/platform/limits/
- Workflows limits: https://developers.cloudflare.com/workflows/reference/limits/
- Custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

Review numeric limits and prices again before each production capacity decision because provider limits change.

