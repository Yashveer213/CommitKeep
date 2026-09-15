# CommitKeep

CommitKeep is an installable web app that connects to selected GitHub repositories, performs useful scheduled content updates, saves pending work, and keeps an account-owned record of every run and commit.

Stages 1–3 are implemented. The staging system includes GitHub OAuth, repository-scoped GitHub App installation, account-owned history, daily schedules, bounded repository writes, saved-work commits, a Cloudflare scheduler, and PWA support. A live scheduled commit was verified on September 15, 2026.

## Project status

| Stage | Purpose | Status |
| --- | --- | --- |
| [Stage 1](docs/stages/STAGE_1_UI_UX.md) | Product design and interactive interface | Complete |
| [Stage 2](docs/stages/STAGE_2_APPLICATION.md) | Accounts, GitHub integration, automation, and history | Implementation complete; live validation pending |
| [Stage 3](docs/stages/STAGE_3_PWA_RELEASE.md) | PWA, reliability, security validation, and release | Complete in staging; public launch gates remain |

## Run locally

Requirements and installation notes are in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server. GitHub connection stays disabled until a GitHub App and D1 database are configured.

## Useful commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Product rules

- Only repositories explicitly selected by the user are accessible.
- No file change means no commit.
- Every run is recorded as successful, failed, or skipped.
- Automatic updates and saved work are identified separately.
- Repository writes are previewable and use least-privilege GitHub App permissions.
- Local uncommitted files require a desktop companion; a PWA cannot read arbitrary folders silently.

## Planning documents

- [Dependencies and setup](docs/DEPENDENCIES.md)
- [Domain plan](docs/DOMAIN.md)
- [Security, architecture, and scaling plan](docs/SECURITY_SCALING_PLAN.md)
- [Architecture decisions](docs/DECISIONS.md)
- [GitHub App setup](docs/GITHUB_APP_SETUP.md)
- [Construction plan](docs/CONSTRUCTION_PLAN.md)
- [Release runbook](docs/RELEASE_RUNBOOK.md)
- [Deployment record](docs/DEPLOYMENTS.md)

## Current deployment

The Stage 1 preview is private and hosted at `commitkeep.syashveer981.chatgpt.site`. A branded custom domain is planned before release.
