# Dependencies and local setup

## Required software

- **Node.js 22.13 or newer**. Node.js 24 LTS is a good default.
- **npm**, included with Node.js.
- **Git** for version control and publishing.
- A current Chromium, Firefox, or Safari browser.

No global JavaScript packages are required.

## Install and run

From `C:\projects\CommitKeep`:

```bash
npm ci
npm run dev
```

Build the production bundle with:

```bash
npm run build
```

Run the full local release verification with:

```bash
npm run verify
```

Preview that bundle locally with:

```bash
npm run start
```

## Main runtime packages

- React and React DOM
- Next.js APIs through Vinext
- Vite
- Tailwind CSS
- Radix UI and the included interface components
- Lucide React icons
- Drizzle ORM for the Stage 2 database layer
- Cloudflare Workers tooling

The exact versions are locked in `package-lock.json`; use `npm ci` so every machine installs the same dependency graph.

## Stage 2 external requirements

These are services and credentials, not npm packages:

- A GitHub App with repository Contents permission and the narrowest additional permissions required by the final flows.
- Separate development, staging, and production GitHub App registrations.
- Cloudflare D1 for structured user-owned records.
- A Cloudflare Cron Trigger for the included scheduler Worker. Add Queues or Workflows as job volume grows.
- Encrypted runtime secrets for GitHub App credentials and token-wrapping keys.

Never commit `.env` files, private keys, GitHub tokens, database exports, or production logs.

## Windows troubleshooting

If a fresh Windows install reports a missing native Rolldown binding, first remove only the incomplete `node_modules` directory and run `npm ci` again with a supported Node.js version. Do not delete `package-lock.json` as a routine fix.
