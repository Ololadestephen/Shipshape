# ShipShape API Contract

Base URL: `/api`

All responses use JSON. Errors use:

```json
{
  "error": {
    "message": "Human-readable error",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

## Health

`GET /health`

Returns service status and version.

## Projects

`GET /projects`

Returns all projects with computed readiness summary.

`POST /projects`

```json
{
  "name": "ShipShape",
  "url": "https://shipshape.example.com",
  "appType": "saas",
  "flows": ["signup", "login", "dashboard"]
}
```

`GET /projects/:projectId`

Returns project, flows, checks, issues, runs, latest report, loop entries, and readiness summary.

`PATCH /projects/:projectId`

Updates `name`, `url`, `appType`, `status`, `testspriteProjectId`, or `testspriteProjectUrl`.

`DELETE /projects/:projectId`

Deletes the project and its child records.

## Flows

`GET /projects/:projectId/flows`

`POST /projects/:projectId/flows`

```json
{
  "name": "signup",
  "description": "New user creates an account and reaches onboarding",
  "priority": "critical"
}
```

`PATCH /flows/:flowId`

`DELETE /flows/:flowId`

## Checklist

`POST /projects/:projectId/generate-checklist`

Generates launch checks from the project's app type and flows. Existing checks are replaced by default.

```json
{
  "replaceExisting": true
}
```

`GET /projects/:projectId/checks`

`PATCH /checks/:checkId`

```json
{
  "status": "verified",
  "notes": "Passed in latest TestSprite run"
}
```

## Issues

`GET /projects/:projectId/issues`

`POST /projects/:projectId/issues`

```json
{
  "title": "Mobile nav overlaps page title",
  "severity": "blocker",
  "status": "open",
  "reproSteps": ["Open on 390px viewport", "Tap menu"],
  "expected": "Menu opens without covering title",
  "actual": "Menu overlays title and CTA",
  "suggestedFix": "Constrain nav panel height and add top padding"
}
```

`PATCH /issues/:issueId`

## Verification Runs

`GET /projects/:projectId/runs`

`POST /projects/:projectId/runs`

```json
{
  "source": "testsprite",
  "status": "failed",
  "summary": "Signup and mobile nav failed",
  "results": [
    {
      "checkId": "chk_123",
      "status": "failed",
      "message": "Email validation accepted invalid input",
      "evidenceUrl": "https://example.com/failure"
    }
  ]
}
```

Failed run results update the related check, create/update an issue, and append a loop entry.

`POST /projects/:projectId/testsprite/run`

Runs the real TestSprite CLI with `TESTSPRITE_API_KEY`, parses `--output json`, creates a TestSprite verification run, and applies results to checks/issues. ShipShape uses the project's saved `testspriteProjectId` first, then falls back to `TESTSPRITE_PROJECT_ID`.

```json
{
  "run": {
    "id": "run_123",
    "source": "testsprite",
    "status": "failed"
  },
  "results": []
}
```

`GET /projects/:projectId/testsprite/setup`

Returns non-secret TestSprite setup status:

```json
{
  "apiKeyConfigured": true,
  "projectId": "p_123",
  "projectIdSource": "project",
  "testIdConfigured": false,
  "readyToRun": true
}
```

`POST /projects/:projectId/testsprite/project`

Creates a frontend project through the TestSprite CLI and saves the returned project id on the ShipShape project.

```json
{
  "targetUrl": "https://shipshape.vercel.app"
}
```

If `TESTSPRITE_TEST_ID` is set, ShipShape can run that single test against the project's URL. Otherwise it reruns the configured TestSprite project suite.

`GET /runs/:runId`

`POST /runs/:runId/results`

Adds a single result to a run and applies the same check/issue/loop effects.

## Launch Report

`GET /projects/:projectId/report`

Returns the latest report, generating one if needed.

`POST /projects/:projectId/report/generate`

Creates a new report snapshot.

## Loop

`GET /projects/:projectId/loop`

`POST /projects/:projectId/loop`

```json
{
  "kind": "fix",
  "title": "Fixed email validation",
  "body": "Added strict email validation and inline error messaging.",
  "evidenceUrl": "https://github.com/example/shipshape/commit/abc123"
}
```
