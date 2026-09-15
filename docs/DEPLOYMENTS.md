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

GitHub App secrets and live repository tests remain pending until the GitHub App registration is complete.
