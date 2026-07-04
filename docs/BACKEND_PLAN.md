# ShipShape Backend Plan

ShipShape is an API-first launch readiness service. The backend answers one product question:

> Is this app ready to ship, what is blocking it, and what evidence proves that?

## Goals

- Provide a stable HTTP API for the Stitch frontend.
- Generate launch-readiness checklists from app type and critical user flows.
- Track checks, issues, verification runs, run results, launch reports, and loop entries.
- Make the TestSprite loop visible through run history, issue status, and `LOOP.md`-style entries.
- Keep the first version fast to deploy, with clear seams for Prisma/Postgres later.

## Stack

- Node.js
- Express
- TypeScript
- Zod for request validation
- JSON-backed local repository for MVP persistence
- Vitest for domain tests

## Domain Objects

- `Project`: app under launch audit.
- `Flow`: important user journey such as signup, checkout, contact, onboarding, or dashboard.
- `Check`: generated launch-readiness check.
- `Issue`: actionable blocker/warning/polish task, usually created from a failed check.
- `VerificationRun`: manual, TestSprite, or CI verification event.
- `RunResult`: per-check result for a verification run.
- `LaunchReport`: snapshot verdict and evidence summary.
- `LoopEntry`: failure/fix/verification history for the hackathon loop narrative.

## MVP API

- Projects: create, list, read, update, delete.
- Flows: create, list, update, delete.
- Checks: generate checklist, list checks, update check.
- Issues: list, create, update.
- Runs: create run, list runs, read run, add run result.
- Reports: generate/read launch report.
- Loop: list/add loop entries.
- Health: service status.

## Winning Features Backed By The API

1. Readiness state calculated from failed blockers, warnings, polish items, and verified checks.
2. Automatic issue creation when a verification run reports failed checks.
3. Deterministic checklist generation that feels AI-powered without depending on paid APIs.
4. Launch report verdicts: `ready`, `ready_with_warnings`, or `blocked`.
5. Empty initial state so every visible project is user-created.
6. Loop entries available through the API for final submission evidence.

## Later Upgrade Path

- Replace memory store with Prisma models.
- Add auth and per-user projects.
- Add TestSprite webhook ingestion.
- Store external evidence links, screenshots, and failure bundles.
- Add GitHub Actions status ingestion for the CI gate panel.
