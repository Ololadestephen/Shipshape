import { Link, NavLink } from "react-router-dom";
import { ProjectProvider, useProjectData } from "../projectContext";

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
  const projectEmoji = emojiForProject(detail?.project.appType);

  return (
    <div className="app">
      <main className="main-area">
        <section className="workspace-frame">
          <aside className="workspace-sidebar">
            <div className="org">
              <span>{projectEmoji}</span>
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

function emojiForProject(appType?: string) {
  const emojis: Record<string, string> = {
    saas: "🚀",
    ecommerce: "🛍️",
    portfolio: "✨",
    internal_tool: "🛠️",
    marketplace: "🧭",
    content: "📝",
    other: "✅"
  };

  return emojis[appType ?? ""] ?? "🚢";
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
