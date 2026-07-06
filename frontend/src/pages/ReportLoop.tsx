import { useState } from "react";
import { Card, EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";

export function ReportLoop() {
  const { detail, report, loading, error, regenerateReport } = useProjectData();
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return <PageState title="Loading" />;
  }

  if (error || !detail || !report) {
    return <EmptyProjectState error={error} />;
  }

  const latestRun = detail.runs.slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const latestEvidence = latestRun?.source === "testsprite" ? latestRun.evidence : undefined;
  const orderedRuns = detail.runs.slice().sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  const firstFailingRun = orderedRuns.find((run) => run.status === "failed");
  const passingRuns = orderedRuns.filter((run) => run.status === "passed");
  const latestPassingRun = passingRuns[passingRuns.length - 1];
  const latestFix = detail.loop
    .filter((entry) => entry.kind === "fix")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const failedChecks = detail.checks.filter((check) => check.status === "failed");
  const openBlockers = failedChecks.filter((check) => check.severity === "blocker");
  const nextAction =
    report.verdict === "ready"
      ? "Ready to ship"
      : report.verdict === "blocked"
        ? `Fix ${openBlockers.length || failedChecks.length} failed check${(openBlockers.length || failedChecks.length) === 1 ? "" : "s"}`
        : "Run TestSprite to verify launch checks";

  async function handleRegenerateReport() {
    setRegenerating(true);
    setActionError(null);

    try {
      await regenerateReport();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to regenerate report");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="page-grid report-grid">
      <Card className={`verdict-card verdict-${report.verdict}`}>
        <span>Verdict</span>
        <strong>{formatValue(report.verdict)}</strong>
        <p>{report.summary}</p>
        <div className="report-facts">
          <div>
            <span>Blockers</span>
            <strong>{report.blockers}</strong>
          </div>
          <div>
            <span>Verified</span>
            <strong>
              {report.verifiedChecks}/{report.totalChecks}
            </strong>
          </div>
          <div>
            <span>TestSprite</span>
            <strong>{latestRun ? formatValue(latestRun.status) : "No Run"}</strong>
          </div>
        </div>
        <p className="next-action">{nextAction}</p>
        {actionError && <p className="form-error">{actionError}</p>}
        <button disabled={regenerating} onClick={() => void handleRegenerateReport()}>
          {regenerating ? "Regenerating..." : "Regenerate"}
        </button>
      </Card>
      <Card className="evidence-card">
        {latestEvidence && (
          <div className={`evidence-proof evidence-${latestEvidence.inferredChecks > 0 ? "inferred" : "direct"}`}>
            <div>
              <span>Proof</span>
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
            {latestEvidence.reportUrl && (
              <a href={latestEvidence.reportUrl} rel="noreferrer" target="_blank">
                Evidence
              </a>
            )}
          </div>
        )}
        <div className="evidence-step">
          <span>Before</span>
          <strong>{firstFailingRun ? "Blocked by TestSprite" : "No failing run"}</strong>
          <p>{firstFailingRun?.summary ?? "Run TestSprite to capture launch blockers."}</p>
        </div>
        <div className="evidence-step">
          <span>Fix</span>
          <strong>{latestFix ? latestFix.title : "No fix yet"}</strong>
          <p>{latestFix?.body ?? "Create a fix plan from a failed check, then rerun TestSprite."}</p>
        </div>
        <div className="evidence-step">
          <span>After</span>
          <strong>{latestPassingRun ? "Cleared by rerun" : "Awaiting rerun"}</strong>
          <p>{latestPassingRun?.summary ?? "Run TestSprite after fixes to clear the gate."}</p>
        </div>
      </Card>
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

function formatMappingMode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
