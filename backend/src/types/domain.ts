export type AppType =
  | "saas"
  | "ecommerce"
  | "portfolio"
  | "internal_tool"
  | "marketplace"
  | "content"
  | "other";

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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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

export interface RunResult {
  id: string;
  runId: string;
  projectId: string;
  checkId?: string;
  status: ResultStatus;
  message: string;
  evidenceUrl?: string;
  createdAt: string;
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
