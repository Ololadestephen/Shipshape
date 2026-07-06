export type AppType = "saas" | "ecommerce" | "portfolio" | "internal_tool" | "marketplace" | "content" | "other";
export type ProjectStatus = "draft" | "testing" | "blocked" | "ready_with_warnings" | "ready";
export type FlowPriority = "critical" | "important" | "nice_to_have";
export type CheckCategory =
  | "navigation"
  | "auth"
  | "forms"
  | "onboarding"
  | "mobile"
  | "accessibility"
  | "content"
  | "seo"
  | "performance"
  | "error_states"
  | "security"
  | "ci_cd";
export type Severity = "blocker" | "warning" | "polish";
export type CheckStatus = "untested" | "failed" | "fixing" | "verified";
export type IssueStatus = "open" | "fixing" | "verified" | "wont_fix";
export type RunSource = "manual" | "testsprite" | "ci";
export type RunStatus = "passed" | "failed" | "partial";
export type ResultStatus = "passed" | "failed" | "skipped";
export type ReportVerdict = "ready" | "ready_with_warnings" | "in_progress" | "blocked";
export type LoopEntryKind = "failure" | "fix" | "verification" | "note";
export type TestSpriteMappingMode = "direct" | "direct_plus_inferred" | "inferred_overall_pass" | "single_failure_fallback" | "partial_skipped";

export interface Project {
  id: string;
  name: string;
  url: string;
  appType: AppType;
  status: ProjectStatus;
  testspriteProjectId?: string;
  testspriteProjectUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Flow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  priority: FlowPriority;
}

export interface Check {
  id: string;
  projectId: string;
  flowId?: string;
  category: CheckCategory;
  title: string;
  description: string;
  severity: Severity;
  status: CheckStatus;
  notes?: string;
}

export interface Issue {
  id: string;
  projectId: string;
  checkId?: string;
  title: string;
  severity: Severity;
  status: IssueStatus;
  reproSteps: string[];
  expected: string;
  actual: string;
  suggestedFix: string;
  evidenceUrl?: string;
}

export interface VerificationRun {
  id: string;
  projectId: string;
  source: RunSource;
  status: RunStatus;
  summary: string;
  evidence?: TestSpriteRunEvidence;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

export interface TestSpriteRunEvidence {
  command: string;
  exitCode: number | null;
  resultItems: number;
  matchedChecks: number;
  inferredChecks: number;
  unmatchedResults: number;
  mappingMode: TestSpriteMappingMode;
  payloadStatus?: string;
  reportUrl?: string;
}

export interface LaunchReport {
  id: string;
  projectId: string;
  verdict: ReportVerdict;
  readinessScore: number;
  summary: string;
  blockers: number;
  warnings: number;
  polish: number;
  verifiedChecks: number;
  totalChecks: number;
  generatedAt: string;
}

export interface LoopEntry {
  id: string;
  projectId: string;
  runId?: string;
  issueId?: string;
  kind: LoopEntryKind;
  title: string;
  body: string;
  evidenceUrl?: string;
  createdAt: string;
}

export interface ReadinessSummary {
  score: number;
  status: ProjectStatus;
  blockers: number;
  warnings: number;
  polish: number;
  verifiedChecks: number;
  failedChecks: number;
  totalChecks: number;
}

export interface ProjectListItem extends Project {
  readiness: ReadinessSummary;
}

export interface ProjectDetail {
  project: Project;
  flows: Flow[];
  checks: Check[];
  issues: Issue[];
  runs: VerificationRun[];
  latestReport?: LaunchReport;
  loop: LoopEntry[];
  readiness: ReadinessSummary;
}

export interface CreateProjectInput {
  name: string;
  url: string;
  appType: AppType;
  flows: string[];
}

export interface CreateRunInput {
  source: RunSource;
  status: RunStatus;
  summary: string;
  results?: Array<{
    checkId?: string;
    status: ResultStatus;
    message: string;
    evidenceUrl?: string;
  }>;
}

export interface CreateLoopEntryInput {
  kind: LoopEntryKind;
  title: string;
  body: string;
  runId?: string;
  issueId?: string;
  evidenceUrl?: string;
}

export interface TestSpriteSetup {
  apiKeyConfigured: boolean;
  cliBin: string;
  timeoutSeconds: number;
  projectId?: string;
  projectIdSource: "project" | "env" | "none";
  testIdConfigured: boolean;
  targetUrl: string;
  readyToRun: boolean;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  return apiGet<ProjectListItem[]>("/projects");
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  return apiGet<ProjectDetail>(`/projects/${projectId}`);
}

export async function getProjectReport(projectId: string): Promise<LaunchReport> {
  return apiGet<LaunchReport>(`/projects/${projectId}/report`);
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>("/projects", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateProject(
  projectId: string,
  input: Partial<Pick<Project, "name" | "url" | "appType" | "status" | "testspriteProjectId" | "testspriteProjectUrl">>
): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function updateCheck(checkId: string, input: Partial<Pick<Check, "status" | "notes" | "severity">>): Promise<Check> {
  return apiRequest<Check>(`/checks/${checkId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function updateIssue(issueId: string, input: Partial<Pick<Issue, "status" | "actual" | "suggestedFix" | "evidenceUrl">>): Promise<Issue> {
  return apiRequest<Issue>(`/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function createVerificationRun(projectId: string, input: CreateRunInput): Promise<{ run: VerificationRun }> {
  return apiRequest<{ run: VerificationRun }>(`/projects/${projectId}/runs`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function runTestSprite(projectId: string): Promise<{ run: VerificationRun }> {
  return apiRequest<{ run: VerificationRun }>(`/projects/${projectId}/testsprite/run`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function getTestSpriteSetup(projectId: string): Promise<TestSpriteSetup> {
  return apiGet<TestSpriteSetup>(`/projects/${projectId}/testsprite/setup`);
}

export async function createTestSpriteProject(projectId: string, targetUrl?: string): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/${projectId}/testsprite/project`, {
    method: "POST",
    body: JSON.stringify(targetUrl ? { targetUrl } : {})
  });
}

export async function createLoopEntry(projectId: string, input: CreateLoopEntryInput): Promise<LoopEntry> {
  return apiRequest<LoopEntry>(`/projects/${projectId}/loop`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function generateProjectReport(projectId: string): Promise<LaunchReport> {
  return apiRequest<LaunchReport>(`/projects/${projectId}/report/generate`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    ...init
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "ShipShape API request failed");
  }

  return payload.data as T;
}

function apiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/api${path}` : `/api${path}`;
}
