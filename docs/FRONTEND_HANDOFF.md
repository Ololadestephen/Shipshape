# ShipShape Frontend Handoff

Use this when wiring Stitch to the backend.

## Local API

```txt
http://localhost:6333/api
```

Run:

```bash
npm run dev
```

## First Screen Data

Fetch the project list:

```txt
GET /api/projects
```

If the list is empty, show the create-audit flow. Each project includes:

- `readiness.score`
- `readiness.status`
- `readiness.blockers`
- `readiness.warnings`
- `readiness.verifiedChecks`
- `readiness.totalChecks`

Then fetch the selected project detail:

```txt
GET /api/projects/:projectId
```

This returns everything needed for the main dashboard:

- `project`
- `flows`
- `checks`
- `issues`
- `runs`
- `latestReport`
- `loop`
- `readiness`

## Create Audit Flow

```txt
POST /api/projects
```

```json
{
  "name": "ShipShape",
  "url": "https://shipshape.app",
  "appType": "saas",
  "flows": ["signup", "login", "dashboard"]
}
```

The backend creates the project, adds the flows, generates the launch checklist, and returns full project detail.

## Verification Run Flow

When TestSprite or a manual check completes:

```txt
POST /api/projects/:projectId/runs
```

```json
{
  "source": "testsprite",
  "status": "failed",
  "summary": "Mobile nav and contact form failed.",
  "results": [
    {
      "checkId": "chk_123",
      "status": "failed",
      "message": "Mobile menu overlapped the primary CTA."
    }
  ]
}
```

The backend will:

- Update the check status.
- Create or reopen an issue for failed checks.
- Close the issue when the check later passes.
- Add loop entries for the verification timeline.
- Recalculate project readiness.

## Main UI Mapping

- Dashboard metrics: `detail.readiness`
- Checks table: `detail.checks`
- Run form: `POST /api/projects/:projectId/runs`
- Launch report: `GET /api/projects/:projectId/report`

## Status Colors

- `blocked`, failed blocker: red
- `ready_with_warnings`, warning: amber
- `ready`, verified: green
- `testing`, `untested`: neutral
