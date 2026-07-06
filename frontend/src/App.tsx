import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ChecksIssues } from "./pages/ChecksIssues";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { NewAudit } from "./pages/NewAudit";
import { ReportLoop } from "./pages/ReportLoop";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <AppShell>
            <Dashboard />
          </AppShell>
        }
      />
      <Route
        path="/audits/new"
        element={
          <AppShell>
            <NewAudit />
          </AppShell>
        }
      />
      <Route
        path="/checks"
        element={
          <AppShell>
            <ChecksIssues />
          </AppShell>
        }
      />
      <Route
        path="/report"
        element={
          <AppShell>
            <ReportLoop />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
