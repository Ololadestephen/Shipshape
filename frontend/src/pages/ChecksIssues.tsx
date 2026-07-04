import { useEffect, useState } from "react";
import {
  createTestSpriteProject,
  getTestSpriteSetup,
  runTestSprite,
  updateCheck,
  updateProject,
  type Check,
  type CheckStatus,
  type Issue,
  type TestSpriteSetup
} from "../api";
import { Badge, Card, EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";

export function ChecksIssues() {
  const { detail, loading, error, refresh } = useProjectData();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningTestSprite, setRunningTestSprite] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [testSpriteSetup, setTestSpriteSetup] = useState<TestSpriteSetup | null>(null);
  const [testSpriteProjectId, setTestSpriteProjectId] = useState("");
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null);
  const [fixPlanVisible, setFixPlanVisible] = useState(false);

  useEffect(() => {
    if (!detail) {
      setTestSpriteSetup(null);
      setTestSpriteProjectId("");
      return;
    }

    setTestSpriteProjectId(detail.project.testspriteProjectId ?? "");
    getTestSpriteSetup(detail.project.id)
      .then(setTestSpriteSetup)
      .catch(() => setTestSpriteSetup(null));
  }, [detail?.project.id, detail?.project.testspriteProjectId]);

  if (loading) {
    return <PageState title="Loading" />;
  }

  if (error || !detail) {
    return <EmptyProjectState error={error} />;
  }

  const currentDetail = detail;
  const latestRun = currentDetail.runs.slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const passedChecks = currentDetail.checks.filter((check) => check.status === "verified").length;
  const failedChecks = currentDetail.checks.filter((check) => check.status === "failed").length;
  const issueByCheckId = new Map(currentDetail.issues.filter((issue) => issue.checkId).map((issue) => [issue.checkId, issue]));
  const failedCheckList = currentDetail.checks.filter((check) => check.status === "failed");
  const selectedFailure = failedCheckList.find((check) => check.id === selectedFailureId) ?? failedCheckList[0] ?? null;
  const selectedIssue = selectedFailure ? issueByCheckId.get(selectedFailure.id) : undefined;
  const latestImpact =
    failedChecks > 0
      ? `${failedChecks} failed`
      : passedChecks === currentDetail.checks.length && currentDetail.checks.length > 0
        ? "Ready impact"
        : "Awaiting results";

  async function handleCheckStatus(checkId: string, status: CheckStatus) {
    setBusyId(checkId);
    setActionError(null);

    try {
      await updateCheck(checkId, { status });
      if (status === "failed") {
        setSelectedFailureId(checkId);
      }
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to update check");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTestSpriteRun() {
    if (currentDetail.checks.length === 0) {
      return;
    }

    setRunningTestSprite(true);
    setActionError(null);
    setFixPlanVisible(false);

    try {
      await runTestSprite(currentDetail.project.id);
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to run TestSprite");
    } finally {
      setRunningTestSprite(false);
    }
  }

  async function handleSaveTestSpriteProjectId() {
    setSavingSetup(true);
    setActionError(null);

    try {
      await updateProject(currentDetail.project.id, {
        testspriteProjectId: testSpriteProjectId.trim()
      });
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to save TestSprite project id");
    } finally {
      setSavingSetup(false);
    }
  }

  async function handleCreateTestSpriteProject() {
    setCreatingProject(true);
    setActionError(null);

    try {
      const nextDetail = await createTestSpriteProject(currentDetail.project.id, currentDetail.project.url);
      setTestSpriteProjectId(nextDetail.project.testspriteProjectId ?? "");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to create TestSprite project");
    } finally {
      setCreatingProject(false);
    }
  }

  return (
    <div className="page-grid checks-grid">
      <Card className="issue-table-card">
        <div className="testsprite-setup">
          <div>
            <span>TestSprite</span>
            <strong>{testSpriteSetup?.readyToRun ? "Connected" : "Not connected"}</strong>
          </div>
          <input
            aria-label="TestSprite project id"
            placeholder="p_..."
            value={testSpriteProjectId}
            onChange={(event) => setTestSpriteProjectId(event.target.value)}
          />
          <button disabled={savingSetup} onClick={() => void handleSaveTestSpriteProjectId()}>
            {savingSetup ? "Saving..." : "Save ID"}
          </button>
          <button disabled={creatingProject || !testSpriteSetup?.apiKeyConfigured} onClick={() => void handleCreateTestSpriteProject()}>
            {creatingProject ? "Creating..." : "Create Project"}
          </button>
        </div>
        <div className="table-toolbar">
          <div className="run-strip">
            <span>{latestRun ? formatValue(latestRun.source) : "TestSprite"}</span>
            <strong>{latestRun ? formatValue(latestRun.status) : "No run"}</strong>
            <small>
              {passedChecks}/{currentDetail.checks.length} verified · {latestImpact}
            </small>
          </div>
          <div>
            <button disabled={runningTestSprite || currentDetail.checks.length === 0 || testSpriteSetup?.readyToRun === false} onClick={() => void handleTestSpriteRun()}>
              {runningTestSprite ? "Running..." : "Run TestSprite"}
            </button>
          </div>
        </div>
        {actionError && <p className="form-error">{actionError}</p>}
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentDetail.checks.length === 0 && (
              <tr>
                <td colSpan={4}>No checks yet.</td>
              </tr>
            )}
            {currentDetail.checks.map((check) => (
              <tr
                className={`${check.status === "failed" ? "failed-row" : ""} ${selectedFailure?.id === check.id ? "selected-row" : ""}`}
                key={check.id}
                onClick={() => {
                  if (check.status === "failed") {
                    setSelectedFailureId(check.id);
                    setFixPlanVisible(false);
                  }
                }}
              >
                <td>{check.title}</td>
                <td>
                  <Badge value={formatValue(check.severity)} />
                </td>
                <td>
                  <Badge value={formatValue(check.status)} />
                </td>
                <td>
                  <select
                    className="table-select"
                    disabled={busyId === check.id}
                    value={check.status}
                    onChange={(event) => void handleCheckStatus(check.id, event.target.value as CheckStatus)}
                  >
                    <option value="untested">Untested</option>
                    <option value="failed">Failed</option>
                    <option value="fixing">Fixing</option>
                    <option value="verified">Verified</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {selectedFailure && (
        <Card className="failure-card">
          <div className="failure-head">
            <span>Failure</span>
            <strong>{selectedFailure.title}</strong>
          </div>
          <div className="failure-section">
            <span>Cause</span>
            <p>{failureCause(selectedFailure, selectedIssue)}</p>
          </div>
          <div className="failure-section">
            <span>Fix</span>
            <p>{selectedIssue?.suggestedFix ?? fixSummary(selectedFailure)}</p>
          </div>
          <div className="failure-section">
            <span>Verify</span>
            <p>Run TestSprite again and confirm {selectedFailure.title} passes.</p>
          </div>
          <button className="secondary-action" onClick={() => setFixPlanVisible((current) => !current)}>
            Create Fix Plan
          </button>
          {fixPlanVisible && (
            <ol className="fix-plan">
              {fixPlan(selectedFailure, selectedIssue).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}
        </Card>
      )}
    </div>
  );
}

function PageState({ title }: { title: string }) {
  return (
    <div className="page-grid">
      <PageIntro title={title} />
    </div>
  );
}

function failureCause(check: Check, issue?: Issue) {
  return issue?.actual ?? `${check.title} did not pass the latest TestSprite launch gate.`;
}

function fixSummary(check: Check) {
  const summaries: Record<string, string> = {
    mobile: "Fix responsive spacing, tap targets, and overflow for narrow viewports.",
    accessibility: "Add accessible names, focus states, and keyboard-safe controls.",
    forms: "Tighten validation, empty states, and success/error feedback.",
    auth: "Check auth redirects, failed login states, and post-login landing behavior.",
    navigation: "Fix broken routes, missing links, or blocked primary paths.",
    ci_cd: "Connect the latest verification status to the release gate.",
    security: "Protect sensitive routes and actions from unauthenticated access."
  };

  return summaries[check.category] ?? `Patch the ${check.title} path and rerun verification.`;
}

function fixPlan(check: Check, issue?: Issue) {
  return [
    `Inspect the ${formatValue(check.category)} surface tied to ${check.title}.`,
    issue?.actual ?? `${check.title} failed in the latest TestSprite run.`,
    fixSummary(check),
    `Run TestSprite again and confirm ${check.title} passes.`
  ];
}
