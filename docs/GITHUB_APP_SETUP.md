# GitHub App setup

CommitKeep uses a GitHub App so each user can select the repositories it may access. The app stores the installation ID and creates a short-lived installation token only when repository work is required.

## Create the app

Create a GitHub App under the GitHub account or organization that will own CommitKeep. Use these values:

- **GitHub App name:** a unique CommitKeep name
- **Homepage URL:** the current deployed application URL
- **Callback URL:** `https://YOUR-APP-URL/api/auth/github/callback`
- **Setup URL:** `https://YOUR-APP-URL/api/github/setup`
- **Redirect on update:** enabled
- **Webhook:** active once the Stage 2 webhook endpoint is added
- **Webhook secret:** a new random secret stored only in the hosting secret manager

Request only the repository permissions needed by the first automation rule:

- **Contents:** read and write
- **Metadata:** read-only, granted automatically

Do not request organization-wide administration, workflow, secrets, or user-data permissions.

## Configure the server

Add the variables listed in `config/env.example` through the deployment provider's secret manager. Never place the private key or webhook secret in Git, browser code, build-time public variables, or screenshots.

Generate one GitHub App client secret. The sign-in flow also requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. It exchanges the temporary OAuth code on the server, stores only a hashed CommitKeep session token, and does not persist GitHub's user access token.

The repository connection flow is enabled only when `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and `GITHUB_APP_PRIVATE_KEY` are available. It verifies GitHub's installation response from the server before binding that installation to the signed-in CommitKeep account.

## Database

Apply the SQL migration in `drizzle/0000_rapid_fantastic_four.sql` to the D1 database before enabling the connection flow. Use a separate database for local development and production.

## Hosting and domains

The web interface can later be adapted for Vercel and receive a free `*.vercel.app` address. The current server and durable automation plan use Cloudflare Workers, D1, Queues, and Workflows. Keeping that backend avoids rebuilding the job system when the product begins to scale. A purchased domain can point to the chosen frontend or Worker deployment at release time.
