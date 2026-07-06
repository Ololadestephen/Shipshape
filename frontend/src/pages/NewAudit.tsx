import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, createTestSpriteProject, type AppType } from "../api";
import { Card, FormField, PageIntro } from "../components/ui";
import { useProjectData } from "../projectContext";
import { formatValue } from "../viewModel";

const appTypes: AppType[] = ["saas", "ecommerce", "portfolio", "internal_tool", "marketplace", "content", "other"];
const flowOptions = ["Signup", "Login", "Contact form", "Billing", "Checkout", "Search", "Report export"];

export function NewAudit() {
  const navigate = useNavigate();
  const { selectProject } = useProjectData();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [appType, setAppType] = useState<AppType>("saas");
  const [selectedFlows, setSelectedFlows] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const detail = await createProject({
        name,
        url,
        appType,
        flows: selectedFlows
      });

      let linkedDetail = detail;
      try {
        linkedDetail = await createTestSpriteProject(detail.project.id, detail.project.url);
      } catch (linkError) {
        await selectProject(detail.project.id, detail);
        navigate("/checks", {
          state: {
            actionError: linkError instanceof Error ? `Audit created, but TestSprite was not linked: ${linkError.message}` : "Audit created, but TestSprite was not linked"
          }
        });
        return;
      }

      await selectProject(linkedDetail.project.id, linkedDetail);
      navigate("/checks");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create launch audit");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFlow(flow: string) {
    setSelectedFlows((current) => (current.includes(flow) ? current.filter((item) => item !== flow) : [...current, flow]));
  }

  return (
    <div className="page-grid audit-grid">
      <PageIntro title="Create audit" />
      <Card className="form-card" title="Project">
        <form onSubmit={handleSubmit}>
          <FormField required label="App name" value={name} onChange={setName} />
          <FormField required label="Live URL" value={url} onChange={setUrl} type="url" />
          <div className="form-row">
            <label className="form-field">
              <span>App type</span>
              <select value={appType} onChange={(event) => setAppType(event.target.value as AppType)}>
                {appTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatValue(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Flows</span>
              <input value={`${selectedFlows.length} selected`} readOnly />
            </label>
          </div>
          <div className="chip-field">
            <span>Critical flows</span>
            <div>
              {flowOptions.map((flow) => (
                <button className={selectedFlows.includes(flow) ? "selected" : ""} key={flow} type="button" onClick={() => toggleFlow(flow)}>
                  {flow}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-wide" disabled={submitting || !name || !url} type="submit">
            {submitting ? "Generating..." : "Generate"}
          </button>
        </form>
      </Card>
    </div>
  );
}
