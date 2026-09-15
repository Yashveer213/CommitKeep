# Stage 3 — PWA, reliability, and release

## Goal

Ship an installable, observable application whose server-side automations keep running when the browser is closed.

## PWA scope

- Web app manifest, icons, theme metadata, and standalone display.
- Versioned service worker with safe update activation.
- Offline shell for navigation and cached public assets.
- Clear offline states for private data; never claim a repository action ran while offline.
- No caching of access tokens, GitHub responses containing private code, or authenticated API responses by default.
- Optional push notifications for meaningful failures, required action, or completed commits.

## Current progress

- Installable manifest, standalone metadata, and production service-worker registration.
- Versioned shell cache that excludes every `/api/` response and uses network-first navigation.
- Security headers covering content types, referrers, browser permissions, framing, and content sources.
- Server-only scheduler endpoint protected by a dedicated secret.
- A separate Cron Trigger Worker that runs independently of the browser and PWA lifecycle.
- Release, rollback, incident, migration, and backup procedures documented.
- Hosting kept portable at the UI layer while durable automation remains on Cloudflare.
- Cross-site mutation rejection and a verified account-deletion path that revokes GitHub access before erasing owned data.
- Automated policy tests for timezone scheduling, deterministic report content, and cross-site request decisions.

Stage 3 implementation and staging validation are complete. Before public release, the remaining manual device, accessibility, load, recovery, and cross-account isolation checks in the release runbook must pass against deployed staging infrastructure.

The staging Worker, APAC D1 database, and five-minute scheduler are deployed. Runtime headers, private cache behavior, authentication rejection, manifest delivery, offline document delivery, GitHub sign-in, selected-repository installation, dry runs, duplicate schedule prevention, and a real scheduled commit have been verified. Cross-account isolation and the full device/load matrix remain public-launch gates.

## Reliability and release scope

- Development, staging, and production isolation.
- Automated migrations, rollback plan, structured logs, traces, dashboards, and alerts.
- Queue retry policy and dead-letter handling.
- Backup and restoration exercises.
- Accessibility, browser, load, abuse, authorization, webhook, conflict, and recovery testing.

## Commit-Keep upgrade phases

Phase 1 adds the production scheduling foundation: additive child schedule times, repository automation controls, immutable occurrences, fenced write leases, append-oriented audit events, indexed due dispatch, and Queue/DLQ worker configuration. Existing schedules are retained and receive one child time; a protected reconciliation route calculates their first future UTC occurrence after migration.

Phase 2 adds atomic multi-repository schedule creation with request idempotency, versioned schedule editing, repository-level pause and resume APIs, paginated run history, selectable IANA timezones, one to eight unique daily times, inclusive dates, schedule summaries, and reversible dashboard controls.
- Incident response runbooks and dependency/security update policy.

## Exit criteria

- Install and upgrade work on supported desktop and mobile browsers.
- Offline behavior is explicit and does not expose private cached data.
- Automations run independently of browser/PWA state.
- Load targets and service-level objectives in the construction plan are met.
- Security and recovery release gates are signed off.

## Activity journal release

The optional activity journal is distinct from the daily metadata report. It never creates empty commits or claims source-code work, and the product does not promise GitHub contribution credit. Existing PWA assets and privacy-aware service-worker behavior remain part of the release gate.
