# Stage 2 — Application and automation

## Goal

Turn the approved prototype into a secure, multi-user application that performs real repository work.

## Workstreams

1. **Identity and ownership**
   - Sign-in, sessions, server-side authorization, account settings, and deletion.
   - Every repository, schedule, draft, run, and audit record carries an immutable owner ID.

2. **GitHub App integration**
   - Install the app only on repositories selected by the user.
   - Store installation IDs, not long-lived installation tokens.
   - Mint short-lived tokens for each job and verify current repository access before use.
   - Process signed webhooks with replay protection and delivery deduplication.

3. **Automation engine**
   - Store schedules in UTC with the user's IANA timezone and local-time intent.
   - A lightweight scheduler enqueues due jobs; queue consumers or workflows execute them.
   - Use one idempotency key per repository, schedule, and intended run time.
   - Fetch the expected branch head, generate a patch, re-check the head, and stop on conflicts.
   - Skip when the generated tree matches the current tree.

4. **Content update rules**
   - Initial rule: refresh a bounded repository activity report.
   - Later rules must define allowed paths, deterministic inputs, maximum changed files, and maximum patch size.
   - Never modify workflow files, secrets, dependency locks, or protected paths unless the user explicitly enables that rule.

5. **Saved work**
   - Web drafts can be committed after preview.
   - Local work uses a companion process with explicit folder selection, ignore rules, and a visible pending-change review.
   - The companion receives short-lived, device-bound credentials and never exposes arbitrary filesystem access to the web app.

6. **History**
   - Persist source, requested action, changed paths, summary, branch, base and result SHA, GitHub link, timestamps, actor, outcome, and sanitized error code.
   - Keep raw file contents out of routine logs and analytics.

## Exit criteria

- A scheduled update and a saved-work commit succeed in a dedicated test repository.
- Unchanged content creates a skipped run and no commit.
- Concurrent and repeated deliveries create at most one commit.
- A branch-head conflict stops safely and is visible in history.
- Two test users cannot read or mutate each other's records.
- GitHub access revocation takes effect without manual cleanup.

