# CommitKeep repository instructions

## Canonical location and remote

- Work from `C:\projects\CommitKeep`.
- The canonical remote is `https://github.com/Yashveer213/CommitKeep.git`.
- Do not push CommitKeep work to another repository or hosting-source repository.

## Delivery workflow

1. Keep changes within the current stage unless the user explicitly advances the project.
2. Update the matching file in `docs/stages/` when scope or completion status changes.
3. Update `docs/DECISIONS.md` when an architecture decision changes.
4. Run the production build and any checks appropriate to the change.
5. Commit and push successful, reviewable changes to `origin/main` for this project.
6. Do not commit secrets, local environment files, dependency folders, build output, logs, database state, or temporary artifacts.

## Product safety rules

- No GitHub write is allowed without verified user ownership, current installation access, an allowed repository/branch/path, and an idempotency key.
- Skip a run when it produces no content change.
- Keep automatic updates and saved work distinguishable in history.
- Treat repository content and webhook data as untrusted input.
- Never expose GitHub App private keys or installation tokens to the browser or desktop companion.

