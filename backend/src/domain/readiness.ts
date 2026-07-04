import type { Check, Issue, LaunchReport, ProjectStatus, ReadinessSummary } from "../types/domain.js";
import { createId, nowIso } from "../services/id.js";

export function calculateReadiness(checks: Check[], issues: Issue[]): ReadinessSummary {
  const totalChecks = checks.length;
  const verifiedChecks = checks.filter((check) => check.status === "verified").length;
  const failedChecks = checks.filter((check) => check.status === "failed").length;
  const openIssues = issues.filter((issue) => issue.status === "open" || issue.status === "fixing");

  const blockers = openIssues.filter((issue) => issue.severity === "blocker").length;
  const warnings = openIssues.filter((issue) => issue.severity === "warning").length;
  const polish = openIssues.filter((issue) => issue.severity === "polish").length;

  const verificationRatio = totalChecks === 0 ? 0 : verifiedChecks / totalChecks;
  const baseScore = Math.round(verificationRatio * 100);
  const penalty = blockers * 25 + warnings * 10 + polish * 4 + failedChecks * 6;
  const score = Math.max(0, Math.min(100, baseScore - penalty));

  return {
    score,
    status: statusFromScore(score, blockers, warnings),
    blockers,
    warnings,
    polish,
    verifiedChecks,
    failedChecks,
    totalChecks
  };
}

export function statusFromScore(score: number, blockers: number, warnings: number): ProjectStatus {
  if (blockers > 0) {
    return "blocked";
  }

  if (score >= 85 && warnings === 0) {
    return "ready";
  }

  if (score >= 70) {
    return "ready_with_warnings";
  }

  return "testing";
}

export function generateLaunchReport(projectId: string, checks: Check[], issues: Issue[]): LaunchReport {
  const readiness = calculateReadiness(checks, issues);
  const verdict =
    readiness.status === "blocked"
      ? "blocked"
      : readiness.status === "ready"
      ? "ready"
      : readiness.status === "ready_with_warnings"
        ? "ready_with_warnings"
        : "in_progress";

  const summary =
    verdict === "blocked"
      ? "Launch is blocked by unresolved critical issues."
      : verdict === "ready"
        ? "All critical launch checks are verified and no open warnings remain."
        : verdict === "ready_with_warnings"
          ? "Core launch flows are verified, but non-blocking risks remain."
          : "Checks are still being verified.";

  return {
    id: createId("rpt"),
    projectId,
    verdict,
    readinessScore: readiness.score,
    summary,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    polish: readiness.polish,
    verifiedChecks: readiness.verifiedChecks,
    totalChecks: readiness.totalChecks,
    generatedAt: nowIso()
  };
}
