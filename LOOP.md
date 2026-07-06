# ShipShape Loop

ShipShape is built around the TestSprite launch loop: run, inspect failures, fix, rerun, and publish a clear ship/no-ship report.

## Loop 1: Replace Guesswork With A Launch Gate

Initial risk:
- Launch teams often have passing CI but no product-level answer to "can we ship this?"
- Test results are useful, but they do not automatically become a decision, a fix plan, or a rerun story.

ShipShape response:
- Generate launch-critical checks from app type and user flows.
- Run real TestSprite verification from the backend.
- Map TestSprite output into checks, issues, and a release verdict.

Evidence in product:
- `Checks` shows each launch check, severity, status, and action.
- Failed TestSprite results create open issues.
- Passing reruns verify checks and close related issues.

## Loop 2: Make Failures Actionable

Initial risk:
- A failed run can leave founders or builders with a vague "something failed" state.

ShipShape response:
- Store failed checks as first-class issues.
- Show cause, fix summary, and rerun instruction beside the failing check.
- Preserve the loop trail through verification and failure entries.

Evidence in product:
- Failed checks open a right-side failure panel.
- `Create Fix Plan` turns each failed check into a concise repair path.
- The report explains whether launch is blocked, in progress, or ready.

## Loop 3: Real TestSprite Integration

Initial risk:
- Simulated test data would make the product feel like a dashboard mockup instead of a launch tool.

ShipShape response:
- Removed simulated TestSprite runs.
- Added backend endpoint `POST /api/projects/:projectId/testsprite/run`.
- Added project-scoped TestSprite setup, project id storage, and CLI-backed project creation.
- Added deployment config so TestSprite can reach the public app.

Evidence in code:
- `backend/src/services/testspriteCli.ts`
- `backend/src/services/testspriteMapper.ts`
- `frontend/src/pages/ChecksIssues.tsx`
- `render.yaml`
- `frontend/vercel.json`

## Loop 4: Make The Checker Auditable

Initial risk:
- A green dashboard can still be untrustworthy if it hides whether checks came from real TestSprite result rows or from a suite-level pass.
- API credit and external dashboards can be hard to inspect during judging, so the app needs to explain the evidence it received.

ShipShape response:
- Added TestSprite evidence metadata to every TestSprite verification run.
- Track CLI exit code, result item count, matched checks, inferred checks, unmatched results, mapping mode, payload status, and report URL when available.
- Surface the evidence on Checks and Report so judges can see when a pass is directly matched versus inferred.
- Added `.github/workflows/testsprite.yml` to run the TestSprite gate in CI/CD.

Follow-up fix:
- A suite-level `rerun --all` on a fresh frontend project returned an overall pass with zero per-test result rows.
- ShipShape now creates fresh frontend TestSprite plan specs from the audit checks, batch-creates those tests, and runs each created test against the public URL before marking checks.
- This moves the demo path from `Inferred Overall Pass` toward direct result evidence.

Evidence in code:
- `backend/src/services/testspriteMapper.ts`
- `backend/src/types/domain.ts`
- `frontend/src/pages/ChecksIssues.tsx`
- `frontend/src/pages/ReportLoop.tsx`
- `.github/workflows/testsprite.yml`

## Final Demo Flow

1. Open ShipShape.
2. Start a new audit with the deployed public app URL.
3. Review generated launch checks.
4. Connect or create the TestSprite project from the Checks screen.
5. Run TestSprite.
6. Inspect failed checks and the fix plan.
7. Rerun TestSprite after fixes.
8. Open Report for the final ship/no-ship decision.

## Current Verdict

ShipShape is ready for final proof runs. The product has a real TestSprite-backed loop, deploy configs, persistence for audit state, evidence quality metadata, a CI/CD gate, and a concise launch report surface.
