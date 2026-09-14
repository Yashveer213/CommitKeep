# CommitKeep construction and scaling plan

## System layout

The browser provides setup, history, and PWA installation. Server routes enforce the signed-in account on every query and mutation. A GitHub App grants repository-scoped access. D1 stores ownership, schedules, and audit records. A scheduled Worker invokes the internal tick; production growth should move each due run into Cloudflare Queues or Workflows so retries and concurrency are isolated from HTTP requests. R2 is reserved for short-lived large patches or artifacts and never becomes the routine audit log.

## Data protection

- GitHub App private keys, webhook secrets, and scheduler secrets stay in the runtime secret manager.
- Installation tokens are short-lived and created only on the server for a specific job.
- Every repository, schedule, and run query includes the authenticated immutable owner ID.
- Repository access is checked against the current installation before selection and execution.
- Webhooks use HMAC-SHA256 verification and unique delivery IDs.
- Automated changes are restricted to `.commitkeep/activity.md`, one file per run, with branch-head rechecks and daily idempotency.
- API responses are excluded from the service-worker cache. Routine logs exclude file content and personal identifiers.
- Account deletion will revoke application access and remove owned records under the documented retention policy before public release.

## Scaling path

Start with one regional D1 database and a scheduler that enqueues bounded jobs. As traffic grows, add Queues for buffering, Workflows for multi-step retries, per-installation concurrency limits, GitHub rate-limit awareness, and dead-letter handling. Partition execution by installation or repository when a single queue becomes a bottleneck. Keep dashboard reads paginated and indexed by owner and time; export older audit history to encrypted object storage under a retention policy.

Static PWA assets can use a CDN globally. Private API responses remain uncached. Vercel can host the UI at a temporary `*.vercel.app` address, but the present Workers deployment avoids splitting authentication and server routes. When a domain is purchased, point it to the selected frontend and keep API traffic on the same origin where possible.

## Capacity and reliability gates

Establish measured service objectives after staging load tests rather than promising an untested traffic number. Track successful scheduled runs, end-to-end queue delay, API latency, GitHub failure rate, duplicate suppression, and webhook processing time. Raise capacity only after testing the expected peak plus headroom with realistic repository and history sizes.

Public release requires the live GitHub test matrix, cross-account authorization tests, restore exercise, accessibility review, abuse-rate limits, privacy and deletion flows, monitoring dashboards, alerts, and an incident owner. These are operational gates because they require deployed infrastructure, credentials, devices, and real accounts.
