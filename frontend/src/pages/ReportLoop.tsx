import { useMemo, useState } from "react";
import { EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";
import type { Check, LoopEntry, ProjectDetail, VerificationRun } from "../api";

export function ReportLoop({ publicView = false }: { publicView?: boolean }) {
  const { detail, report, loading, error, regenerateReport } = useProjectData();
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (!detail) {
      return "";
    }

    return `${window.location.origin}/share/${encodeURIComponent(detail.project.id)}`;
  }, [detail]);

  if (loading) {
    return <PageState title="Loading" />;
  }

  if (error || !detail || !report) {
    return <EmptyProjectState error={error} />;
  }

  const currentDetail = detail;
  const latestRun = latestByTime(currentDetail.runs);
  const latestEvidence = latestRun?.source === "testsprite" ? latestRun.evidence : undefined;
  const failedChecks = currentDetail.checks.filter((check) => check.status === "failed");
  const verifiedChecks = currentDetail.checks.filter((check) => check.status === "verified");
  const remainingChecks = currentDetail.checks.filter((check) => check.status === "untested" || check.status === "fixing");
  const markdown = buildMarkdownReport(currentDetail, report.summary, report.verdict, latestRun);
  const decision = decisionText(report.verdict, failedChecks.length);

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

  function exportReport() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentDetail.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shipshape"}-launch-report.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`report-document-page ${publicView ? "public-report-page" : ""}`}>
      <PageIntro title={publicView ? "Shared launch report" : "Launch report"} />
      <article className="report-document">
        <header className={`report-cover verdict-${report.verdict}`}>
          <div>
            <span>ShipShape launch decision</span>
            <h1>{formatValue(report.verdict)}</h1>
            <p>{decision}</p>
          </div>
          <div className="report-actions">
            <button className="report-action-primary" type="button" onClick={() => void copyValue(shareUrl, "share link")}>
              {copied === "share link" ? "Copied" : "Share Link"}
            </button>
            <button className="report-action-secondary" type="button" onClick={() => void copyValue(markdown, "markdown")}>
              {copied === "markdown" ? "Copied" : "Copy Report"}
            </button>
            <button className="report-action-secondary" type="button" onClick={exportReport}>
              Export Report
            </button>
          </div>
        </header>

        {actionError && <p className="form-error">{actionError}</p>}

        <section className="report-summary-grid">
          <ReportMetric label="Project" value={currentDetail.project.name} />
          <ReportMetric label="Target" value={hostname(currentDetail.project.url)} />
          <ReportMetric label="Verified" value={`${report.verifiedChecks}/${report.totalChecks}`} />
          <ReportMetric label="Failures" value={String(failedChecks.length)} />
        </section>

        <section className="report-section">
          <h2>Executive Summary</h2>
          <p>{report.summary}</p>
          <p>
            Latest TestSprite run: <strong>{latestRun ? formatValue(latestRun.status) : "No run"}</strong>
            {latestRun ? `, ${latestRun.summary}` : "."}
          </p>
          {!publicView && (
            <button className="report-regenerate" disabled={regenerating} onClick={() => void handleRegenerateReport()}>
              {regenerating ? "Regenerating..." : "Regenerate Report"}
            </button>
          )}
        </section>

        <section className="report-section">
          <h2>Evidence Quality</h2>
          {latestEvidence ? (
            <div className="evidence-table">
              <ReportMetric label="Proof" value={formatMappingMode(latestEvidence.mappingMode)} />
              <ReportMetric label="Results" value={String(latestEvidence.resultItems)} />
              <ReportMetric label="Matched" value={String(latestEvidence.matchedChecks)} />
              <ReportMetric label="Inferred" value={String(latestEvidence.inferredChecks)} />
              <ReportMetric label="Exit" value={String(latestEvidence.exitCode ?? "?")} />
            </div>
          ) : (
            <p className="empty-state">Run TestSprite to attach evidence.</p>
          )}
        </section>

        <section className="report-section">
          <h2>Findings</h2>
          {failedChecks.length > 0 ? (
            <div className="finding-list">
              {failedChecks.map((check) => (
                <Finding key={check.id} check={check} />
              ))}
            </div>
          ) : (
            <p>No blocking findings remain.</p>
          )}
        </section>

        <section className="report-section">
          <h2>Remediation Plan</h2>
          {failedChecks.length > 0 ? (
            <ol className="remediation-list">
              {failedChecks.flatMap((check) => remediationSteps(check)).map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          ) : (
            <p>Keep the TestSprite gate connected and rerun after material UI or routing changes.</p>
          )}
        </section>

        <section className="report-section two-column-report">
          <div>
            <h2>Verified Scope</h2>
            <CheckList checks={verifiedChecks} empty="No checks verified yet." />
          </div>
          <div>
            <h2>Open Scope</h2>
            <CheckList checks={remainingChecks} empty="All generated checks have a final status." />
          </div>
        </section>

        <section className="report-section">
          <h2>Verification Log</h2>
          {currentDetail.loop.length > 0 ? (
            <div className="loop-list report-loop-list">
              {currentDetail.loop.slice(-6).map((entry) => (
                <LoopItem key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No loop entries yet.</p>
          )}
        </section>
      </article>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Finding({ check }: { check: Check }) {
  return (
    <div className={`finding-item status-${check.status}`}>
      <div>
        <span>{formatValue(check.severity)}</span>
        <h3>{check.title}</h3>
      </div>
      <p>{findingDescription(check)}</p>
    </div>
  );
}

function CheckList({ checks, empty }: { checks: Check[]; empty: string }) {
  if (checks.length === 0) {
    return <p className="empty-state">{empty}</p>;
  }

  return (
    <div className="mini-check-list">
      {checks.map((check) => (
        <div key={check.id}>
          <strong>{check.title}</strong>
          <span>{formatValue(check.status)}</span>
        </div>
      ))}
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

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function decisionText(verdict: string, failedCount: number) {
  if (verdict === "ready") {
    return "The audited launch path is ready based on the latest TestSprite evidence.";
  }

  if (verdict === "blocked") {
    return `Do not ship yet. ${failedCount} failed check${failedCount === 1 ? "" : "s"} must be resolved and rerun.`;
  }

  return "The launch is still under verification. Complete the open checks before treating this as ready.";
}

function findingDescription(check: Check) {
  const descriptions: Record<string, string> = {
    mobile: "The mobile viewport still needs responsive layout work before this launch path is safe on small screens.",
    forms: "A form path needs a reliable submit, validation, or feedback behavior before users can complete it confidently.",
    navigation: "A user path is reachable in the UI but does not yet lead to the expected route or content.",
    ci_cd: "The release gate needs a current verification signal so launch status is backed by fresh evidence.",
    security: "A protected action or route needs stronger unauthenticated-state handling.",
    accessibility: "Interactive controls need clearer names, keyboard behavior, or focus feedback."
  };

  return descriptions[check.category] ?? check.description;
}

function remediationSteps(check: Check) {
  const title = check.title;
  const steps: Record<string, string[]> = {
    mobile: [
      `Reproduce ${title} at 390px and 768px widths on the deployed URL.`,
      "Fix overflow, tap target spacing, and any content that leaves the viewport.",
      "Rerun TestSprite and confirm the mobile check returns verified evidence."
    ],
    forms: [
      `Open the form path tied to ${title} and submit it by click and Enter key.`,
      "Ensure required fields, disabled states, and validation feedback are visible in the DOM.",
      "Rerun the matching TestSprite form check against the deployed URL."
    ],
    navigation: [
      `Click through the route or CTA behind ${title} from a fresh browser session.`,
      "Replace visual-only controls with links or button handlers that change route/content.",
      "Rerun the TestSprite navigation check and confirm the expected URL/content appears."
    ],
    ci_cd: [
      "Expose the latest TestSprite or CI result in the release gate.",
      "Avoid placeholder pass/fail states when no recent run exists.",
      "Rerun the TestSprite gate and verify the report references the latest run."
    ]
  };

  return steps[check.category] ?? [`Fix the ${title} failure using the latest TestSprite evidence.`, "Rerun TestSprite and confirm the check is verified."];
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
    ...(failed.length ? failed.map((check) => `- ${check.title}: ${findingDescription(check)}`) : ["- None"]),
    "",
    "## Remediation",
    ...(failed.length ? failed.flatMap((check) => remediationSteps(check).map((step) => `- ${step}`)) : ["- Keep TestSprite connected and rerun after material changes."]),
    "",
    "## Verified Checks",
    ...(verified.length ? verified.map((check) => `- ${check.title}`) : ["- None"])
  ];

  return lines.join("\n");
}
