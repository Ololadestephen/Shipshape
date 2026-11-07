import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  Check,
  CheckCategory,
  CheckStatus,
  LaunchReport,
  Project,
  ReportVerdict,
  RunSource,
  RunStatus,
  Severity,
  VerificationRun
} from "../types/domain.js";

export const snapshotMetricSchema = z.object({
  blockers: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  polish: z.number().int().nonnegative(),
  verifiedChecks: z.number().int().nonnegative(),
  totalChecks: z.number().int().nonnegative()
});

export const snapshotCheckSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "navigation",
    "auth",
    "forms",
    "onboarding",
    "mobile",
    "accessibility",
    "content",
    "seo",
    "performance",
    "error_states",
    "security",
    "ci_cd"
  ]),
  title: z.string().min(1).max(256),
  severity: z.enum(["blocker", "warning", "polish"]),
  status: z.enum(["untested", "failed", "fixing", "verified"]),
  notes: z.string().max(1024).optional()
});

export const snapshotEvidenceSummarySchema = z.object({
  source: z.enum(["manual", "testsprite", "ci"]),
  status: z.enum(["passed", "failed", "partial"]),
  summary: z.string().max(1024),
  mappingMode: z.string().max(128),
  resultItems: z.number().int().nonnegative(),
  matchedChecks: z.number().int().nonnegative(),
  inferredChecks: z.number().int().nonnegative(),
  exitCode: z.number().int().nullable()
});

export const publishableReportSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  version: z.number().int().positive(),
  projectId: z.string().min(1).max(128),
  projectName: z.string().min(1).max(128),
  targetUrl: z.string().url().max(512),
  verdict: z.enum(["ready", "ready_with_warnings", "in_progress", "blocked"]),
  readinessScore: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(2048),
  metrics: snapshotMetricSchema,
  checks: z.array(snapshotCheckSchema),
  evidenceSummary: snapshotEvidenceSummarySchema.nullish(),
  predecessorDigest: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .nullable(),
  generatedAt: z.string().datetime()
});

export type SnapshotMetric = z.infer<typeof snapshotMetricSchema>;
export type SnapshotCheck = z.infer<typeof snapshotCheckSchema>;
export type SnapshotEvidenceSummary = z.infer<typeof snapshotEvidenceSummarySchema>;
export type PublishableReportSnapshot = z.infer<typeof publishableReportSnapshotSchema>;

export interface BuildSnapshotInput {
  project: Project;
  report: LaunchReport;
  checks: Check[];
  latestRun?: VerificationRun;
  version: number;
  predecessorDigest?: string | null;
  generatedAt?: string;
}

/**
 * Deterministically serializes any JSON-compatible value by sorting object keys recursively.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined) {
      pairs.push(`${JSON.stringify(key)}:${canonicalizeJson(val)}`);
    }
  }

  return `{${pairs.join(",")}}`;
}

/**
 * Computes a deterministic SHA-256 hex digest (prefixed with 0x, exactly 32 bytes)
 * from a report snapshot or canonical JSON string.
 */
export function computeReportDigest(snapshotOrJson: PublishableReportSnapshot | unknown): string {
  const canonicalString =
    typeof snapshotOrJson === "string"
      ? canonicalizeJson(JSON.parse(snapshotOrJson))
      : canonicalizeJson(snapshotOrJson);

  const hash = createHash("sha256").update(canonicalString, "utf8").digest("hex");
  return `0x${hash.toLowerCase()}`;
}

/**
 * Sanitizes check notes so sensitive credentials or local paths are never embedded into public snapshots.
 */
function sanitizePublicNote(notes?: string): string | undefined {
  if (!notes) {
    return undefined;
  }

  // Remove potential private keys, tokens, or local absolute paths
  let clean = notes
    .replace(/(?:sk_live_|sk_test_|ghp_|bearer\s+)[a-zA-Z0-9_\-]+/gi, "[REDACTED_SECRET]")
    .replace(/\/Users\/[^\s"']+/g, "[LOCAL_PATH]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");

  if (clean.length > 1024) {
    clean = clean.slice(0, 1021) + "...";
  }

  return clean;
}

/**
 * Builds a validated, canonical, public-safe release report snapshot.
 */
export function buildPublishableSnapshot(input: BuildSnapshotInput): PublishableReportSnapshot {
  const sortedChecks: SnapshotCheck[] = input.checks
    .map((check) => ({
      id: check.id,
      category: check.category,
      title: check.title.trim(),
      severity: check.severity,
      status: check.status,
      notes: sanitizePublicNote(check.notes)
    }))
    .sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      const titleCompare = a.title.localeCompare(b.title);
      if (titleCompare !== 0) return titleCompare;
      return a.id.localeCompare(b.id);
    });

  let evidenceSummary: SnapshotEvidenceSummary | null = null;
  if (input.latestRun) {
    const evidence = input.latestRun.evidence;
    evidenceSummary = {
      source: input.latestRun.source,
      status: input.latestRun.status,
      summary: input.latestRun.summary.slice(0, 1024),
      mappingMode: evidence?.mappingMode ?? "unspecified",
      resultItems: evidence?.resultItems ?? 0,
      matchedChecks: evidence?.matchedChecks ?? 0,
      inferredChecks: evidence?.inferredChecks ?? 0,
      exitCode: evidence?.exitCode ?? null
    };
  }

  const rawSnapshot = {
    schemaVersion: "1.0.0" as const,
    version: input.version,
    projectId: input.project.id,
    projectName: input.project.name.trim(),
    targetUrl: input.project.url.trim(),
    verdict: input.report.verdict,
    readinessScore: input.report.readinessScore,
    summary: input.report.summary.trim(),
    metrics: {
      blockers: input.report.blockers,
      warnings: input.report.warnings,
      polish: input.report.polish,
      verifiedChecks: input.report.verifiedChecks,
      totalChecks: input.report.totalChecks
    },
    checks: sortedChecks,
    evidenceSummary,
    predecessorDigest: input.predecessorDigest ? input.predecessorDigest.toLowerCase() : null,
    generatedAt: input.generatedAt ?? input.report.generatedAt
  };

  return publishableReportSnapshotSchema.parse(rawSnapshot);
}

/**
 * Verifies whether a given snapshot matches an expected on-chain report digest.
 */
export function verifySnapshotDigest(
  snapshot: PublishableReportSnapshot | unknown,
  expectedDigest: string
): { valid: boolean; computedDigest: string; expectedDigest: string } {
  const computedDigest = computeReportDigest(snapshot);
  const normalizedExpected = expectedDigest.trim().toLowerCase();
  return {
    valid: computedDigest === normalizedExpected,
    computedDigest,
    expectedDigest: normalizedExpected
  };
}
