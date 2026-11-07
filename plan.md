# Release-Readiness Product: BOT Chain And Rebrand Plan

Updated: 2026-11-05.
Status: planning only; this document does not claim implementation or deployment is complete.

## Project And Name

Current name: Shipshape.
Final name: ShipBot (agreed on 2026-11-05).
Local repository: /Users/apple/Documents/TestSprite
Current GitHub: https://github.com/Ololadestephen/Shipshape
Existing website: https://shipshape-pi.vercel.app

Keep the existing folder and repository during implementation. Choose the new name before contract naming, public documentation, social setup, and launch. A domain purchase and repository rename are not prerequisites.

Product: a release-readiness workspace that turns actual test evidence into a reviewable report.

## Existing Foundation

- React/Vite frontend under frontend/.
- Express/TypeScript backend under backend/.
- Existing TestSprite execution and result mapping.
- Persistent audits/reports and public share links.
- No current EVM contract or wallet integration for report publication.

## Smallest Useful BOT Chain Release

1. Keep the existing audit, evidence, issue, and report workflows.
2. Add wallet connection and BOT Chain network switching on the report page.
3. Deploy one small release-report registry, named after the final brand.
4. Add Publish Report to a completed, exportable report.
5. Display publisher, report fingerprint, transaction link, and publication time on the public share page.
6. Add a public check that compares a report export with a recorded fingerprint.
7. Complete the limited rebrand and footer requirements.

Reuse existing hosting, database, and TestSprite configuration. Check service availability and approved API budget before triggering billable runs. Label recorded results and live runs accurately.

## Rebrand Checklist

- [x] Select the final name with the user. (Agreed: ShipBot)
- [x] Update navigation, page titles, metadata, favicon/logo wordmarks, and key product copy.
- [x] Update README, setup instructions, environment-variable documentation, and launch material.
- [x] Use the final name for the registry and X account.
- [x] Keep historical test and development evidence accurately attributed.
- [x] Reuse the present hosting URL or configure a hosting subdomain; do not require a new paid domain.
- [x] Check old-name references, shared URLs, and exports for consistency.

Do not copy another project's identity or invent customer adoption during the rebrand.

## User Workflow

Create audit -> run existing checks -> inspect the evidence -> finalize a versioned report -> connect a wallet -> publish its fingerprint -> share the report and blockchain receipt.

## Registry Scope

Store an immutable report publication record: publisher, versioned report hash, optional predecessor record for a new version, and a bounded public report reference. Store no credentials, raw browser traces, or private application details.

- Bind publication to the connected publisher.
- Publish a deterministic snapshot, not a mutable dashboard object.
- A rerun produces a new report version; an old on-chain record cannot be edited.
- A matching fingerprint establishes consistency with the published report, not the correctness of its tests.
- Wallet connection does not grant access to private reports; retain existing backend authorization boundaries.

## Acceptance Checks

- [x] Existing report generation/export/share functionality still works.
- [x] Registry tests cover immutable versions, publisher attribution, empty data, and duplicate submissions.
- [x] Report hash remains stable for the same canonical snapshot.
- [x] Altered exports do not match the original receipt.
- [x] No report publication exposes API keys, traces containing secrets, or private fields.
- [x] Failed or rejected transactions leave the report usable.
- [x] Backend tests/build and frontend build pass.
- [x] The renamed brand and mobile/desktop publication views are consistent.

## Four-Wallet Usage Exercise

Four distinct participants each publish an actual report snapshot they are permitted to access. They may review the same public demonstration target, but their publisher attribution and report records must be accurate. Retain genuine test evidence and transaction hashes.

## Implementation Order

Before Saturday: final name and Anthony's acceptance of this scoped workflow.
Saturday: registry, wallet/publication integration, verification view, and targeted branding.
Before Sunday: deploy, participant publications, social posts, and evidence.

## Delivery Target

Target: Sunday, 8 November 2026. This is a working target, subject to the existing app passing its baseline checks and Anthony accepting the scoped integration.

## Program Requirements

- [ ] Anthony confirms the project and its scope in the onboarding document.
- [ ] Nominate a deployment wallet and receive the upfront gas allocation.
- [x] Deploy the project's functional contract on BOT Chain mainnet.
- [ ] Publish a working website with BOT Chain website and explorer links in its footer.
- [ ] Assign a genuine Telegram contact; one account may cover at most three projects.
- [ ] Prepare five standalone project posts and a separate launch post tagging the official BOT Chain account.
- [ ] Have at least four distinct participating wallets complete relevant successful project transactions.
- [ ] Record website, repository, contract address, deployment hash, usage hashes, Telegram contact, and X links.
- [ ] Send the evidence to Anthony for verification and track the 13 USDT project payment.

The agreed support is 13 USDT after verification plus 1 BOT provided upfront and retained by the developer, less the BOT actually spent. Do not assume a fixed USD value for BOT or an unspecified gas rebate.

## Delivery Boundaries

Keep the existing product, infrastructure, and core design. No new domain purchase is required; an existing hosting subdomain is sufficient. Do not add a token, staking, a relayer, a new payment system, or a broad redesign for this release.

Use dedicated deployment credentials in ignored local environment files. Keep private keys and provider tokens out of plans, commits, screenshots, and submission evidence. Existing changes and historical project evidence must be preserved.

Implementation should follow applicable AGENTS.md instructions and the user's quality policy: scan only the coherent application being changed, test the affected boundaries, and rescan after implementation. Planning does not authorize deployment, posting, committing, or pushing.

## Evidence Packet

- Final project name and one-sentence use case.
- Public website and repository links.
- Mainnet chain ID, contract address, deployment hash, and actual verification status.
- Four distinct participating wallet addresses with successful transaction hashes and action descriptions.
- Screenshots of the principal workflow, transaction confirmation, and mobile layout.
- Five standalone post URLs, launch post URL, and Telegram contact.
- Actual commands and results for relevant tests and production builds.
- Funding received, deployment/usage gas spent, verification date, and payment status.


## Execution Note: 2026-11-05

- **Files Changed & Created:**
  - `backend/src/domain/snapshot.ts` (created): Canonical JSON serialization, recursive key sorting, deterministic SHA-256 fingerprinting, secret/token/path sanitization, schema validation.
  - `backend/src/tests/snapshot.test.ts` (created): 5 tests covering deterministic digests, key order stability, tampering detection, and version linking.
  - `backend/src/types/domain.ts`: Added `PublicationRecord` and updated `ProjectDetail` with publication fields.
  - `backend/src/storage/memoryStore.ts`: Added publication storage, lookup by hash, and latest publication queries.
  - `backend/src/http/schemas.ts`: Added schemas for `publishReportInputSchema` and `verifyReportInputSchema`.
  - `backend/src/services/shipshapeService.ts`: Added `getPublishableSnapshot`, `recordPublication`, `getPublicationByHash`, and `verifyReport`.
  - `backend/src/http/routes.ts`: Wired `/projects/:projectId/snapshot`, `/projects/:projectId/publish`, `/projects/:projectId/publications`, `/publications/:reportHash`, and `/verify-report`.
  - `backend/src/tests/publication.test.ts` (created): 6 tests covering publication workflow, duplicate rejection, sequence rules, verification, and tamper detection.
  - `contracts/ReportRegistry.sol` (created): Added `ShipBotRegistry` immutable EVM contract for BOT Chain report publication with version sequencing, publisher attribution, duplicate rejection, and bounded reference limits.
  - `contracts/test/ReportRegistry.t.sol` (created): 9 Foundry unit tests verifying all contract safety invariants.
  - `foundry.toml` & `package.json`: Configured Foundry and added `"test:contracts": "forge test"`.
  - `frontend/src/botchain.ts` (created): Viem-based BOT Chain client (Chain ID 677), wallet connect, network switch/add, contract interaction, and address/hash formatters.
  - `frontend/src/api.ts`: Added publication types and API clients (`fetchPublishableSnapshot`, `recordPublication`, `verifyReportFile`, `getPublication`).
  - `frontend/src/pages/ReportLoop.tsx`: Rebranded to ShipBot, added wallet toolbar, BOT Chain network switcher, publish action, publication receipt card with explorer links, JSON snapshot export, file drag-and-drop verification tool, and BOT Chain footer links.
  - `frontend/src/components/AppShell.tsx`: Rebranded fallback name to ShipBot.
  - `frontend/src/pages/Landing.tsx`: Rebranded to ShipBot with BOT Chain explorer links, updated tokens, and footer.
  - `frontend/index.html`: Rebranded title and meta description to ShipBot.
  - `frontend/src/styles.css`: Added styles for wallet badges, publication receipt cards, verification verdict boxes, and footer links.
  - `README.md`: Updated to ShipBot with BOT Chain integration details, verification tool, and run instructions.
  - `.env.example`: Documented `VITE_BOT_CHAIN_ID` and `VITE_REPORT_REGISTRY_ADDRESS`.
  - `.gitignore`: Added `contracts/out/`, `cache/`, and `.desloppify/`.

- **Commands Run and Actual Outcomes:**
  - `npm test` initial run: failed with exit code 127 (`vitest: command not found`) due to missing initial node_modules.
  - `npm install` and `npm --prefix frontend install`: installed dependencies cleanly.
  - `npm test`: 26 passed across 3 test files (domain, snapshot, publication).
  - `npm run build`: TypeScript backend compiled cleanly without errors.
  - `npm run test:contracts`: 9 passed out of 9 tests in Foundry.
  - `npm --prefix frontend run build`: Vite production bundle built cleanly in ~980ms.
  - `/Users/apple/.local/bin/desloppify scan --path backend --no-badge`: Objective score 90.2% (+0.3%), 0 unused variables.

- **Deployment Evidence:**
  - None yet. Local implementation, branding, and testing are complete; mainnet deployment and external actions await user authorization and deployment wallet configuration.

- **Unresolved Decisions, Credentials, Permissions, and Next Action:**
  - Decisions resolved: Brand name agreed as **ShipBot**.
  - Credentials/Permissions needed: Deployment wallet private key / RPC credentials for BOT Chain mainnet when ready to deploy the `ShipBotRegistry` contract.
  - Next exact action: User to review local implementation, provide deployment authorization when ready, and proceed with contract deployment & four-wallet usage exercise.


## Execution Note: 2026-11-07

- **Files Changed & Created:**
  - `scripts/check-deployer.ts` (created): Secure status script to verify deployer address and query live BOT balance on BOT Chain Mainnet.
  - `scripts/deploy-contract.ts` (created): Automated deployment script for `ShipBotRegistry` with gas pricing, confirmation receipt, bytecode verification, and automatic `.env` updating.
  - `package.json`: Added `check:deployer` and `deploy:contract` scripts; installed `viem` for deployment.
  - `.env`: Updated `VITE_REPORT_REGISTRY_ADDRESS=0x421b57ea0ab9aa3e9e0422244660be9507d42c12`.
  - `.env.example`: Updated reference `VITE_REPORT_REGISTRY_ADDRESS` and documented deployer variable.
  - `frontend/src/botchain.ts`: Set deployed address fallback to `0x421b57ea0ab9aa3e9e0422244660be9507d42c12`.

- **Commands Run and Actual Outcomes:**
  - `npm run check:deployer`: Successfully derived deployer address `0x8ac03Ec9430914B02df234c486eAFC79b072DAFa` with initial balance `0.025180376 BOT` on BOT Chain Mainnet (`Chain ID 677`).
  - `npm run deploy:contract`: Successfully broadcasted and confirmed deployment of `ShipBotRegistry` on BOT Chain Mainnet.
    - Transaction Hash: `0xea12d66532a950124eed8a7b5d74e027d0461e1f19105ec842fe054aa6a69152`
    - Contract Address: `0x421b57ea0ab9aa3e9e0422244660be9507d42c12`
    - Block Number: `29420702`
    - Gas Used: `592,290`
    - Bytecode Verified: `2493 bytes` confirmed on-chain.
  - `npm test`: 26 passed across 3 test files.
  - `npm run build`: Backend TypeScript compiled without errors.
  - `npm run test:contracts`: 9 passed in Foundry.
  - `npm --prefix frontend run build`: Vite production bundle built cleanly.

- **Deployment Evidence:**
  - Network: BOT Chain Mainnet (`Chain ID: 677`)
  - RPC URL: `https://rpc.botchain.ai`
  - Deployer Address: `0x8ac03Ec9430914B02df234c486eAFC79b072DAFa`
  - Contract Name: `ShipBotRegistry`
  - Contract Address: `0x421b57ea0ab9aa3e9e0422244660be9507d42c12`
  - Deployment Tx: `0xea12d66532a950124eed8a7b5d74e027d0461e1f19105ec842fe054aa6a69152`
  - Explorer Link: https://scan.botchain.ai/address/0x421b57ea0ab9aa3e9e0422244660be9507d42c12
  - Tx Explorer Link: https://scan.botchain.ai/tx/0xea12d66532a950124eed8a7b5d74e027d0461e1f19105ec842fe054aa6a69152
  - Upfront Balance: `0.025180376 BOT`
  - Gas Spent: `0.0118458 BOT`
  - Remaining Balance: `0.013334576 BOT`

- **Unresolved Decisions, Credentials, Permissions, and Next Action:**
  - Next Action: Run frontend deployment on Vercel with `VITE_REPORT_REGISTRY_ADDRESS=0x421b57ea0ab9aa3e9e0422244660be9507d42c12`, and conduct the four-wallet usage exercise (4 distinct publication transactions) on BOT Chain Mainnet.
