import type {
  Check,
  Flow,
  Issue,
  LaunchReport,
  LoopEntry,
  Project,
  ProjectDetail,
  ReadinessSummary,
  RunResult,
  VerificationRun
} from "../types/domain.js";
import { calculateReadiness } from "../domain/readiness.js";

export interface ShipShapeState {
  projects: Project[];
  flows: Flow[];
  checks: Check[];
  issues: Issue[];
  runs: VerificationRun[];
  results: RunResult[];
  reports: LaunchReport[];
  loop: LoopEntry[];
}

export class MemoryStore {
  private state: ShipShapeState;
  private readonly onChange?: (state: ShipShapeState) => void;

  constructor(initialState?: ShipShapeState, onChange?: (state: ShipShapeState) => void) {
    this.state = initialState ?? {
      projects: [],
      flows: [],
      checks: [],
      issues: [],
      runs: [],
      results: [],
      reports: [],
      loop: []
    };
    this.onChange = onChange;
  }

  listProjects(): Array<Project & { readiness: ReadinessSummary }> {
    return this.state.projects.map((project) => ({
      ...project,
      readiness: this.getReadiness(project.id)
    }));
  }

  createProject(project: Project): Project {
    this.state.projects.push(project);
    return this.commit(project);
  }

  getProject(projectId: string): Project | undefined {
    return this.state.projects.find((project) => project.id === projectId);
  }

  updateProject(projectId: string, patch: Partial<Project>): Project | undefined {
    const project = this.getProject(projectId);
    if (!project) {
      return undefined;
    }

    Object.assign(project, patch);
    return this.commit(project);
  }

  deleteProject(projectId: string): boolean {
    const before = this.state.projects.length;
    this.state.projects = this.state.projects.filter((project) => project.id !== projectId);
    this.state.flows = this.state.flows.filter((flow) => flow.projectId !== projectId);
    this.state.checks = this.state.checks.filter((check) => check.projectId !== projectId);
    this.state.issues = this.state.issues.filter((issue) => issue.projectId !== projectId);
    this.state.runs = this.state.runs.filter((run) => run.projectId !== projectId);
    this.state.results = this.state.results.filter((result) => result.projectId !== projectId);
    this.state.reports = this.state.reports.filter((report) => report.projectId !== projectId);
    this.state.loop = this.state.loop.filter((entry) => entry.projectId !== projectId);
    return this.commit(this.state.projects.length < before);
  }

  getProjectDetail(projectId: string): ProjectDetail | undefined {
    const project = this.getProject(projectId);
    if (!project) {
      return undefined;
    }

    const checks = this.listChecks(projectId);
    const issues = this.listIssues(projectId);

    return {
      project,
      flows: this.listFlows(projectId),
      checks,
      issues,
      runs: this.listRuns(projectId),
      latestReport: this.getLatestReport(projectId),
      loop: this.listLoop(projectId),
      readiness: calculateReadiness(checks, issues)
    };
  }

  listFlows(projectId: string): Flow[] {
    return this.state.flows.filter((flow) => flow.projectId === projectId);
  }

  createFlow(flow: Flow): Flow {
    this.state.flows.push(flow);
    return this.commit(flow);
  }

  getFlow(flowId: string): Flow | undefined {
    return this.state.flows.find((flow) => flow.id === flowId);
  }

  updateFlow(flowId: string, patch: Partial<Flow>): Flow | undefined {
    const flow = this.getFlow(flowId);
    if (!flow) {
      return undefined;
    }

    Object.assign(flow, patch);
    return this.commit(flow);
  }

  deleteFlow(flowId: string): boolean {
    const before = this.state.flows.length;
    this.state.flows = this.state.flows.filter((flow) => flow.id !== flowId);
    this.state.checks = this.state.checks.filter((check) => check.flowId !== flowId);
    return this.commit(this.state.flows.length < before);
  }

  listChecks(projectId: string): Check[] {
    return this.state.checks.filter((check) => check.projectId === projectId);
  }

  replaceChecks(projectId: string, checks: Check[]): Check[] {
    this.state.checks = this.state.checks.filter((check) => check.projectId !== projectId);
    this.state.checks.push(...checks);
    return this.commit(this.listChecks(projectId));
  }

  addChecks(checks: Check[]): Check[] {
    this.state.checks.push(...checks);
    return this.commit(checks);
  }

  getCheck(checkId: string): Check | undefined {
    return this.state.checks.find((check) => check.id === checkId);
  }

  updateCheck(checkId: string, patch: Partial<Check>): Check | undefined {
    const check = this.getCheck(checkId);
    if (!check) {
      return undefined;
    }

    Object.assign(check, patch);
    return this.commit(check);
  }

  listIssues(projectId: string): Issue[] {
    return this.state.issues.filter((issue) => issue.projectId === projectId);
  }

  createIssue(issue: Issue): Issue {
    this.state.issues.push(issue);
    return this.commit(issue);
  }

  getIssue(issueId: string): Issue | undefined {
    return this.state.issues.find((issue) => issue.id === issueId);
  }

  findIssueByCheck(checkId: string): Issue | undefined {
    return this.state.issues.find((issue) => issue.checkId === checkId && issue.status !== "verified");
  }

  updateIssue(issueId: string, patch: Partial<Issue>): Issue | undefined {
    const issue = this.getIssue(issueId);
    if (!issue) {
      return undefined;
    }

    Object.assign(issue, patch);
    return this.commit(issue);
  }

  listRuns(projectId: string): VerificationRun[] {
    return this.state.runs.filter((run) => run.projectId === projectId);
  }

  createRun(run: VerificationRun): VerificationRun {
    this.state.runs.push(run);
    return this.commit(run);
  }

  getRun(runId: string): VerificationRun | undefined {
    return this.state.runs.find((run) => run.id === runId);
  }

  listResults(runId: string): RunResult[] {
    return this.state.results.filter((result) => result.runId === runId);
  }

  createResult(result: RunResult): RunResult {
    this.state.results.push(result);
    return this.commit(result);
  }

  createReport(report: LaunchReport): LaunchReport {
    this.state.reports.push(report);
    return this.commit(report);
  }

  clearReports(projectId: string): void {
    this.state.reports = this.state.reports.filter((report) => report.projectId !== projectId);
    this.commit(undefined);
  }

  getLatestReport(projectId: string): LaunchReport | undefined {
    return this.state.reports
      .filter((report) => report.projectId === projectId)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];
  }

  listLoop(projectId: string): LoopEntry[] {
    return this.state.loop
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  createLoopEntry(entry: LoopEntry): LoopEntry {
    this.state.loop.push(entry);
    return this.commit(entry);
  }

  getReadiness(projectId: string): ReadinessSummary {
    return calculateReadiness(this.listChecks(projectId), this.listIssues(projectId));
  }

  snapshot(): ShipShapeState {
    return JSON.parse(JSON.stringify(this.state)) as ShipShapeState;
  }

  private commit<T>(value: T): T {
    this.onChange?.(this.snapshot());
    return value;
  }
}
