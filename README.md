# ShipBot

**Turn TestSprite evidence into a confident ship/no-ship decision, backed by an immutable BOT Chain registry.**

[Live demo](https://shipshape-pi.vercel.app/) · [BOT Chain Explorer](https://scan.botchain.ai/) · [TestSprite CI gate](https://github.com/Ololadestephen/Shipshape/actions/workflows/testsprite.yml) · [The loop](LOOP.md)

Most teams can tell you that their CI is green. Far fewer can answer the launch question: **what did we verify, what broke, what changed, and are we actually ready to ship?**

ShipBot (originally ShipShape) is a launch-readiness workspace built around a real TestSprite verification loop and BOT Chain report publication. It turns a deployed URL into launch-critical checks, executes TestSprite against that live target, turns evidence into failures and practical remediation, then publishes a cryptographically hashed, immutable release report to BOT Chain that anyone can inspect and independently verify.

## The Loop

```text
Create audit -> TestSprite verifies live app -> ShipBot explains impact
     ^                                                |
     |                                                v
Rerun after fix <- make the change <- fix plan + evidence
     |
     v
Publish deterministic snapshot to BOT Chain -> Share receipt & verify fingerprint
```

1. Add a deployed app and its critical flows.
2. ShipBot creates a project-specific TestSprite project and launch checklist.
3. Run a focused TestSprite verification against the public URL.
4. Review direct evidence, failed checks, and a concrete fix plan.
5. Rerun after the fix and generate a canonical release report snapshot.
6. Connect an EVM wallet, switch to BOT Chain (Chain ID `677`), and publish the report fingerprint.
7. Share the report link and verify report exports directly against on-chain receipts.

## Why It Is Different

| Instead of | ShipBot gives you |
| --- | --- |
| A generic green CI badge | A launch verdict with the evidence behind it |
| One reusable test project | A dedicated TestSprite project per audit |
| A vague test failure | A mapped check, issue, and practical next fix |
| A private dashboard | A public, shareable release report with on-chain fingerprint |
| Mutable reports that can be tampered with | Immutable receipts registered on BOT Chain |
| Disappearing demo state | Supabase/Postgres audit and verification history |

## Built for the TestSprite Season 3 Loop & BOT Chain

- Uses the real TestSprite CLI, never simulated results.
- Creates fresh frontend test plans from the highest-risk launch checks.
- Records mapping quality: direct results, matched checks, inferred checks, exit code, and evidence URLs.
- Generates canonical JSON snapshots stripped of internal secrets or private paths.
- Computes deterministic SHA-256 digests (`0x...`) that fit EVM `bytes32`.
- Enforces immutable versioning and publisher attribution via `ShipBotRegistry` on BOT Chain.
- Provides interactive public verification to detect any tampering in exported reports.
- Keeps an agent-written [LOOP.md](LOOP.md) of write -> verify -> fix -> verify iterations.
- Wires TestSprite into [GitHub Actions](.github/workflows/testsprite.yml) on pushes, pull requests, and manual runs.

## Product Surface

| Surface | What it does |
| --- | --- |
| Create audit | Captures a live URL, app type, and critical user flows. Bare domains are normalized to `https://`. |
| Checks | Shows launch checks, TestSprite connection state, evidence, failures, and editable check status. |
| Fix plan | Converts a failed check into concrete investigation, repair, and rerun steps. |
| Report | Produces a ship/no-ship verdict, evidence summary, markdown/JSON export, and copy. |
| BOT Chain Publish | Publishes deterministic report fingerprint and predecessor links to BOT Chain Mainnet. |
| Public Share & Verify | Inspects public receipts and allows instant drag-and-drop comparison to detect tampered exports. |
| CI gate | Reruns the dedicated ShipBot TestSprite test from GitHub Actions. |

## Stack

- Frontend: React, TypeScript, Vite, Viem
- Backend: Express, TypeScript, Zod
- Smart Contracts: Solidity 0.8.20, Foundry (`forge`)
- Blockchain: BOT Chain Mainnet (Chain ID `677`)
- Persistence: Supabase Postgres
- Verification: TestSprite CLI
- Deployment: Vercel frontend + Render backend
- Coding agent: OpenAI Codex / Antigravity

## Run Locally

```bash
npm install
npm run dev
```

The API starts on `http://localhost:6333`. Run the frontend separately with:

```bash
npm run dev:frontend
```

Run test suites:

```bash
npm test                # Backend & snapshot tests
npm run test:contracts  # Foundry smart contract tests
```

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql://...
TESTSPRITE_API_KEY=sk_...
TESTSPRITE_CLI_BIN=testsprite
TESTSPRITE_TIMEOUT_SECONDS=900
TESTSPRITE_MAX_PLANS=1

# BOT Chain & Registry
VITE_BOT_CHAIN_ID=677
VITE_REPORT_REGISTRY_ADDRESS=0x...
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
