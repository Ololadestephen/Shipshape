import { useMemo, useState } from "react";
import { Card, EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";
import type { Check, LoopEntry, ProjectDetail, VerificationRun } from "../api";

export function ReportLoop() {
  const { detail, report, loading, error, regenerateReport } = useProjectData();
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (!detail) {
      return "";
    }

    return `${window.location.origin}/report?project=${detail.project.id}`;
  }, [detail]);

  if (loading) {
    return <PageState title="Loading" />;
  }

  if (error || !detail || !report) {
    return <EmptyProjectState error={error} />;
  }

  const latestRun = latestByTime(detail.runs);
  const latestEvidence = latestRun?.source === "testsprite" ? latestRun.evidence : undefined;
  const failedChecks = detail.checks.filter((check) => check.status === "failed");
  const verifiedChecks = detail.checks.filter((check) => check.status === "verified");
  const untestedChecks = detail.checks.filter((check) => check.status === "untested" || check.status === "fixing");
  const openBlockers = failedChecks.filter((check) => check.severity === "blocker");
  const nextAction =
    report.verdict === "ready"
      ? "Ready to ship"
      : report.verdict === "blocked"
        ? `Fix ${openBlockers.length || failedChecks.length} failed check${(openBlockers.length || failedChecks.length) === 1 ? "" : "s"}`
        : "Run TestSprite to verify launch checks";
  const markdown = buildMarkdownReport(detail, report.summary, report.verdict, latestRun);

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

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setActionError(`Unable to copy ${label}`);
    }
  }

  return (
    <div className="page-grid report-grid detailed-report-grid">
      <Card className={`verdict-card verdict-${report.verdict}`}>
        <div className="report-header">
          <div>
            <span>Verdict</span>
            <strong>{formatValue(report.verdict)}</strong>
          </div>
          <div className="report-actions">
            <button type="button" onClick={() => void copyValue(shareUrl, "share link")}>
              {copied === "share link" ? "Copied" : "Share Link"}
            </button>
            <button type="button" onClick={() => void copyValue(markdown, "markdown")}>
              {copied === "markdown" ? "Copied" : "Copy Report"}
            </button>
          </div>
        </div>
        <p>{report.summary}</p>
        <div className="report-facts">
          <div>
            <span>Project</span>
            <strong>{detail.project.name}</strong>
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
          <div>
            <span>Failures</span>
            <strong>{failedChecks.length}</strong>
          </div>
        </div>
        <p className="next-action">{nextAction}</p>
        {actionError && <p className="form-error">{actionError}</p>}
        <button disabled={regenerating} onClick={() => void handleRegenerateReport()}>
          {regenerating ? "Regenerating..." : "Regenerate"}
        </button>
      </Card>

      <Card className="evidence-card" title="TestSprite Evidence">
        {latestEvidence ? (
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
        ) : (
          <p className="empty-state">Run TestSprite to attach evidence.</p>
        )}
        <div className="evidence-step">
          <span>Latest run</span>
          <strong>{latestRun ? formatValue(latestRun.status) : "No run"}</strong>
          <p>{latestRun?.summary ?? "No TestSprite run has been recorded for this audit."}</p>
        </div>
      </Card>

      <Card className="report-section-card" title="Failed Checks">
        {failedChecks.length > 0 ? (
          <div className="report-check-list">
            {failedChecks.map((check) => (
              <ReportCheck key={check.id} check={check} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No failed checks remain.</p>
        )}
      </Card>

      <Card className="report-section-card" title="Verified Checks">
        {verifiedChecks.length > 0 ? (
          <div className="report-check-list compact">
            {verifiedChecks.map((check) => (
              <ReportCheck key={check.id} check={check} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No checks verified yet.</p>
        )}
      </Card>

      <Card className="report-section-card" title="Remaining Scope">
        {untestedChecks.length > 0 ? (
          <div className="report-check-list compact">
            {untestedChecks.map((check) => (
              <ReportCheck key={check.id} check={check} />
            ))}
          </div>
        ) : (
          <p className="empty-state">All generated checks have a final status.</p>
        )}
      </Card>

      <Card className="report-section-card" title="Verification Loop">
        {detail.loop.length > 0 ? (
          <div className="loop-list">
            {detail.loop.slice(-6).map((entry) => (
              <LoopItem key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No loop entries yet.</p>
        )}
      </Card>
    </div>
  );
}

function ReportCheck({ check }: { check: Check }) {
  return (
    <div className={`report-check-item status-${check.status}`}>
      <div>
        <strong>{check.title}</strong>
        <span>{formatValue(check.category)}</span>
      </div>
      <small>{formatValue(check.severity)}</small>
      <em>{formatValue(check.status)}</em>
    </div>
  );
}

function LoopItem({ entry }: { entry: LoopEntry }) {
  return (
    <div className="loop-item">
      <span>{formatValue(entry.kind)}</span>
      <strong>{entry.title}</strong>
      <p>{entry.body}</p>
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

function latestByTime(runs: VerificationRun[]) {
  return runs.slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
}

function formatMappingMode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildMarkdownReport(detail: ProjectDetail, summary: string, verdict: string, latestRun?: VerificationRun) {
  const failed = detail.checks.filter((check) => check.status === "failed");
  const verified = detail.checks.filter((check) => check.status === "verified");
  const evidence = latestRun?.evidence;
  const lines = [
    `# ShipShape Launch Report: ${detail.project.name}`,
    "",
    `Verdict: ${formatValue(verdict)}`,
    `Target: ${detail.project.url}`,
    `Summary: ${summary}`,
    "",
    "## TestSprite Evidence",
    latestRun ? `Latest run: ${formatValue(latestRun.status)} - ${latestRun.summary}` : "Latest run: none",
    evidence
      ? `Proof: ${formatMappingMode(evidence.mappingMode)}; results ${evidence.resultItems}; matched ${evidence.matchedChecks}; inferred ${evidence.inferredChecks}; exit ${evidence.exitCode ?? "unknown"}`
      : "Proof: no TestSprite evidence attached",
    "",
    "## Failed Checks",
    ...(failed.length ? failed.map((check) => `- ${check.title} (${formatValue(check.severity)})`) : ["- None"]),
    "",
    "## Verified Checks",
    ...(verified.length ? verified.map((check) => `- ${check.title}`) : ["- None"])
  ];

  return lines.join("\n");
}
