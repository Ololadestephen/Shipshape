import type { Check, ResultStatus, RunStatus, TestSpriteMappingMode, TestSpriteRunEvidence } from "../types/domain.js";

export interface TestSpriteCommandResult {
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface MappedTestSpriteRun {
  source: "testsprite";
  status: RunStatus;
  summary: string;
  evidence: TestSpriteRunEvidence;
  results: Array<{
    checkId?: string;
    status: ResultStatus;
    message: string;
    evidenceUrl?: string;
  }>;
}

interface ParsedResult {
  name: string;
  status: ResultStatus;
  message: string;
  evidenceUrl?: string;
}

interface MappedCheckResults {
  results: MappedTestSpriteRun["results"];
  matchedChecks: number;
  inferredChecks: number;
  unmatchedResults: number;
  mappingMode: TestSpriteMappingMode;
}

export function parseTestSpritePayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("TestSprite CLI did not return JSON output.");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as unknown;
    }

    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1)) as unknown;
    }

    throw new Error("TestSprite CLI output was not valid JSON.");
  }
}

export function mapTestSpriteOutput(checks: Check[], commandResult: TestSpriteCommandResult): MappedTestSpriteRun {
  const payload = parseTestSpritePayload(commandResult.stdout);
  const parsedResults = extractResults(payload);
  const status = inferRunStatus(payload, parsedResults, commandResult.exitCode);
  const mapped = mapResultsToChecks(checks, parsedResults, status);
  const summary = buildSummary(payload, status, parsedResults, commandResult.exitCode);

  return {
    source: "testsprite",
    status,
    evidence: {
      command: commandResult.command.join(" "),
      exitCode: commandResult.exitCode,
      resultItems: parsedResults.length,
      matchedChecks: mapped.matchedChecks,
      inferredChecks: mapped.inferredChecks,
      unmatchedResults: mapped.unmatchedResults,
      mappingMode: mapped.mappingMode,
      payloadStatus: findStatus(payload),
      reportUrl: findUrl(payload)
    },
    summary,
    results: mapped.results
  };
}

function extractResults(payload: unknown): ParsedResult[] {
  const resultArrays = findResultArrays(payload);
  const items = resultArrays.flatMap((value) => value).filter(isRecord);

  return items.map((item) => {
    const name = firstString(item, ["name", "title", "testName", "test", "id", "testId"]) ?? "TestSprite check";
    const rawStatus = firstString(item, ["status", "verdict", "outcome", "result", "state"]);
    const message =
      firstString(item, ["message", "summary", "error", "failure", "reason", "actual"]) ??
      readNestedString(item, ["analysis", "rootCauseHypothesis"]) ??
      readNestedString(item, ["analysis", "recommendedFixTarget"]) ??
      `${name} ${toResultStatus(rawStatus) ?? "skipped"} in TestSprite.`;

    return {
      name,
      status: toResultStatus(rawStatus) ?? "skipped",
      message,
      evidenceUrl: firstString(item, ["evidenceUrl", "reportUrl", "failureBundleUrl", "url"])
    };
  });
}

function findResultArrays(payload: unknown): unknown[][] {
  if (Array.isArray(payload)) {
    return [payload];
  }

  if (!isRecord(payload)) {
    return [];
  }

  const paths = [
    ["results"],
    ["tests"],
    ["items"],
    ["failures"],
    ["run", "results"],
    ["run", "tests"],
    ["result", "results"],
    ["result", "tests"],
    ["data", "results"],
    ["data", "tests"]
  ];

  return paths
    .map((path) => readPath(payload, path))
    .filter((value): value is unknown[] => Array.isArray(value));
}

function inferRunStatus(payload: unknown, results: ParsedResult[], exitCode: number | null): RunStatus {
  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  const rawStatus = findStatus(payload);
  const normalized = normalize(rawStatus);

  if (["passed", "pass", "success", "succeeded", "ready", "ok", "completed"].includes(normalized)) {
    return "passed";
  }

  if (["failed", "fail", "failure", "error", "blocked", "cancelled", "canceled"].includes(normalized)) {
    return "failed";
  }

  if (["partial", "mixed", "running", "pending", "incomplete"].includes(normalized)) {
    return "partial";
  }

  if (results.length > 0 && results.every((result) => result.status !== "failed")) {
    return "passed";
  }

  return exitCode === 0 ? "passed" : "failed";
}

function mapResultsToChecks(checks: Check[], parsedResults: ParsedResult[], status: RunStatus): MappedCheckResults {
  const usedCheckIds = new Set<string>();
  const mapped = parsedResults.map((result) => {
    const check = findBestCheck(result, checks, usedCheckIds);
    if (check) {
      usedCheckIds.add(check.id);
    }

    return {
      checkId: check?.id,
      status: result.status,
      message: result.message,
      evidenceUrl: result.evidenceUrl
    };
  });

  if (mapped.some((result) => result.checkId)) {
    const matchedChecks = usedCheckIds.size;
    const unmatchedResults = mapped.filter((result) => !result.checkId).length;
    if (status === "passed") {
      const extraPassed = checks
        .filter((check) => !usedCheckIds.has(check.id))
        .map((check) => ({
          checkId: check.id,
          status: "passed" as const,
          message: `${check.title} passed in TestSprite.`
        }));
      return {
        results: [...mapped, ...extraPassed],
        matchedChecks,
        inferredChecks: extraPassed.length,
        unmatchedResults,
        mappingMode: extraPassed.length > 0 ? "direct_plus_inferred" : "direct"
      };
    }

    return {
      results: mapped,
      matchedChecks,
      inferredChecks: 0,
      unmatchedResults,
      mappingMode: "direct"
    };
  }

  if (status === "passed") {
    return {
      results: checks.map((check) => ({
        checkId: check.id,
        status: "passed",
        message: `${check.title} passed in TestSprite.`
      })),
      matchedChecks: 0,
      inferredChecks: checks.length,
      unmatchedResults: parsedResults.length,
      mappingMode: "inferred_overall_pass"
    };
  }

  if (status === "failed") {
    const check =
      checks.find((candidate) => candidate.status !== "verified" && candidate.severity === "blocker") ??
      checks.find((candidate) => candidate.status !== "verified") ??
      checks[0];

    return {
      results: check
        ? [
            {
              checkId: check.id,
              status: "failed",
              message: "TestSprite failed the run, but did not include a per-check result in the JSON output."
            }
          ]
        : [],
      matchedChecks: 0,
      inferredChecks: check ? 1 : 0,
      unmatchedResults: parsedResults.length,
      mappingMode: "single_failure_fallback"
    };
  }

  return {
    results: checks.map((check) => ({
      checkId: check.id,
      status: "skipped",
      message: `${check.title} was not resolved by the TestSprite run.`
    })),
    matchedChecks: 0,
    inferredChecks: checks.length,
    unmatchedResults: parsedResults.length,
    mappingMode: "partial_skipped"
  };
}

function findBestCheck(result: ParsedResult, checks: Check[], usedCheckIds: Set<string>) {
  const haystack = normalize(`${result.name} ${result.message}`);
  let best: { check: Check; score: number } | undefined;

  for (const check of checks) {
    if (usedCheckIds.has(check.id)) {
      continue;
    }

    const category = normalize(check.category);
    const title = normalize(check.title);
    const description = normalize(check.description);
    let score = 0;

    if (haystack.includes(title) || title.includes(haystack)) {
      score += 12;
    }

    if (category && haystack.includes(category)) {
      score += 6;
    }

    for (const token of new Set([...title.split(" "), ...description.split(" ")])) {
      if (token.length >= 4 && haystack.includes(token)) {
        score += 1;
      }
    }

    if (!best || score > best.score) {
      best = { check, score };
    }
  }

  return best && best.score >= 2 ? best.check : undefined;
}

function buildSummary(payload: unknown, status: RunStatus, results: ParsedResult[], exitCode: number | null) {
  const payloadSummary = isRecord(payload) ? firstString(payload, ["summary", "message", "description"]) : undefined;
  if (payloadSummary) {
    return payloadSummary;
  }

  const failed = results.filter((result) => result.status === "failed").length;
  const passed = results.filter((result) => result.status === "passed").length;
  const total = results.length;

  if (total > 0) {
    return `TestSprite ${status}: ${passed} passed, ${failed} failed, ${total - passed - failed} unresolved.`;
  }

  return `TestSprite ${status}${exitCode === null ? "" : ` with exit code ${exitCode}`}.`;
}

function findStatus(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  return (
    firstString(payload, ["status", "verdict", "outcome", "result", "state"]) ??
    readNestedString(payload, ["run", "status"]) ??
    readNestedString(payload, ["result", "status"]) ??
    readNestedString(payload, ["data", "status"])
  );
}

function findUrl(payload: unknown): string | undefined {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findUrl(item);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const direct = firstString(payload, ["reportUrl", "report_url", "failureBundleUrl", "failure_bundle_url", "runUrl", "run_url", "url"]);
  if (direct?.startsWith("http")) {
    return direct;
  }

  for (const nested of Object.values(payload)) {
    const found = findUrl(nested);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function toResultStatus(rawStatus: string | undefined): ResultStatus | undefined {
  const normalized = normalize(rawStatus);

  if (["passed", "pass", "success", "succeeded", "ready", "ok"].includes(normalized)) {
    return "passed";
  }

  if (["failed", "fail", "failure", "error", "blocked", "cancelled", "canceled"].includes(normalized)) {
    return "failed";
  }

  if (normalized) {
    return "skipped";
  }

  return undefined;
}

function readNestedString(record: Record<string, unknown>, path: string[]) {
  const value = readPath(record, path);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readPath(record: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), record);
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalize(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
