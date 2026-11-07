import { useEffect, useMemo, useState } from "react";
import {
  fetchPublishableSnapshot,
  recordPublication,
  verifyReportFile,
  type Check,
  type LoopEntry,
  type ProjectDetail,
  type PublicationRecord,
  type VerificationRun,
  type VerifyReportResponse
} from "../api";
import {
  BOT_CHAIN_ID,
  BOT_EXPLORER_URL,
  formatAddress,
  formatTxHash,
  isEthereumAvailable,
  publishReportToChain,
  requestWalletConnection,
  switchToBotChain
} from "../botchain";
import { EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";

export function ReportLoop({ publicView = false }: { publicView?: boolean }) {
  const { detail, report, loading, error, refresh, regenerateReport } = useProjectData();
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Wallet and publication state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Verification state
  const [verificationInput, setVerificationInput] = useState("");
  const [verifyingFile, setVerifyingFile] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyReportResponse | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Sync wallet provider accounts and chain changes
  useEffect(() => {
    if (!isEthereumAvailable()) return;
    const provider = (window as unknown as { ethereum: any }).ethereum;

    const handleAccounts = (accounts: string[]) => {
      setWalletAddress(accounts[0] || null);
    };
    const handleChain = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
    };

    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);

    // Initial check if already connected
    provider
      .request?.({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts?.[0]) {
          setWalletAddress(accounts[0]);
          provider
            .request?.({ method: "eth_chainId" })
            .then((idHex: string) => setChainId(parseInt(idHex, 16)))
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, []);

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
  const remainingChecks = currentDetail.checks.filter(
    (check) => check.status === "untested" || check.status === "fixing"
  );
  const markdown = buildMarkdownReport(currentDetail, report.summary, report.verdict, latestRun);
  const decision = decisionText(report.verdict, failedChecks.length);

  const isBotChain = chainId === BOT_CHAIN_ID;
  const latestPublication: PublicationRecord | undefined = currentDetail.latestPublication;

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
    link.download = `${currentDetail.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shipbot"}-launch-report.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSnapshotJson() {
    setActionError(null);
    try {
      const snapshotData = await fetchPublishableSnapshot(currentDetail.project.id);
      const blob = new Blob([JSON.stringify(snapshotData.snapshot, null, 2)], {
        type: "application/json;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentDetail.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shipbot"}-snapshot-v${snapshotData.nextVersion}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to export snapshot JSON");
    }
  }

  async function handleConnectWallet() {
    setActionError(null);
    setConnectingWallet(true);
    try {
      const res = await requestWalletConnection();
      setWalletAddress(res.address);
      setChainId(res.chainId);
    } catch (caught: any) {
      setActionError(caught?.message ?? "Unable to connect wallet");
    } finally {
      setConnectingWallet(false);
    }
  }

  async function handleSwitchChain() {
    setActionError(null);
    try {
      await switchToBotChain();
      setChainId(BOT_CHAIN_ID);
    } catch (caught: any) {
      setActionError(caught?.message ?? "Unable to switch network to BOT Chain");
    }
  }

  async function handlePublishToChain() {
    if (!walletAddress) {
      await handleConnectWallet();
      return;
    }

    if (!isBotChain) {
      await handleSwitchChain();
      return;
    }

    setActionError(null);
    setPublishSuccess(null);
    setPublishing(true);
    setPublishStatus("Generating canonical report snapshot...");

    try {
      const snapshotData = await fetchPublishableSnapshot(currentDetail.project.id);
      setPublishStatus("Confirm transaction in your wallet...");

      const predHash = (snapshotData.predecessorDigest ??
        ("0x" + "0".repeat(64))) as `0x${string}`;

      const pubResult = await publishReportToChain({
        reportHash: snapshotData.digest as `0x${string}`,
        predecessorHash: predHash,
        version: snapshotData.nextVersion,
        reportReference: currentDetail.project.id
      });

      setPublishStatus("Recording receipt in registry...");
      await recordPublication(currentDetail.project.id, {
        transactionHash: pubResult.transactionHash,
        publisher: pubResult.publisher,
        contractAddress: pubResult.contractAddress,
        chainId: BOT_CHAIN_ID,
        blockNumber: pubResult.blockNumber,
        reportHash: snapshotData.digest,
        predecessorHash: snapshotData.predecessorDigest,
        version: snapshotData.nextVersion,
        reportReference: currentDetail.project.id,
        snapshot: snapshotData.snapshot
      });

      setPublishSuccess(`Report v${snapshotData.nextVersion} confirmed on BOT Chain!`);
      await refresh();
    } catch (caught: any) {
      setActionError(caught?.message ?? "Failed to publish report to BOT Chain");
    } finally {
      setPublishing(false);
      setPublishStatus(null);
    }
  }

  async function handleVerifyReport(textToVerify?: string) {
    const text = textToVerify ?? verificationInput;
    if (!text.trim()) {
      setVerificationError("Please select a file or paste a report snapshot to verify.");
      return;
    }

    setVerifyingFile(true);
    setVerificationError(null);
    setVerificationResult(null);

    try {
      const result = await verifyReportFile(text, latestPublication?.reportHash);
      setVerificationResult(result);
    } catch (caught: any) {
      setVerificationError(caught?.message ?? "Failed to verify report payload");
    } finally {
      setVerifyingFile(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setVerificationInput(content);
      void handleVerifyReport(content);
    };
    reader.readAsText(file);
  }

  return (
    <div className={`report-document-page ${publicView ? "public-report-page" : ""}`}>
      <PageIntro title={publicView ? "Shared launch report" : "Launch report"} />
      <article className="report-document">
        <header className={`report-cover verdict-${report.verdict}`}>
          <div>
            <span>ShipBot launch decision</span>
            <h1>{formatValue(report.verdict)}</h1>
            <p>{decision}</p>
          </div>
          <div className="report-actions">
            <button
              className="report-action-primary"
              type="button"
              onClick={() => void copyValue(shareUrl, "share link")}
            >
              {copied === "share link" ? "Copied" : "Share Link"}
            </button>
            <button
              className="report-action-secondary"
              type="button"
              onClick={() => void copyValue(markdown, "markdown")}
            >
              {copied === "markdown" ? "Copied" : "Copy Report"}
            </button>
            <button className="report-action-secondary" type="button" onClick={exportReport}>
              Export Report
            </button>
            <button className="report-action-secondary" type="button" onClick={() => void exportSnapshotJson()}>
              Export JSON
            </button>
          </div>
        </header>

        {actionError && <p className="form-error">{actionError}</p>}
        {publishSuccess && <p className="form-success" style={{ padding: "12px 28px", color: "#1e6335", fontWeight: 600 }}>{publishSuccess}</p>}

        {/* Wallet & BOT Chain publication toolbar (workspace view) */}
        {!publicView && (
          <div className="wallet-toolbar" style={{ margin: "16px 28px 0" }}>
            {walletAddress ? (
              <>
                <span className="wallet-badge">
                  ● Wallet: {formatAddress(walletAddress)}
                </span>
                {isBotChain ? (
                  <span className="wallet-badge" style={{ background: "#e8f7ee", color: "#25663c" }}>
                    ✓ BOT Chain Mainnet (Chain ID 677)
                  </span>
                ) : (
                  <button
                    className="report-action-secondary"
                    type="button"
                    onClick={() => void handleSwitchChain()}
                    style={{ minHeight: "32px", fontSize: "12px", padding: "0 12px", color: "var(--critical)", borderColor: "var(--critical)" }}
                  >
                    ⚠ Wrong Network: Switch to BOT Chain Mainnet (677)
                  </button>
                )}
                <button
                  className="report-action-primary"
                  type="button"
                  disabled={publishing || !isBotChain}
                  onClick={() => void handlePublishToChain()}
                  style={{ minHeight: "34px", fontSize: "13px", padding: "0 16px" }}
                >
                  {publishing ? publishStatus ?? "Publishing..." : latestPublication ? "Publish New Version" : "Publish to BOT Chain Mainnet"}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                  Connect your wallet to publish this release snapshot to BOT Chain Mainnet (Chain ID 677).
                </span>
                <button
                  className="report-action-primary"
                  type="button"
                  disabled={connectingWallet}
                  onClick={() => void handleConnectWallet()}
                  style={{ minHeight: "34px", fontSize: "13px", padding: "0 16px" }}
                >
                  {connectingWallet ? "Connecting..." : isEthereumAvailable() ? "Connect Wallet" : "Web3 Wallet"}
                </button>
              </>
            )}
          </div>
        )}

        <section className="report-summary-grid">
          <ReportMetric label="Project" value={currentDetail.project.name} />
          <ReportMetric label="Target" value={hostname(currentDetail.project.url)} />
          <ReportMetric label="Verified" value={`${report.verifiedChecks}/${report.totalChecks}`} />
          <ReportMetric label="Failures" value={String(failedChecks.length)} />
        </section>

        {/* Blockchain Publication Receipt */}
        {latestPublication && (
          <section className="report-section">
            <h2>BOT Chain Publication Receipt</h2>
            <div className="receipt-card">
              <div className="receipt-header">
                <h3>
                  <span>✓</span> Version {latestPublication.version} On-Chain Record
                </h3>
                <span className="wallet-badge" style={{ background: "#edf8f0", color: "#1e6335" }}>
                  Confirmed
                </span>
              </div>
              <div className="receipt-grid">
                <div className="receipt-field">
                  <span>Publisher</span>
                  <strong>{latestPublication.publisher}</strong>
                </div>
                <div className="receipt-field">
                  <span>Report Fingerprint</span>
                  <strong>{latestPublication.reportHash}</strong>
                </div>
                <div className="receipt-field">
                  <span>Transaction Hash</span>
                  <a
                    href={`${BOT_EXPLORER_URL}/tx/${latestPublication.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {formatTxHash(latestPublication.transactionHash)} ↗
                  </a>
                </div>
                <div className="receipt-field">
                  <span>Publication Time</span>
                  <strong>{new Date(latestPublication.publishedAt).toLocaleString()}</strong>
                </div>
                {latestPublication.predecessorHash && (
                  <div className="receipt-field">
                    <span>Predecessor Fingerprint</span>
                    <strong>{latestPublication.predecessorHash}</strong>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Public Report Integrity Verification Tool */}
        <section className="report-section">
          <h2>Verify Report Integrity</h2>
          <p>
            Verify any exported report or snapshot file against recorded BOT Chain fingerprints.
            Tampered or modified files will fail verification immediately.
          </p>

          <div className="verify-card">
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <label className="report-action-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "0 14px", minHeight: "36px", fontSize: "13px" }}>
                <span>📁 Upload Export File</span>
                <input
                  type="file"
                  accept=".json,.md,.txt"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
              <button
                className="report-action-primary"
                type="button"
                disabled={verifyingFile}
                onClick={() => void handleVerifyReport()}
                style={{ minHeight: "36px", fontSize: "13px", padding: "0 16px" }}
              >
                {verifyingFile ? "Verifying..." : "Verify Fingerprint"}
              </button>
            </div>

            <div className="verify-input-group">
              <textarea
                className="verify-textarea"
                placeholder="Or paste exported snapshot JSON / report content here to check..."
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
              />
            </div>

            {verificationError && <p className="form-error">{verificationError}</p>}

            {verificationResult && (
              <div
                className={`verify-verdict-box ${
                  verificationResult.matchesExpected ? "match" : "mismatch"
                }`}
              >
                {verificationResult.matchesExpected ? (
                  <div>
                    <strong>✓ Verified Authentic</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                      Computed fingerprint <code>{verificationResult.computedHash}</code> matches the
                      recorded publication. No alterations detected.
                    </p>
                  </div>
                ) : (
                  <div>
                    <strong>✗ Integrity Alert: Fingerprint Mismatch</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                      Computed fingerprint <code>{verificationResult.computedHash}</code> does not match
                      expected receipt fingerprint. The report has been altered.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="report-section">
          <h2>Executive Summary</h2>
          <p>{report.summary}</p>
          <p>
            Latest TestSprite run: <strong>{latestRun ? formatValue(latestRun.status) : "No run"}</strong>
            {latestRun ? `, ${latestRun.summary}` : "."}
          </p>
          {!publicView && (
            <button
              className="report-regenerate"
              disabled={regenerating}
              onClick={() => void handleRegenerateReport()}
            >
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
              {failedChecks
                .flatMap((check) => remediationSteps(check))
                .map((step, index) => (
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

        {/* Footer with BOT Chain website and explorer links */}
        <footer className="footer-nav">
          <div>
            <span>Release report backed by BOT Chain &amp; TestSprite</span>
          </div>
          <div className="footer-links">
            <a href="https://botchain.ai" target="_blank" rel="noreferrer">
              BOT Chain Website ↗
            </a>
            <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
              BOT Chain Explorer ↗
            </a>
          </div>
        </footer>
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

  return steps[check.category] ?? [
    `Fix the ${title} failure using the latest TestSprite evidence.`,
    "Rerun TestSprite and confirm the check is verified."
  ];
}

function formatMappingMode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildMarkdownReport(
  detail: ProjectDetail,
  summary: string,
  verdict: string,
  latestRun?: VerificationRun
) {
  const failed = detail.checks.filter((check) => check.status === "failed");
  const verified = detail.checks.filter((check) => check.status === "verified");
  const evidence = latestRun?.evidence;
  const pub = detail.latestPublication;

  const lines = [
    `# ShipBot Launch Report: ${detail.project.name}`,
    "",
    `Verdict: ${formatValue(verdict)}`,
    `Target: ${detail.project.url}`,
    `Summary: ${summary}`,
    pub ? `BOT Chain Publication: Version ${pub.version} · Hash ${pub.reportHash} · Tx ${pub.transactionHash}` : "",
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
    ...(failed.length
      ? failed.flatMap((check) => remediationSteps(check).map((step) => `- ${step}`))
      : ["- Keep TestSprite connected and rerun after material changes."]),
    "",
    "## Verified Checks",
    ...(verified.length ? verified.map((check) => `- ${check.title}`) : ["- None"])
  ].filter(Boolean);

  return lines.join("\n");
}
