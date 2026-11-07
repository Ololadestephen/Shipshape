import { describe, expect, it } from "vitest";
import {
  buildPublishableSnapshot,
  canonicalizeJson,
  computeReportDigest,
  verifySnapshotDigest,
  publishableReportSnapshotSchema,
  type PublishableReportSnapshot
} from "../domain/snapshot.js";
import type { Check, LaunchReport, Project, VerificationRun } from "../types/domain.js";

describe("Report Snapshot & Deterministic Digest", () => {
  const sampleProject: Project = {
    id: "prj_test123",
    name: "Sample Store",
    url: "https://store.example.com",
    appType: "ecommerce",
    status: "ready",
    createdAt: "2026-11-05T12:00:00.000Z",
    updatedAt: "2026-11-05T12:00:00.000Z"
  };

  const sampleReport: LaunchReport = {
    id: "rpt_1",
    projectId: "prj_test123",
    verdict: "ready",
    readinessScore: 92,
    summary: "All critical flows verified.",
    blockers: 0,
    warnings: 1,
    polish: 0,
    verifiedChecks: 10,
    totalChecks: 10,
    generatedAt: "2026-11-05T12:30:00.000Z"
  };

  const sampleChecks: Check[] = [
    {
      id: "chk_auth",
      projectId: "prj_test123",
      category: "auth",
      title: "Login with OAuth and email",
      description: "Users can log in",
      severity: "blocker",
      status: "verified",
      createdAt: "2026-11-05T12:00:00.000Z",
      updatedAt: "2026-11-05T12:10:00.000Z"
    },
    {
      id: "chk_checkout",
      projectId: "prj_test123",
      category: "forms",
      title: "Complete checkout flow",
      description: "Cart checkout works end to end",
      severity: "blocker",
      status: "verified",
      notes: "Tested with test token sk_test_1234567890abcdef and local path /Users/apple/secret.txt",
      createdAt: "2026-11-05T12:00:00.000Z",
      updatedAt: "2026-11-05T12:15:00.000Z"
    }
  ];

  const sampleRun: VerificationRun = {
    id: "run_999",
    projectId: "prj_test123",
    source: "testsprite",
    status: "passed",
    summary: "2/2 checks passed with direct evidence",
    evidence: {
      command: "testsprite rerun",
      exitCode: 0,
      resultItems: 2,
      matchedChecks: 2,
      inferredChecks: 0,
      unmatchedResults: 0,
      mappingMode: "direct",
      reportUrl: "https://testsprite.com/reports/rep_123"
    },
    startedAt: "2026-11-05T12:20:00.000Z",
    completedAt: "2026-11-05T12:25:00.000Z",
    createdAt: "2026-11-05T12:20:00.000Z"
  };

  it("builds a schema-valid public report snapshot and sanitizes private tokens", () => {
    const snapshot = buildPublishableSnapshot({
      project: sampleProject,
      report: sampleReport,
      checks: sampleChecks,
      latestRun: sampleRun,
      version: 1
    });

    expect(publishableReportSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.version).toBe(1);
    expect(snapshot.predecessorDigest).toBeNull();
    expect(snapshot.metrics.totalChecks).toBe(10);
    expect(snapshot.metrics.verifiedChecks).toBe(10);

    // Verify sanitization of secret notes
    const checkoutCheck = snapshot.checks.find((c) => c.id === "chk_checkout");
    expect(checkoutCheck?.notes).toContain("[REDACTED_SECRET]");
    expect(checkoutCheck?.notes).toContain("[LOCAL_PATH]");
    expect(checkoutCheck?.notes).not.toContain("sk_test_1234567890abcdef");
    expect(checkoutCheck?.notes).not.toContain("/Users/apple/secret.txt");
  });

  it("produces deterministic canonical JSON regardless of key ordering", () => {
    const objA = {
      b: 2,
      a: 1,
      nested: { z: 26, m: 13, a: 1 }
    };

    const objB = {
      a: 1,
      nested: { a: 1, z: 26, m: 13 },
      b: 2
    };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(computeReportDigest(objA)).toBe(computeReportDigest(objB));
  });

  it("returns stable report digest for identical snapshot data", () => {
    const snapshot1 = buildPublishableSnapshot({
      project: sampleProject,
      report: sampleReport,
      checks: sampleChecks,
      latestRun: sampleRun,
      version: 1
    });

    const snapshot2 = buildPublishableSnapshot({
      project: { ...sampleProject },
      report: { ...sampleReport },
      checks: [...sampleChecks],
      latestRun: { ...sampleRun },
      version: 1
    });

    const digest1 = computeReportDigest(snapshot1);
    const digest2 = computeReportDigest(snapshot2);

    expect(digest1).toMatch(/^0x[0-9a-f]{64}$/);
    expect(digest1).toBe(digest2);
  });

  it("detects tampered export when any field or check status is altered", () => {
    const snapshot = buildPublishableSnapshot({
      project: sampleProject,
      report: sampleReport,
      checks: sampleChecks,
      latestRun: sampleRun,
      version: 1
    });

    const originalDigest = computeReportDigest(snapshot);

    // Tampering 1: Changing verdict from "ready" to "blocked"
    const tamperedVerdict: PublishableReportSnapshot = {
      ...snapshot,
      verdict: "blocked"
    };
    expect(computeReportDigest(tamperedVerdict)).not.toBe(originalDigest);

    // Tampering 2: Changing a check status
    const tamperedChecks: PublishableReportSnapshot = {
      ...snapshot,
      checks: snapshot.checks.map((c) => (c.id === "chk_auth" ? { ...c, status: "failed" } : c))
    };
    expect(computeReportDigest(tamperedChecks)).not.toBe(originalDigest);

    // Tampering 3: Changing readiness score
    const tamperedScore: PublishableReportSnapshot = {
      ...snapshot,
      readinessScore: 99
    };
    expect(computeReportDigest(tamperedScore)).not.toBe(originalDigest);

    const checkResult = verifySnapshotDigest(tamperedScore, originalDigest);
    expect(checkResult.valid).toBe(false);
  });

  it("supports version linking with predecessor digest", () => {
    const predecessorHash = "0x" + "a".repeat(64);
    const v2Snapshot = buildPublishableSnapshot({
      project: sampleProject,
      report: sampleReport,
      checks: sampleChecks,
      latestRun: sampleRun,
      version: 2,
      predecessorDigest: predecessorHash
    });

    expect(v2Snapshot.version).toBe(2);
    expect(v2Snapshot.predecessorDigest).toBe(predecessorHash);

    const v2Digest = computeReportDigest(v2Snapshot);
    expect(v2Digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(verifySnapshotDigest(v2Snapshot, v2Digest).valid).toBe(true);
  });
});
