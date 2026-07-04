import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { generateProjectReport, getProject, getProjectReport, listProjects, type LaunchReport, type ProjectDetail } from "./api";

interface ProjectContextValue {
  detail: ProjectDetail | null;
  report: LaunchReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectProject: (projectId: string, nextDetail?: ProjectDetail) => Promise<void>;
  regenerateReport: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
const selectedProjectKey = "shipshape:selectedProjectId";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const projects = await listProjects();
      if (projects.length === 0) {
        setDetail(null);
        setReport(null);
        return;
      }

      const storedId = window.localStorage.getItem(selectedProjectKey);
      const projectId = projects.some((project) => project.id === storedId) ? storedId! : projects[0].id;
      const [nextDetail, nextReport] = await Promise.all([getProject(projectId), getProjectReport(projectId)]);
      setDetail(nextDetail);
      setReport(nextReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load ShipShape project data");
    } finally {
      setLoading(false);
    }
  }

  async function selectProject(projectId: string, nextDetail?: ProjectDetail) {
    setLoading(true);
    setError(null);
    window.localStorage.setItem(selectedProjectKey, projectId);

    try {
      const [selectedDetail, selectedReport] = await Promise.all([nextDetail ?? getProject(projectId), getProjectReport(projectId)]);
      setDetail(selectedDetail);
      setReport(selectedReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load ShipShape project data");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateReport() {
    if (!detail) {
      return;
    }

    const nextReport = await generateProjectReport(detail.project.id);
    const nextDetail = await getProject(detail.project.id);
    setReport(nextReport);
    setDetail(nextDetail);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(
    () => ({
      detail,
      report,
      loading,
      error,
      refresh,
      selectProject,
      regenerateReport
    }),
    [detail, report, loading, error]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectData() {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error("useProjectData must be used inside ProjectProvider");
  }

  return value;
}
