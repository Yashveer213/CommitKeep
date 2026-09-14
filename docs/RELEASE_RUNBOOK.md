# Release runbook

## Environments

Use separate Cloudflare accounts or isolated resources for development, staging, and production. Each environment needs its own D1 database, GitHub App or test installation, secrets, and scheduler. Never copy production private keys or repository data into development.

## Deployment order

1. Back up the production D1 database and record the current application revision.
2. Apply pending migrations to staging and run the authorization, webhook, dry-run, unchanged-content, conflict, and duplicate-delivery tests.
3. Deploy the application code to staging and complete desktop and mobile PWA install/upgrade checks.
4. Apply forward-compatible migrations to production.
5. Deploy the tested revision and perform a dry run against the dedicated test repository.
6. Verify `API_BASE_URL` in `wrangler.scheduler.jsonc`, add `SCHEDULER_SECRET` to both Workers through their secret managers, and deploy with `npm run scheduler:deploy`.
7. Enable the scheduler, observe one successful window, and then announce the release.

## Rollback

Disable the scheduler first. Roll application code back to the recorded revision. Prefer forward database fixes; restore D1 only when data corruption is confirmed and after preserving the affected database for analysis. Revoke or rotate GitHub and scheduler secrets if credential exposure is suspected.

## Required release tests

- A scheduled report commits once in the test repository.
- The same intended run time cannot produce a second commit.
- An identical report is recorded as skipped.
- A changed branch head stops with a visible conflict outcome.
- Removing a GitHub installation prevents later access.
- Two test accounts cannot read, select, schedule, or run each other's repositories.
- Invalid signatures and repeated webhook delivery IDs are rejected or deduplicated.
- Offline navigation shows the cached shell; authenticated API data and GitHub responses do not appear in Cache Storage.
- Keyboard navigation, focus visibility, screen-reader labels, contrast, reduced motion, and 200% zoom pass.
- Current Chrome, Edge, Safari, Firefox, Android, and iOS smoke tests pass where PWA support is available.

## Operations

Alert on repeated job failures, queue depth, webhook signature failures, authentication failures, elevated GitHub rate-limit responses, and scheduler silence. Logs contain record IDs, outcomes, durations, and sanitized error codes; they exclude repository file content, tokens, private keys, webhook bodies, and email addresses.

Back up D1 daily with a documented retention period. Exercise restoration quarterly in staging. Review dependencies monthly and urgent security advisories immediately. Record incidents with timeline, affected accounts and repositories, revoked credentials, recovery steps, and prevention work.
