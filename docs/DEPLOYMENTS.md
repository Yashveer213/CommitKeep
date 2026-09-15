# Deployments

## Staging

- Application: `https://commitkeep-staging.mkyash40.workers.dev`
- Scheduler: `commitkeep-scheduler`, every five minutes
- Queue: `commitkeep-staging-jobs`
- Dead-letter queue: `commitkeep-staging-jobs-dlq`
- Queue consumer: `commitkeep-jobs`
- Database: `commitkeep-staging`, Cloudflare D1, APAC
- Application revision at first deployment: `5db6205`
- Three-phase upgrade application version: `c672babd-7fe4-4ce6-95a4-3906fe3b0f2c`
- Queue consumer version: `0204b5af-c096-4224-a2f6-356f0a23b4f3`
- Scheduler version: `2488762d-4b7e-418a-9d9c-4031544da179`
- Release application version: `a9bb197b-8fe9-4418-857c-225f748dd8b7`
- Release queue consumer version: `af166796-649b-4826-801a-8d1a13cc73a7`
- Release scheduler version: `bb1b5656-9bbb-4a1e-9985-55b5b2a27fdd`

The scheduler now invokes the application through a private Cloudflare service binding. The previous public `workers.dev` hop returned 404 from Worker-to-Worker cron execution even though direct browser requests reached the route.
The first observed service-bound cron completed successfully and the application recorded an HTTP-successful internal tick. Existing overdue times were moved to their next calendar occurrence before enabling this validation, so no user repository write was triggered.

The application and scheduler share a randomly generated `SCHEDULER_SECRET` stored through Cloudflare Workers secrets. The value is not stored in the repository or local environment files.

Verified after deployment:

- Root application returns HTTP 200 with the runtime content-security policy.
- Manifest returns HTTP 200 with `application/manifest+json`.
- Offline document returns HTTP 200.
- Unauthenticated workspace requests return HTTP 401 and `Cache-Control: no-store, private`.
- Unauthenticated scheduler requests return HTTP 401.
- Migrations `0006_omniscient_jocasta.sql` and `0007_nervous_boom_boom.sql` were applied after exporting the staging database.
- The migrated database contains one schedule, one child schedule-time row, and one repository automation-control row, with no ownership mismatch or active row missing `next_run_at`.
- The migrated schedule was reconciled to its next future occurrence; passed times were not backfilled.
- A remote D1 export was restored into a separate APAC recovery database; all application tables and four migration records were verified before the temporary recovery database was deleted.

The GitHub App is registered as `commitkeep-by-yashveer`, installed with selected-repository access, and connected to staging. On September 15, 2026, an authenticated scheduler tick committed `.commitkeep/activity.md` to `Yashveer213/ENGINEERING_BIBLE`. The corresponding run is stored in the account-owned history. The upgraded dispatcher was not forced to write to that repository during rollout. New scheduled work is claimed in D1, sent through the queue as identifiers, and revalidated by the consumer before a bounded write.
