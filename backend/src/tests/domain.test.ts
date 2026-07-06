import { describe, expect, it } from "vitest";
import { generateChecks } from "../domain/checklistGenerator.js";
import { calculateReadiness, generateLaunchReport } from "../domain/readiness.js";
import { ShipShapeService } from "../services/shipshapeService.js";
import { buildCreateProjectArgs, buildTestSpriteArgs, readTestSpriteProjectId } from "../services/testspriteCli.js";
import { mapTestSpriteOutput } from "../services/testspriteMapper.js";
import { MemoryStore } from "../storage/memoryStore.js";
import type { Check, Flow, Issue } from "../types/domain.js";

describe("checklist generation", () => {
  it("generates universal, app-specific, and flow-specific checks", () => {
    const flow: Flow = {
      id: "flw_signup",
      projectId: "prj_1",
      name: "Signup",
      description: "Create account",
      priority: "critical",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const checks = generateChecks("prj_1", "saas", [flow]);

    expect(checks.length).toBeGreaterThan(7);
    expect(checks.some((check) => check.category === "auth")).toBe(true);
    expect(checks.some((check) => check.flowId === flow.id)).toBe(true);
    expect(checks.every((check) => check.status === "untested")).toBe(true);
  });
});

describe("readiness scoring", () => {
  it("blocks launch when open blocker issues exist", () => {
    const checks = createChecks().map((check) => ({ ...check, status: "verified" as const }));
    const issues = [
      {
        ...createIssue(checks[0]),
        severity: "blocker" as const,
        status: "open" as const
      }
    ];

    const readiness = calculateReadiness(checks, issues);

    expect(readiness.status).toBe("blocked");
    expect(readiness.score).toBeLessThan(100);
  });

  it("creates ready reports when checks are verified and issues are closed", () => {
    const checks = createChecks().map((check) => ({ ...check, status: "verified" as const }));
    const issues = [createIssue(checks[0])].map((issue) => ({ ...issue, status: "verified" as const }));

    const report = generateLaunchReport("prj_1", checks, issues);

    expect(report.verdict).toBe("ready");
    expect(report.readinessScore).toBe(100);
  });

  it("keeps untested audits in progress instead of blocked", () => {
    const report = generateLaunchReport("prj_1", createChecks(), []);

    expect(report.verdict).toBe("in_progress");
  });
});

describe("verification runs", () => {
  it("turns failed run results into open issues and loop entries", () => {
    const store = new MemoryStore();
    const service = new ShipShapeService(store);
    const project = service.createProject({
      name: "Demo",
      url: "https://example.com",
      appType: "saas",
      flows: ["Signup"]
    }).project;
    const check = service.listChecks(project.id)[0];

    const beforeIssueCount = service.listIssues(project.id).length;
    service.createRun(project.id, {
      source: "testsprite",
      status: "failed",
      summary: "A launch-critical check failed",
      results: [
        {
          checkId: check.id,
          status: "failed",
          message: "CTA click did not navigate to the audit builder"
        }
      ]
    });

    const issues = service.listIssues(project.id);
    const loop = service.listLoop(project.id);

    expect(issues.length).toBeGreaterThan(beforeIssueCount);
    expect(issues.some((issue) => issue.checkId === check.id && issue.status === "open")).toBe(true);
    expect(loop.some((entry) => entry.kind === "failure")).toBe(true);
  });

  it("moves from blocked to ready after a passing TestSprite rerun", () => {
    const service = new ShipShapeService(new MemoryStore());
    const project = service.createProject({
      name: "Demo",
      url: "https://example.com",
      appType: "saas",
      flows: ["Signup"]
    }).project;
    const checks = service.listChecks(project.id);
    const failedCheck = checks[0];

    service.createRun(project.id, {
      source: "testsprite",
      status: "failed",
      summary: "One critical flow failed",
      results: checks.map((check) => ({
        checkId: check.id,
        status: check.id === failedCheck.id ? "failed" : "passed",
        message: `${check.title} result`
      }))
    });

    expect(service.generateReport(project.id).verdict).toBe("blocked");

    service.createRun(project.id, {
      source: "testsprite",
      status: "passed",
      summary: "All launch checks passed",
      results: checks.map((check) => ({
        checkId: check.id,
        status: "passed",
        message: `${check.title} passed`
      }))
    });

    expect(service.generateReport(project.id).verdict).toBe("ready");
  });
});

describe("TestSprite result mapping", () => {
  it("maps suite-level passing output to all launch checks", () => {
    const checks = createChecks();
    const mapped = mapTestSpriteOutput(checks, {
      command: ["testsprite", "--output", "json", "test", "rerun"],
      exitCode: 0,
      stdout: JSON.stringify({ status: "passed" }),
      stderr: ""
    });

    expect(mapped.status).toBe("passed");
    expect(mapped.results).toHaveLength(checks.length);
    expect(mapped.results.every((result) => result.status === "passed" && result.checkId)).toBe(true);
    expect(mapped.evidence.resultItems).toBe(0);
    expect(mapped.evidence.inferredChecks).toBe(checks.length);
    expect(mapped.evidence.mappingMode).toBe("inferred_overall_pass");
  });

  it("maps failed TestSprite items to matching checks", () => {
    const checks = createChecks();
    const mobileCheck = checks.find((check) => check.category === "mobile");
    const mapped = mapTestSpriteOutput(checks, {
      command: ["testsprite", "--output", "json", "test", "rerun"],
      exitCode: 1,
      stdout: JSON.stringify({
        run: { status: "failed" },
        results: [
          {
            title: "Mobile viewport keeps controls readable and tappable",
            status: "failed",
            message: "Controls overflow at 390px."
          }
        ]
      }),
      stderr: ""
    });

    expect(mapped.status).toBe("failed");
    expect(mapped.results.some((result) => result.checkId === mobileCheck?.id && result.status === "failed")).toBe(true);
    expect(mapped.evidence.resultItems).toBe(1);
    expect(mapped.evidence.matchedChecks).toBe(1);
    expect(mapped.evidence.mappingMode).toBe("direct");
  });

  it("falls back to the first unresolved blocker when failed output has no per-check data", () => {
    const checks = createChecks();
    const mapped = mapTestSpriteOutput(checks, {
      command: ["testsprite", "--output", "json", "test", "rerun"],
      exitCode: 1,
      stdout: JSON.stringify({ status: "failed" }),
      stderr: ""
    });

    expect(mapped.status).toBe("failed");
    expect(mapped.results).toHaveLength(1);
    expect(mapped.results[0].status).toBe("failed");
    expect(mapped.results[0].checkId).toBe(checks.find((check) => check.severity === "blocker")?.id);
    expect(mapped.evidence.mappingMode).toBe("single_failure_fallback");
  });
});

describe("TestSprite CLI commands", () => {
  it("uses the configured TestSprite project id for suite reruns", () => {
    const project = createProjectFixture({ testspriteProjectId: "p_project" });
    const args = buildTestSpriteArgs(project, {
      apiKey: "secret",
      projectId: project.testspriteProjectId ?? "p_env",
      cliBin: "testsprite",
      timeoutSeconds: 900
    });

    expect(args).toContain("p_project");
    expect(args).not.toContain("p_env");
  });

  it("creates frontend TestSprite projects from the public target URL", () => {
    const args = buildCreateProjectArgs(createProjectFixture(), "https://shipshape.vercel.app");

    expect(args).toContain("project");
    expect(args).toContain("create");
    expect(args).toContain("frontend");
    expect(args).toContain("https://shipshape.vercel.app");
  });

  it("accepts nested projectId fields from TestSprite project creation output", () => {
    expect(
      readTestSpriteProjectId({
        data: {
          project: {
            projectId: "p_nested_123"
          }
        }
      })
    ).toBe("p_nested_123");
  });
});

function createChecks(): Check[] {
  return generateChecks("prj_1", "saas", [
    {
      id: "flw_signup",
      projectId: "prj_1",
      name: "Signup",
      description: "Create account",
      priority: "critical",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
}

function createIssue(check: Check): Issue {
  const now = new Date().toISOString();
  return {
    id: "iss_1",
    projectId: check.projectId,
    checkId: check.id,
    title: "Critical issue",
    severity: "blocker",
    status: "open",
    reproSteps: ["Run the flow"],
    expected: "Flow passes",
    actual: "Flow fails",
    suggestedFix: "Fix the flow",
    createdAt: now,
    updatedAt: now
  };
}

function createProjectFixture(patch: Partial<ReturnType<ShipShapeService["listProjects"]>[number]> = {}) {
  const now = new Date().toISOString();
  return {
    id: "prj_1",
    name: "ShipShape",
    url: "https://shipshape.example.com",
    appType: "saas" as const,
    status: "testing" as const,
    createdAt: now,
    updatedAt: now,
    ...patch
  };
}
