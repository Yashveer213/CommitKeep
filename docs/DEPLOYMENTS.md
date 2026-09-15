# Deployments

## Staging

- Application: `https://commitkeep-staging.mkyash40.workers.dev`
- Scheduler: `commitkeep-scheduler`, every five minutes
- Database: `commitkeep-staging`, Cloudflare D1, APAC
- Application revision at first deployment: `5db6205`

The application and scheduler share a randomly generated `SCHEDULER_SECRET` stored through Cloudflare Workers secrets. The value is not stored in the repository or local environment files.

Verified after deployment:

- Root application returns HTTP 200 with the runtime content-security policy.
- Manifest returns HTTP 200 with `application/manifest+json`.
- Offline document returns HTTP 200.
- Unauthenticated workspace requests return HTTP 401 and `Cache-Control: no-store, private`.
- Unauthenticated scheduler requests return HTTP 401.
- A remote D1 export was restored into a separate APAC recovery database; all application tables and four migration records were verified before the temporary recovery database was deleted.

The GitHub App is registered as `commitkeep-by-yashveer`, installed with selected-repository access, and connected to staging. On September 15, 2026, an authenticated scheduler tick committed `.commitkeep/activity.md` to `Yashveer213/ENGINEERING_BIBLE`. The corresponding run is stored in the account-owned history. Schedule creation is idempotent per owner, repository, and rule, and the database rejects duplicate schedules.
