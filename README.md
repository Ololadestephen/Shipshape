# ShipShape

ShipShape turns real TestSprite runs into a launch decision. It tracks projects, critical flows, launch checks, issues, verification runs, evidence quality, reports, and loop entries.

## Run Locally

```bash
npm install
npm run dev
```

The API starts on `http://localhost:6333` by default.

Backend state is persisted to `.shipshape/shipshape-state.json` by default. Override it with `SHIPSHAPE_DATA_FILE`.

## TestSprite Integration

ShipShape runs the real TestSprite CLI from the backend. The CLI is included as a production dependency for deployment. For local CLI use, run:

```bash
npm install -g @testsprite/testsprite-cli
testsprite setup
```

Then add these environment variables:

```bash
TESTSPRITE_API_KEY=sk_...
TESTSPRITE_CLI_BIN=testsprite
TESTSPRITE_TIMEOUT_SECONDS=900
TESTSPRITE_MAX_PLANS=3
```

ShipShape creates and stores a TestSprite project id per audit automatically when the audit is created. You can still edit the id from the Checks screen. Optional fallback env vars:

```bash
TESTSPRITE_PROJECT_ID=your_project_id
TESTSPRITE_TEST_ID=test_...
```

After deployment, click `Create Project` in ShipShape or run:

```bash
testsprite --output json project create --type frontend --name ShipShape --url https://your-public-url.example
```

When you click `Run TestSprite`, ShipShape generates fresh frontend TestSprite plan specs from the highest-risk audit checks, creates the tests, runs them against the public target URL, then maps the returned results into the launch gate. `TESTSPRITE_MAX_PLANS` controls how many fresh frontend plans are created per run. Checks and Report show the evidence shape for each run: CLI exit code, result item count, matched checks, inferred checks, and any report URL returned by TestSprite.

## CI/CD Gate

The repo includes `.github/workflows/testsprite.yml` for the hackathon CI/CD bonus. Add these in GitHub:

- Repository secret: `TESTSPRITE_API_KEY`
- Repository variable: `TESTSPRITE_PROJECT_ID`

The workflow runs TestSprite on pushes to `main`, pull requests, and manual dispatch.

## Useful Endpoints

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/generate-checklist`
- `POST /api/projects/:projectId/runs`
- `GET /api/projects/:projectId/testsprite/setup`
- `POST /api/projects/:projectId/testsprite/project`
- `POST /api/projects/:projectId/testsprite/run`
- `GET /api/projects/:projectId/report`
- `GET /api/projects/:projectId/loop`

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for the full frontend contract.
See [docs/FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md) for the Stitch integration map.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render and Vercel setup.
See [LOOP.md](LOOP.md) for the hackathon loop narrative.

## Frontend Routes

Run the React frontend with:

```bash
npm run dev:frontend
```

Routes:

- `/` - landing page
- `/audits/new` - new audit generator
- `/checks` - checks and issues
- `/report` - launch report and verification loop
- `/share/:projectId` - public shareable launch report

The frontend is wired to the backend for project data, checklist updates, issue status changes, verification runs, and report regeneration.

## Backend Plan

See [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md).

## Deploy

Recommended setup:

- Backend on Render from the repository root.
- Frontend on Vercel from `frontend`.
- Set `VITE_API_BASE_URL` on Vercel to the Render backend URL.

The repo includes `render.yaml` and `frontend/vercel.json`.
