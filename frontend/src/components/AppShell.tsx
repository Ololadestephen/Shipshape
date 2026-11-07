import { Link, NavLink } from "react-router-dom";
import { ProjectProvider, useProjectData } from "../projectContext";
import { LogoMark } from "./LogoMark";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AppChrome>{children}</AppChrome>
    </ProjectProvider>
  );
}

function AppChrome({ children }: { children: React.ReactNode }) {
  const { detail } = useProjectData();
  const projectName = detail?.project.name ?? "ShipBot";

  return (
    <div className="app">
      <main className="main-area">
        <section className="workspace-frame">
          <aside className="workspace-sidebar">
            <div className="org">
              <span className="org-mark" aria-hidden="true">
                <LogoMark />
              </span>
              <strong>{projectName}</strong>
            </div>
            <SidebarGroup
              items={[
                ["/audits/new", "+", "New Audit"],
                ["/checks", "☑", "Checks"],
                ["/report", "◷", "Report"]
              ]}
            />
            <div style={{ marginTop: "auto", padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--primary)", fontWeight: 600 }}>
                <span style={{ height: "6px", width: "6px", borderRadius: "50%", background: "var(--primary)" }} />
                BOT Chain Mainnet (677)
              </div>
              <a
                href="https://scan.botchain.ai"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "4px" }}
              >
                Explorer: scan.botchain.ai ↗
              </a>
            </div>
          </aside>

          <div className="workspace-content">
            <header className="workspace-topbar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="wallet-badge" style={{ background: "#e8f7ee", color: "#25663c", fontSize: "12px", border: "1px solid #cce3d3" }}>
                  <span style={{ height: "6px", width: "6px", borderRadius: "50%", background: "#25663c", display: "inline-block" }} />
                  BOT Chain Mainnet (Chain ID 677)
                </span>
              </div>
              <div className="topbar-spacer" />
              <Link className="new-audit" to="/audits/new">
                + New Audit
              </Link>
            </header>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

function SidebarGroup({ items }: { items: Array<[string, string, string]> }) {
  return (
    <div className="sidebar-group">
      {items.map(([path, icon, label]) => (
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} key={label} to={path}>
          <i>{icon}</i>
          {label}
        </NavLink>
      ))}
    </div>
  );
}
