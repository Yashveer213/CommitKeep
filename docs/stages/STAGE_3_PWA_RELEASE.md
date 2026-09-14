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
- Release, rollback, incident, migration, and backup procedures documented.
- Hosting kept portable at the UI layer while durable automation remains on Cloudflare.

Before public release, the manual device, accessibility, load, recovery, and live GitHub test matrix in the release runbook must pass.

## Reliability and release scope

- Development, staging, and production isolation.
- Automated migrations, rollback plan, structured logs, traces, dashboards, and alerts.
- Queue retry policy and dead-letter handling.
- Backup and restoration exercises.
- Accessibility, browser, load, abuse, authorization, webhook, conflict, and recovery testing.
- Incident response runbooks and dependency/security update policy.

## Exit criteria

- Install and upgrade work on supported desktop and mobile browsers.
- Offline behavior is explicit and does not expose private cached data.
- Automations run independently of browser/PWA state.
- Load targets and service-level objectives in the construction plan are met.
- Security and recovery release gates are signed off.
