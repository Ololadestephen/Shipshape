import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Check, Project, Severity } from "../types/domain.js";
import { parseTestSpritePayload, type TestSpriteCommandResult } from "./testspriteMapper.js";

export interface TestSpriteConfig {
  apiKey: string;
  projectId: string;
  testId?: string;
  cliBin: string;
  timeoutSeconds: number;
}

export function readTestSpriteConfig(env: NodeJS.ProcessEnv = process.env): TestSpriteConfig {
  return {
    apiKey: env.TESTSPRITE_API_KEY?.trim() ?? "",
    projectId: env.TESTSPRITE_PROJECT_ID?.trim() ?? "",
    testId: env.TESTSPRITE_TEST_ID?.trim() || undefined,
    cliBin: env.TESTSPRITE_CLI_BIN?.trim() || "testsprite",
    timeoutSeconds: Number(env.TESTSPRITE_TIMEOUT_SECONDS ?? 900)
  };
}

interface TestSpritePlanSpec {
  projectId: string;
  type: "frontend";
  name: string;
  description: string;
  priority: "p0" | "p1" | "p2";
  planSteps: Array<{
    type: "action" | "assertion";
    description: string;
  }>;
}

export async function runTestSpriteCli(project: Project, checks: Check[], config = readTestSpriteConfig()): Promise<TestSpriteCommandResult> {
  if (!config.testId && config.projectId && checks.length > 0) {
    return runFreshFrontendPlans(project, checks, config);
  }

  const args = buildTestSpriteArgs(project, config);
  const env = {
    ...process.env,
    TESTSPRITE_API_KEY: config.apiKey
  };

  return runCommand(config.cliBin, args, env);
}

export async function createTestSpriteProjectCli(
  project: Project,
  targetUrl: string,
  config = readTestSpriteConfig()
): Promise<{ id: string; targetUrl: string; raw: unknown }> {
  const args = buildCreateProjectArgs(project, targetUrl);
  const result = await runCommand(config.cliBin, args, {
    ...process.env,
    TESTSPRITE_API_KEY: config.apiKey
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `TestSprite exited with code ${result.exitCode}`);
  }

  const raw = parseTestSpritePayload(result.stdout);
  const id = readTestSpriteProjectId(raw);
  if (!id) {
    throw new Error(`TestSprite did not return a project id. Response keys: ${describeShape(raw)}`);
  }

  return {
    id,
    targetUrl: readTargetUrl(raw) ?? targetUrl,
    raw
  };
}

export function buildTestSpriteArgs(project: Project, config: TestSpriteConfig): string[] {
  const timeout = Number.isFinite(config.timeoutSeconds) && config.timeoutSeconds > 0 ? String(config.timeoutSeconds) : "900";
  const args = ["--output", "json", "test"];

  if (config.testId) {
    args.push("run", config.testId, "--wait", "--timeout", timeout, "--target-url", project.url);
    return args;
  }

  args.push("rerun", "--all", "--project", config.projectId, "--wait", "--timeout", timeout);
  return args;
}

export function buildCreateProjectArgs(project: Project, targetUrl: string): string[] {
  return [
    "--output",
    "json",
    "project",
    "create",
    "--type",
    "frontend",
    "--name",
    project.name,
    "--url",
    targetUrl,
    "--description",
    `ShipShape launch audit for ${project.url}`
  ];
}

export function buildTestSpritePlanSpecs(project: Project, checks: Check[], testspriteProjectId: string): TestSpritePlanSpec[] {
  return checks.map((check) => ({
    projectId: testspriteProjectId,
    type: "frontend",
    name: check.title,
    description: `${check.title}. ${check.description}`,
    priority: priorityFromSeverity(check.severity),
    planSteps: buildPlanSteps(project, check)
  }));
}

async function runFreshFrontendPlans(project: Project, checks: Check[], config: TestSpriteConfig): Promise<TestSpriteCommandResult> {
  const timeout = Number.isFinite(config.timeoutSeconds) && config.timeoutSeconds > 0 ? String(config.timeoutSeconds) : "900";
  const env = {
    ...process.env,
    TESTSPRITE_API_KEY: config.apiKey
  };
  const tempDir = await mkdtemp(join(tmpdir(), "shipshape-testsprite-"));
  const plansFile = join(tempDir, "plans.jsonl");

  try {
    const scopedChecks = selectChecksForTestSprite(checks);
    const specs = buildTestSpritePlanSpecs(project, scopedChecks, config.projectId);
    await writeFile(plansFile, specs.map((spec) => JSON.stringify(spec)).join("\n"), "utf8");

    const args = [
      "--output",
      "json",
      "test",
      "create-batch",
      "--plans",
      plansFile,
      "--run",
      "--wait",
      "--target-url",
      project.url,
      "--max-concurrency",
      String(Math.min(3, specs.length)),
      "--timeout",
      timeout
    ];
    const result = await runCommand(config.cliBin, args, env);
    const payload = parseMaybeJson(result.stdout);
    const batchResults = readBatchRunResults(payload);
    const runResults = batchResults.length > 0 ? batchResults.map((item, index) => resultFromBatchItem(item, scopedChecks[index])) : [];

    return {
      command: [config.cliBin, ...args],
      exitCode: result.exitCode,
      stdout: JSON.stringify({
        status: result.exitCode === 0 ? "passed" : result.exitCode === 7 ? "partial" : "failed",
        summary: `TestSprite fresh frontend plans: ${runResults.filter((result) => result.status === "passed").length} passed, ${
          runResults.filter((result) => result.status === "failed").length
        } failed, ${runResults.filter((result) => result.status === "skipped").length} unresolved.`,
        results: runResults,
        batch: payload
      }),
      stderr: result.stderr
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function selectChecksForTestSprite(checks: Check[]): Check[] {
  const maxPlans = readMaxPlans();
  return checks
    .slice()
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
    .slice(0, maxPlans);
}

function readMaxPlans() {
  const parsed = Number(process.env.TESTSPRITE_MAX_PLANS ?? 3);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 12) : 3;
}

function severityRank(severity: Severity) {
  if (severity === "blocker") {
    return 3;
  }

  if (severity === "warning") {
    return 2;
  }

  return 1;
}

function readBatchRunResults(payload: unknown): Array<Record<string, unknown>> {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return [];
  }

  return payload.results.filter(isRecord);
}

function resultFromBatchItem(item: Record<string, unknown>, check?: Check) {
  const rawStatus = typeof item.status === "string" ? item.status : "";
  const status = normalizeRunStatus(rawStatus);
  return {
    name: check?.title ?? readString(item, "testId") ?? "TestSprite frontend plan",
    status,
    message:
      status === "passed"
        ? `${check?.title ?? "TestSprite frontend plan"} passed in a fresh TestSprite run.`
        : status === "failed"
          ? readMessage(item) ?? `${check?.title ?? "TestSprite frontend plan"} failed in a fresh TestSprite run.`
          : `${check?.title ?? "TestSprite frontend plan"} did not finish before the TestSprite wait timeout.`,
    evidenceUrl: readTargetUrl(item),
    testId: readString(item, "testId"),
    runId: readString(item, "runId"),
    run: item
  };
}

function normalizeRunStatus(status: string) {
  const normalized = status.toLowerCase();
  if (["passed", "pass", "success", "succeeded", "ready", "ok"].includes(normalized)) {
    return "passed" as const;
  }

  if (["failed", "fail", "failure", "error", "blocked", "cancelled", "canceled"].includes(normalized)) {
    return "failed" as const;
  }

  return "skipped" as const;
}

function buildPlanSteps(project: Project, check: Check): TestSpritePlanSpec["planSteps"] {
  if (check.title.toLowerCase().includes("report export")) {
    return [
      { type: "action", description: `Navigate directly to ${project.url.replace(/\/$/, "")}/report.` },
      { type: "assertion", description: "Verify the Report page exposes a visible Export Report or Download report action." }
    ];
  }

  if (check.category === "forms") {
    return [
      { type: "action", description: `Navigate directly to ${project.url.replace(/\/$/, "")}/audits/new.` },
      { type: "action", description: "Enter a valid app name and a valid public URL in the Create audit form." },
      { type: "assertion", description: "Verify Generate is a clickable submit button and pressing Enter from the Live URL field can submit the form." }
    ];
  }

  const category = check.category.replace(/_/g, " ");
  return [
    { type: "action", description: `Navigate to ${project.url}.` },
    { type: "action", description: `Exercise the ${category} behavior related to: ${check.title}.` },
    { type: "assertion", description: concreteAssertion(check) }
  ];
}

function concreteAssertion(check: Check) {
  const assertions: Record<string, string> = {
    navigation: "Verify the primary navigation exposes working links to the main launch-critical pages without dead ends.",
    mobile: "Verify the page remains readable and the primary controls are tappable in a narrow mobile viewport.",
    forms: "Verify required form fields show clear validation feedback and a visible success or error state.",
    accessibility: "Verify interactive buttons, links, and form controls expose clear accessible names and visible focus states.",
    error_states: "Verify an empty or invalid state explains what happened and gives the user a next action.",
    ci_cd: "Verify the release or verification status is visible and not shown as a stale placeholder.",
    auth: "Verify the authentication or signup path reaches the expected next screen and handles failure visibly.",
    onboarding: "Verify the first-run onboarding path gives the user a clear first success moment.",
    security: "Verify sensitive routes or destructive actions are not accessible from an unauthenticated public visit.",
    performance: "Verify the main page reaches an interactive, usable state without obvious loading stalls.",
    seo: "Verify the public page exposes a clear title, main heading, and product purpose.",
    content: "Verify the page copy clearly explains the product purpose and primary action."
  };

  return assertions[check.category] ?? `Verify this observable outcome: ${check.title}.`;
}

function priorityFromSeverity(severity: Severity): TestSpritePlanSpec["priority"] {
  if (severity === "blocker") {
    return "p0";
  }

  if (severity === "warning") {
    return "p1";
  }

  return "p2";
}

function parseMaybeJson(stdout: string): unknown {
  try {
    return parseTestSpritePayload(stdout);
  } catch {
    return undefined;
  }
}

function readMessage(value: unknown): string | undefined {
  return findStringByKeys(value, ["message", "summary", "error", "failure", "reason", "actual"]);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<TestSpriteCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (exitCode) => {
      resolve({
        command: [command, ...args],
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

export function readTestSpriteProjectId(raw: unknown): string | undefined {
  const candidate = findStringByKeys(raw, ["id", "projectId", "project_id"]);
  if (candidate) {
    return candidate;
  }

  if (!isRecord(raw)) {
    return undefined;
  }

  return undefined;
}

function readTargetUrl(raw: unknown): string | undefined {
  return findStringByKeys(raw, ["targetUrl", "target_url", "url"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findStringByKeys(value: unknown, keys: string[]): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKeys(item, keys);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const direct = value[key];
    if (typeof direct === "string" && direct.trim()) {
      return direct;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findStringByKeys(nested, keys);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function describeShape(value: unknown): string {
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  return Object.keys(value).slice(0, 12).join(", ") || "empty object";
}
