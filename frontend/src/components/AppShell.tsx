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
  const projectName = detail?.project.name ?? "ShipShape";

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
          </aside>

          <div className="workspace-content">
            <header className="workspace-topbar">
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
