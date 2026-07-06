import { Link } from "react-router-dom";
import { Card, EmptyProjectState, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";

export function Dashboard() {
  const { detail, report, loading, error } = useProjectData();

  if (loading) {
    return <PageState title="Loading" />;
  }

  if (error || !detail) {
    return <EmptyProjectState error={error} />;
  }

  const failed = detail.checks.filter((check) => check.status === "failed").length;
  const verified = detail.checks.filter((check) => check.status === "verified").length;
  const latestRun = detail.runs.slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];

  return (
    <div className="page-grid dashboard-grid">
      <PageIntro title="Dashboard" />
      <Card className="dashboard-hero">
        <div>
          <span>Launch gate</span>
          <strong>{report ? formatValue(report.verdict) : formatValue(detail.readiness.status)}</strong>
          <p>{report?.summary ?? "Run TestSprite to generate a launch report."}</p>
        </div>
        <div className="dashboard-actions">
          <Link to="/checks">Open Checks</Link>
          <Link to="/report">View Report</Link>
        </div>
      </Card>
      <div className="dashboard-stats">
        <Card>
          <span>Verified</span>
          <strong>
            {verified}/{detail.checks.length}
          </strong>
        </Card>
        <Card>
          <span>Failures</span>
          <strong>{failed}</strong>
        </Card>
        <Card>
          <span>TestSprite</span>
          <strong>{latestRun ? formatValue(latestRun.status) : "No Run"}</strong>
        </Card>
      </div>
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
