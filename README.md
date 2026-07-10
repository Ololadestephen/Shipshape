# ShipShape

**Turn TestSprite evidence into a confident ship/no-ship decision.**

[Live demo](https://shipshape-pi.vercel.app/) · [TestSprite CI gate](https://github.com/Ololadestephen/Shipshape/actions/workflows/testsprite.yml) · [The loop](LOOP.md)

Most teams can tell you that their CI is green. Far fewer can answer the launch question: **what did we verify, what broke, what changed, and are we actually ready to ship?**

ShipShape is a launch-readiness workspace built around a real TestSprite loop. It turns a deployed URL into launch-critical checks, executes TestSprite against that live target, turns evidence into failures and practical remediation, then publishes a clear release report anyone can share.

## The Loop

```text
Create audit -> TestSprite verifies live app -> ShipShape explains impact
     ^                                                |
     |                                                v
Rerun after fix <- make the change <- fix plan + evidence
```

1. Add a deployed app and its critical flows.
2. ShipShape creates a project-specific TestSprite project and launch checklist.
3. Run a focused TestSprite verification against the public URL.
4. Review direct evidence, failed checks, and a concrete fix plan.
5. Rerun after the fix and share an evidence-backed launch report.

## Why It Is Different

| Instead of | ShipShape gives you |
| --- | --- |
| A generic green CI badge | A launch verdict with the evidence behind it |
| One reusable test project | A dedicated TestSprite project per audit |
| A vague test failure | A mapped check, issue, and practical next fix |
| A private dashboard | A public, shareable release report |
| Disappearing demo state | Supabase-backed audit and verification history |

## Built for the TestSprite Season 3 Loop

- Uses the real TestSprite CLI, never simulated results.
- Creates fresh frontend test plans from the highest-risk launch checks.
- Records mapping quality: direct results, matched checks, inferred checks, exit code, and evidence URLs.
- Keeps an agent-written [LOOP.md](LOOP.md) of write -> verify -> fix -> verify iterations.
- Wires TestSprite into [GitHub Actions](.github/workflows/testsprite.yml) on pushes, pull requests, and manual runs.

## Product Surface

| Surface | What it does |
| --- | --- |
| Create audit | Captures a live URL, app type, and critical user flows. Bare domains are normalized to `https://`. |
| Checks | Shows launch checks, TestSprite connection state, evidence, failures, and editable check status. |
| Fix plan | Converts a failed check into concrete investigation, repair, and rerun steps. |
| Report | Produces a ship/no-ship verdict, evidence summary, export, copy, and public share link. |
| CI gate | Reruns the dedicated ShipShape TestSprite test from GitHub Actions. |

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Express, TypeScript
- Persistence: Supabase Postgres
- Verification: TestSprite CLI
- Deployment: Vercel frontend + Render backend
- Coding agent: OpenAI Codex

## Run Locally

```bash
npm install
npm run dev
```

The API starts on `http://localhost:6333`. Run the frontend separately with:

```bash
npm run dev:frontend
```

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql://...
TESTSPRITE_API_KEY=sk_...
TESTSPRITE_CLI_BIN=testsprite
TESTSPRITE_TIMEOUT_SECONDS=900
TESTSPRITE_MAX_PLANS=1
```

`DATABASE_URL` uses Supabase's Session Pooler connection string in production. Without it, local development falls back to `.shipshape/shipshape-state.json`.

## TestSprite Setup

Install and onboard the CLI:

```bash
npm install -g @testsprite/testsprite-cli
testsprite setup
```

ShipShape automatically creates and saves a TestSprite project ID for every audit. Clicking **Run TestSprite** creates a fresh focused plan for the highest-risk check and runs it against the audit's public target. Set `TESTSPRITE_MAX_PLANS` higher when you want broader coverage.

For the CI gate, add these GitHub repository settings:

- Secret: `TESTSPRITE_API_KEY`
- Variable: `TESTSPRITE_PROJECT_ID`

The workflow is defined in [.github/workflows/testsprite.yml](.github/workflows/testsprite.yml).

## Deploy

- Vercel: deploy `frontend` and set `VITE_API_BASE_URL` to the Render backend URL.
- Render: deploy from the repository root and set `DATABASE_URL` plus `TESTSPRITE_API_KEY`.

Configuration files are included: [render.yaml](render.yaml) and [frontend/vercel.json](frontend/vercel.json).

## Routes and Docs

- `/` - landing page
- `/audits/new` - create an audit
- `/checks` - verification workspace
- `/report` - release report
- `/share/:projectId` - public report link

Read the supporting docs:

- [LOOP.md](LOOP.md) - the agent-written verification history
- [Deployment guide](docs/DEPLOYMENT.md)
- [API contract](docs/API_CONTRACT.md)
- [Backend plan](docs/BACKEND_PLAN.md)
