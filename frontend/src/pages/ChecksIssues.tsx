import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
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
    const state = location.state as { actionError?: string } | null;
    if (state?.actionError) {
      setActionError(state.actionError);
    }
  }, [location.state]);

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
  const latestEvidence = latestRun?.source === "testsprite" ? latestRun.evidence : undefined;
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
            placeholder="Project ID"
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
        {latestEvidence && (
          <div className={`evidence-proof evidence-${latestEvidence.inferredChecks > 0 ? "inferred" : "direct"}`}>
            <div>
              <span>Evidence</span>
              <strong>{formatMappingMode(latestEvidence.mappingMode)}</strong>
            </div>
            <div>
              <span>Results</span>
              <strong>{latestEvidence.resultItems}</strong>
            </div>
            <div>
              <span>Matched</span>
              <strong>{latestEvidence.matchedChecks}</strong>
            </div>
            <div>
              <span>Inferred</span>
              <strong>{latestEvidence.inferredChecks}</strong>
            </div>
            <div>
              <span>Exit</span>
              <strong>{latestEvidence.exitCode ?? "?"}</strong>
            </div>
            {latestEvidence.reportUrl && (
              <a href={latestEvidence.reportUrl} rel="noreferrer" target="_blank">
                Evidence
              </a>
            )}
          </div>
        )}
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
  if (issue?.actual) {
    return issue.actual;
  }

  const causes: Record<string, string> = {
    mobile: "TestSprite found a small-screen usability failure. The likely issue is overflow, cramped tap targets, or content that is not adapting at mobile widths.",
    forms: "TestSprite could not complete the form path reliably. The likely issue is submit behavior, validation feedback, or a disabled/missing interactive control.",
    navigation: "TestSprite reached a UI control or route that did not produce the expected page/content transition.",
    ci_cd: "TestSprite could not find a current release-gate signal tied to the latest verification run.",
    accessibility: "TestSprite found an interaction that needs clearer labels, focus behavior, or keyboard-safe controls.",
    security: "TestSprite found a public path that may expose a protected state or sensitive action."
  };

  return causes[check.category] ?? `${check.title} failed in the latest TestSprite launch gate.`;
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
  const evidence = issue?.actual ?? failureCause(check, issue);
  const plans: Record<string, string[]> = {
    mobile: [
      "Open the deployed app at 390px and 768px widths and reproduce the failing screen.",
      "Fix horizontal overflow first, then check tap target spacing, sticky headers, and controls near the viewport edges.",
      "Use responsive CSS constraints such as max-width, wrapping, grid fallbacks, and stable button heights.",
      "Rerun the Mobile TestSprite check and confirm the failure changes to verified."
    ],
    forms: [
      "Open the exact form path on the deployed URL and test both mouse click and Enter-key submission.",
      "Ensure the submit action is a real button in the DOM with type=\"submit\" and visible enabled/disabled states.",
      "Show inline validation for missing or invalid fields and preserve user input after a failed submit.",
      "Rerun the Forms TestSprite check and confirm the form can be completed from a fresh session."
    ],
    navigation: [
      "Start from a fresh browser session and click the control or CTA TestSprite exercised.",
      "Replace visual-only pills/tabs with real links or button handlers that update route and content.",
      "Confirm the URL, heading, and primary content all change to the expected destination.",
      "Rerun the Navigation TestSprite check and verify it reaches the expected page."
    ],
    ci_cd: [
      "Confirm the release gate reads the latest TestSprite or CI run instead of a placeholder.",
      "Show no-run, running, failed, and passed states explicitly.",
      "Add the latest run timestamp/source beside the release decision.",
      "Rerun TestSprite and confirm the report references the current run."
    ],
    accessibility: [
      "Tab through the failing surface and confirm focus never disappears.",
      "Add accessible names to icon-only buttons and form controls.",
      "Check labels, roles, and visible focus states on the controls TestSprite used.",
      "Rerun the Accessibility check after the keyboard path is reliable."
    ]
  };

  return [`Evidence: ${evidence}`, ...(plans[check.category] ?? [fixSummary(check), `Rerun TestSprite and confirm ${check.title} passes.`])];
}

function formatMappingMode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
