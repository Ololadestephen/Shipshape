import { generateChecks } from "../domain/checklistGenerator.js";
import { generateLaunchReport } from "../domain/readiness.js";
import { createId, nowIso } from "./id.js";
import { createTestSpriteProjectCli, readTestSpriteConfig, runTestSpriteCli } from "./testspriteCli.js";
import { mapTestSpriteOutput } from "./testspriteMapper.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type {
  AppType,
  Check,
  CheckStatus,
  Flow,
  FlowPriority,
  Issue,
  IssueStatus,
  LoopEntry,
  LoopEntryKind,
  Project,
  ProjectStatus,
  ResultStatus,
  RunResult,
  RunSource,
  RunStatus,
  TestSpriteRunEvidence,
  VerificationRun
} from "../types/domain.js";

export interface CreateProjectInput {
  name: string;
  url: string;
  appType: AppType;
  flows?: string[];
}

export interface CreateFlowInput {
  name: string;
  description?: string;
  priority?: FlowPriority;
}

export interface CreateIssueInput {
  title: string;
  severity: Issue["severity"];
  status?: IssueStatus;
  reproSteps?: string[];
  expected?: string;
  actual?: string;
  suggestedFix?: string;
  checkId?: string;
  evidenceUrl?: string;
}

export interface CreateRunInput {
  source: RunSource;
  status: RunStatus;
  summary: string;
  evidence?: TestSpriteRunEvidence;
  results?: Array<{
    checkId?: string;
    status: ResultStatus;
    message: string;
    evidenceUrl?: string;
  }>;
}

export class ShipShapeService {
  constructor(private readonly store: MemoryStore) {}

  listProjects() {
    return this.store.listProjects();
  }

  createProject(input: CreateProjectInput) {
    const now = nowIso();
    const project: Project = {
      id: createId("prj"),
      name: input.name,
      url: input.url,
      appType: input.appType,
      status: "draft",
      createdAt: now,
      updatedAt: now
    };

    this.store.createProject(project);

    for (const flowName of input.flows ?? []) {
      this.createFlow(project.id, {
        name: flowName,
        description: `${flowName} launch-critical flow`,
        priority: "critical"
      });
    }

    this.generateChecklist(project.id, true);
    return this.getProjectDetailOrThrow(project.id);
  }

  getProjectDetailOrThrow(projectId: string) {
    const detail = this.store.getProjectDetail(projectId);
    if (!detail) {
      throw notFound("Project not found");
    }

    return detail;
  }

  updateProject(
    projectId: string,
    patch: Partial<Pick<Project, "name" | "url" | "appType" | "status" | "testspriteProjectId" | "testspriteProjectUrl">>
  ) {
    const now = nowIso();
    const project = this.store.updateProject(projectId, { ...patch, updatedAt: now });
    if (!project) {
      throw notFound("Project not found");
    }

    this.store.clearReports(projectId);
    return this.getProjectDetailOrThrow(projectId);
  }

  deleteProject(projectId: string) {
    if (!this.store.deleteProject(projectId)) {
      throw notFound("Project not found");
    }

    return { deleted: true };
  }

  listFlows(projectId: string) {
    this.ensureProject(projectId);
    return this.store.listFlows(projectId);
  }

  createFlow(projectId: string, input: CreateFlowInput) {
    this.ensureProject(projectId);
    const now = nowIso();
    const flow: Flow = {
      id: createId("flw"),
      projectId,
      name: input.name,
      description: input.description ?? `${input.name} launch flow`,
      priority: input.priority ?? "important",
      createdAt: now,
      updatedAt: now
    };

    return this.store.createFlow(flow);
  }

  updateFlow(flowId: string, patch: Partial<Pick<Flow, "name" | "description" | "priority">>) {
    const flow = this.store.updateFlow(flowId, { ...patch, updatedAt: nowIso() });
    if (!flow) {
      throw notFound("Flow not found");
    }

    return flow;
  }

  deleteFlow(flowId: string) {
    if (!this.store.deleteFlow(flowId)) {
      throw notFound("Flow not found");
    }

    return { deleted: true };
  }

  generateChecklist(projectId: string, replaceExisting: boolean) {
    const project = this.ensureProject(projectId);
    const checks = generateChecks(projectId, project.appType, this.store.listFlows(projectId));
    this.store.clearReports(projectId);
    return replaceExisting ? this.store.replaceChecks(projectId, checks) : this.store.addChecks(checks);
  }

  listChecks(projectId: string) {
    this.ensureProject(projectId);
    return this.store.listChecks(projectId);
  }

  updateCheck(checkId: string, patch: Partial<Pick<Check, "status" | "notes" | "severity">>) {
    const check = this.store.updateCheck(checkId, { ...patch, updatedAt: nowIso() });
    if (!check) {
      throw notFound("Check not found");
    }

    if (patch.status === "verified") {
      this.verifyIssueForCheck(check.id);
    }

    this.refreshProjectStatus(check.projectId);
    return check;
  }

  listIssues(projectId: string) {
    this.ensureProject(projectId);
    return this.store.listIssues(projectId);
  }

  createIssue(projectId: string, input: CreateIssueInput) {
    this.ensureProject(projectId);
    const issue = this.buildIssue(projectId, input);
    const created = this.store.createIssue(issue);
    this.refreshProjectStatus(projectId);
    return created;
  }

  updateIssue(issueId: string, patch: Partial<Omit<Issue, "id" | "projectId" | "createdAt">>) {
    const issue = this.store.updateIssue(issueId, { ...patch, updatedAt: nowIso() });
    if (!issue) {
      throw notFound("Issue not found");
    }

    if (issue.checkId && issue.status === "verified") {
      this.store.updateCheck(issue.checkId, { status: "verified", updatedAt: nowIso() });
    }

    this.refreshProjectStatus(issue.projectId);
    return issue;
  }

  listRuns(projectId: string) {
    this.ensureProject(projectId);
    return this.store.listRuns(projectId);
  }

  createRun(projectId: string, input: CreateRunInput) {
    this.ensureProject(projectId);
    const now = nowIso();
    const run: VerificationRun = {
      id: createId("run"),
      projectId,
      source: input.source,
      status: input.status,
      summary: input.summary,
      evidence: input.evidence,
      startedAt: now,
      completedAt: now,
      createdAt: now
    };

    this.store.createRun(run);
    for (const result of input.results ?? []) {
      this.addRunResult(run.id, result);
    }

    this.createLoopEntry(projectId, {
      kind: input.status === "passed" ? "verification" : "failure",
      title: `${labelSource(input.source)} run ${input.status}`,
      body: input.evidence ? `${input.summary} ${formatEvidence(input.evidence)}` : input.summary,
      runId: run.id
    });

    this.refreshProjectStatus(projectId);
    return {
      run,
      results: this.store.listResults(run.id)
    };
  }

  async runTestSprite(projectId: string) {
    const project = this.ensureProject(projectId);
    const config = readTestSpriteConfig();
    const testspriteProjectId = project.testspriteProjectId?.trim();
    if (!config.apiKey || (!testspriteProjectId && !config.testId)) {
      throw new HttpError(
        400,
        "Create or save a TestSprite project for this audit before running TestSprite.",
        "TESTSPRITE_CONFIG_MISSING"
      );
    }

    const cliProjectId = testspriteProjectId ?? config.projectId;
    let commandResult;
    try {
      commandResult = await runTestSpriteCli(project, this.store.listChecks(projectId), { ...config, projectId: cliProjectId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start TestSprite CLI";
      throw new HttpError(502, `Unable to run TestSprite CLI: ${message}`, "TESTSPRITE_CLI_FAILED");
    }

    let mappedRun;
    try {
      mappedRun = mapTestSpriteOutput(this.store.listChecks(projectId), commandResult);
    } catch (error) {
      const detail = commandResult.stderr.trim() || commandResult.stdout.trim();
      const message = error instanceof Error ? error.message : "Unable to parse TestSprite output";
      throw new HttpError(502, message, "TESTSPRITE_OUTPUT_INVALID", detail.slice(0, 2000));
    }

    return this.createRun(projectId, mappedRun);
  }

  getTestSpriteSetup(projectId: string) {
    const project = this.ensureProject(projectId);
    const config = readTestSpriteConfig();
    const projectIdFromProject = project.testspriteProjectId?.trim();
    const testIdFromEnv = config.testId?.trim();

    return {
      apiKeyConfigured: Boolean(config.apiKey),
      cliBin: config.cliBin,
      timeoutSeconds: config.timeoutSeconds,
      projectId: projectIdFromProject || undefined,
      projectIdSource: projectIdFromProject ? "project" : "none",
      testIdConfigured: Boolean(testIdFromEnv),
      targetUrl: project.testspriteProjectUrl ?? project.url,
      readyToRun: Boolean(config.apiKey && (projectIdFromProject || testIdFromEnv))
    };
  }

  async createTestSpriteProject(projectId: string, input: { targetUrl?: string }) {
    const project = this.ensureProject(projectId);
    const config = readTestSpriteConfig();
    if (!config.apiKey) {
      throw new HttpError(400, "Set TESTSPRITE_API_KEY before creating a TestSprite project.", "TESTSPRITE_CONFIG_MISSING");
    }

    const targetUrl = input.targetUrl ?? project.url;
    if (isLocalUrl(targetUrl)) {
      throw new HttpError(400, "TestSprite needs a public URL. Deploy first or use a tunnel URL.", "TESTSPRITE_PUBLIC_URL_REQUIRED");
    }

    let created;
    try {
      created = await createTestSpriteProjectCli(project, targetUrl, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create TestSprite project";
      throw new HttpError(502, message, "TESTSPRITE_PROJECT_CREATE_FAILED");
    }

    return this.updateProject(projectId, {
      testspriteProjectId: created.id,
      testspriteProjectUrl: created.targetUrl
    });
  }

  getRun(runId: string) {
    const run = this.store.getRun(runId);
    if (!run) {
      throw notFound("Run not found");
    }

    return {
      run,
      results: this.store.listResults(runId)
    };
  }

  addRunResult(runId: string, input: { checkId?: string; status: ResultStatus; message: string; evidenceUrl?: string }) {
    const run = this.store.getRun(runId);
    if (!run) {
      throw notFound("Run not found");
    }

    const result: RunResult = {
      id: createId("res"),
      runId,
      projectId: run.projectId,
      checkId: input.checkId,
      status: input.status,
      message: input.message,
      evidenceUrl: input.evidenceUrl,
      createdAt: nowIso()
    };

    this.store.createResult(result);
    this.applyRunResult(result);
    this.refreshProjectStatus(run.projectId);
    return result;
  }

  getOrGenerateReport(projectId: string) {
    this.ensureProject(projectId);
    return this.store.getLatestReport(projectId) ?? this.generateReport(projectId);
  }

  generateReport(projectId: string) {
    this.ensureProject(projectId);
    const report = generateLaunchReport(projectId, this.store.listChecks(projectId), this.store.listIssues(projectId));
    this.store.createReport(report);
    return report;
  }

  listLoop(projectId: string) {
    this.ensureProject(projectId);
    return this.store.listLoop(projectId);
  }

  createLoopEntry(
    projectId: string,
    input: {
      kind: LoopEntryKind;
      title: string;
      body: string;
      runId?: string;
      issueId?: string;
      evidenceUrl?: string;
    }
  ) {
    this.ensureProject(projectId);
    const entry: LoopEntry = {
      id: createId("loop"),
      projectId,
      runId: input.runId,
      issueId: input.issueId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      evidenceUrl: input.evidenceUrl,
      createdAt: nowIso()
    };

    return this.store.createLoopEntry(entry);
  }

  private applyRunResult(result: RunResult) {
    if (!result.checkId) {
      return;
    }

    const check = this.store.getCheck(result.checkId);
    if (!check) {
      return;
    }

    const status: CheckStatus =
      result.status === "passed" ? "verified" : result.status === "failed" ? "failed" : check.status;

    this.store.updateCheck(check.id, {
      status,
      notes: result.message,
      updatedAt: nowIso()
    });

    if (result.status === "failed") {
      const issue = this.store.findIssueByCheck(check.id);
      if (issue) {
        this.store.updateIssue(issue.id, {
          status: "open",
          actual: result.message,
          evidenceUrl: result.evidenceUrl,
          updatedAt: nowIso()
        });
      } else {
        const created = this.createIssue(check.projectId, {
          checkId: check.id,
          title: check.title,
          severity: check.severity,
          status: "open",
          reproSteps: [`Run ${check.title}`, "Review the failed verification result"],
          expected: check.description,
          actual: result.message,
          suggestedFix: "Use the failed verification evidence to update the implementation, then rerun the check.",
          evidenceUrl: result.evidenceUrl
        });

        this.createLoopEntry(check.projectId, {
          kind: "failure",
          title: `Failed check: ${check.title}`,
          body: result.message,
          issueId: created.id,
          runId: result.runId,
          evidenceUrl: result.evidenceUrl
        });
      }
    }

    if (result.status === "passed") {
      this.verifyIssueForCheck(check.id);
      this.createLoopEntry(check.projectId, {
        kind: "verification",
        title: `Verified check: ${check.title}`,
        body: result.message,
        runId: result.runId,
        evidenceUrl: result.evidenceUrl
      });
    }
  }

  private verifyIssueForCheck(checkId: string) {
    const issue = this.store.findIssueByCheck(checkId);
    if (!issue) {
      return;
    }

    this.store.updateIssue(issue.id, {
      status: "verified",
      updatedAt: nowIso()
    });
  }

  private buildIssue(projectId: string, input: CreateIssueInput): Issue {
    const now = nowIso();
    return {
      id: createId("iss"),
      projectId,
      checkId: input.checkId,
      title: input.title,
      severity: input.severity,
      status: input.status ?? "open",
      reproSteps: input.reproSteps ?? [],
      expected: input.expected ?? "Launch-critical behavior works as expected.",
      actual: input.actual ?? "Verification found a launch risk.",
      suggestedFix: input.suggestedFix ?? "Investigate the failing flow, patch it, and rerun verification.",
      evidenceUrl: input.evidenceUrl,
      createdAt: now,
      updatedAt: now
    };
  }

  private ensureProject(projectId: string) {
    const project = this.store.getProject(projectId);
    if (!project) {
      throw notFound("Project not found");
    }

    return project;
  }

  private refreshProjectStatus(projectId: string) {
    const readiness = this.store.getReadiness(projectId);
    const status: ProjectStatus = readiness.status;
    this.store.clearReports(projectId);
    this.store.updateProject(projectId, {
      status,
      updatedAt: nowIso()
    });
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

function labelSource(source: RunSource): string {
  if (source === "testsprite") {
    return "TestSprite";
  }

  if (source === "ci") {
    return "CI";
  }

  return "Manual";
}

function formatEvidence(evidence: TestSpriteRunEvidence): string {
  const resultLabel = evidence.resultItems === 1 ? "result item" : "result items";
  const inferred =
    evidence.inferredChecks > 0
      ? `, ${evidence.inferredChecks} inferred check${evidence.inferredChecks === 1 ? "" : "s"}`
      : "";
  return `(Evidence: ${evidence.resultItems} TestSprite ${resultLabel}, ${evidence.matchedChecks} matched check${
    evidence.matchedChecks === 1 ? "" : "s"
  }${inferred}, mode ${evidence.mappingMode}, exit ${evidence.exitCode ?? "unknown"}.)`;
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}
