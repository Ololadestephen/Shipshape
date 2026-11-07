# Coding Agent Guide: Release-Readiness Product (Currently Shipshape)

Updated: 2026-11-05.
Repository: /Users/apple/Documents/TestSprite

This guide is for a coding agent working on the BOT Chain integration. The product scope and acceptance criteria are in plan.md. Reading these files alone does not authorize implementation or external publication; use the user's current task as the authorization.

## Read First

1. Read applicable parent and repository AGENTS.md instructions, including any nested instructions for files you touch.
2. Read plan.md. Its active BOT Chain section defines this release.
3. Read README.md and the package scripts before choosing commands or frameworks.
4. Inspect git status and the existing diff. Preserve all work you did not create.
5. Read the source paths listed below and trace the actual workflow before editing.

The user wants a small extension of an existing working product. Follow existing architecture and UI patterns. Avoid broad refactors, new platforms, new billing, speculative features, and duplicate apps.

## Mission And Naming

Extend the current release-readiness product with BOT Chain report publication. A new product name is required; the final name is TBD.

Ask for the name decision when it is needed. Baseline checks, snapshot design, tests, and network plumbing can proceed while the name is pending. Do not invent an approved brand or perform a repository/domain rename. Finalize public contract names, metadata, social drafts, and deployment only after the name is agreed.

## Start Here

- README.md and LOOP.md
- backend/src/types/domain.ts, especially LaunchReport
- backend/src/http/routes.ts
- backend/src/domain/readiness.ts
- backend/src/services/testspriteCli.ts and the existing report/storage services
- backend/src/tests/domain.test.ts
- frontend/src/pages/ReportLoop.tsx
- frontend/src/api.ts and frontend/src/components/AppShell.tsx

There is no existing blockchain report registry. This feature must be implemented and tested; do not describe it as already available.

## First Concrete Task

Trace report generation, export, persistence, and public sharing. Define the smallest immutable public report snapshot that can be hashed consistently without exposing secrets or private test evidence.

Keep mutable workspace state separate from the versioned snapshot to be published.

## Implementation Order

1. Run the backend tests/build and frontend build.
2. Define and test the report snapshot schema and deterministic digest.
3. Preserve report-access authorization while adding a publishable-snapshot path.
4. Implement a small immutable report registry and its tests.
5. Add wallet connection, BOT Chain switching, publication progress, and receipt links to the report page.
6. Display receipt details on the public share page and add exported-report comparison.
7. Apply the agreed new brand through the existing layout, metadata, documentation, exports, and assets.
8. Add footer links and deployment environment examples.
9. Finish focused browser checks and assemble the deployment/evidence packet.

Use current TestSprite execution and result mapping. Trigger billable tests only within the user's authorized budget. Reuse real existing reports for deterministic publication tests when appropriate; label recorded evidence accurately.

## Registry And Version Rules

- Record the publisher, versioned report hash, and bounded public reference.
- Retain the old immutable record when a rerun creates a newer report.
- If predecessor/version links are used, verify the intended publisher/version relationship.
- A report URL is a retrieval hint; validate the report fingerprint rather than trusting a mutable URL.
- Do not put API keys, private target details, sensitive traces, or authentication links on-chain.
- A matching fingerprint proves consistency with a publication, not that all testing was sufficient.

## Verification Commands

From the repository root:

```bash
npm test
npm run build
npm --prefix frontend run build
```

Test immutable versions, report edits, duplicate submissions, publisher attribution, denied access, wrong networks, wallet rejection, and failed/pending transactions. Keep report viewing/export usable when the wallet is disconnected.

## Rebrand Boundaries

Update current public product identity after name approval. Keep historical evidence and original sponsor attributions intact. No new paid domain, broad redesign, new billing, alternate testing provider, or replacement backend is required.

## Done Means

A completed report can be published from an authorized view, inspected on a public page, and checked against an export. The renamed brand is consistent, existing tests/builds pass, and deployment/onboarding evidence reflects actual completion.

## Quality And Working Method

- Start with baseline tests and builds for the affected application; record failures that existed before your edits.
- Apply the user's Desloppify policy before and after non-trivial code changes. Check installation and Git ignore rules first, then scan only the coherent application or contract boundary being changed. Review status and next after each scan.
- Exclude generated/dependency output according to the user's policy. Do not scan Documents, Desktop, or unrelated sibling projects.
- If a tool cannot run safely or is unavailable, report it and use the available checks; do not claim a scan or test passed.
- Add focused tests for the new behavior and its failure boundaries. Preserve existing coverage.
- Keep secrets in ignored local environment files; add only blank/example settings to committed templates.
- Verify current official BOT Chain network and deployment information before live use. Avoid copying stale addresses or assuming unrelated-chain infrastructure is deployed.
- Use existing chain and wallet libraries where available. New dependencies should serve an actual requirement and stay within the user's authorization.
- Show concise progress updates, explain intended edits, and carry authorized local work through testing.
- Work independently through reversible implementation tasks. Ask only for missing decisions or permissions that actually block the next action.
- If this guide is resumed later, compare the date with plan.md's target; do not claim an old delivery deadline is still in the future.

## External Actions And Handoff

Follow the user's actual authorization for deployment, paid services, posting, committing, pushing, and pull requests. Complete a reviewable local implementation before requesting an external action that still needs approval.

Do not spend the owner's grant wallet funds or consume unapproved model/TestSprite credits. Do not copy private keys between projects. Use configured deployment credentials without printing them.

When deployment is authorized: check chain ID and signer, estimate cost, run the deployment, confirm its receipt and bytecode, and save the real address/hash/block. Report source verification separately from deployment and from Anthony's project review. Update frontend/server configuration consistently.

Social deliverables can be drafted locally. Public posting and account actions require appropriate user authorization. Four-wallet evidence must identify actual successful transactions and participants without inventing customers, adoption, or account ownership.

At each handoff, append a dated execution note to plan.md covering:
- Files changed and completed acceptance items.
- Commands run and actual outcomes, including baseline failures.
- Deployment evidence, only if a deployment happened.
- Unresolved decisions, credentials, permissions, and next exact action.

Keep implementation-complete, deployed, onboarding-complete, and paid as separate states. Do not mark all program requirements done because a build passes.

## Suggested Starting Prompt

> Read applicable AGENTS.md instructions, plan.md, and AGENT_GUIDE.md. Implement the small BOT Chain report-publication extension and agreed rebrand. Start by tracing and testing report snapshots. Continue independent integration work while the final name is pending, preserve existing TestSprite behavior, and report remaining release actions accurately.
