import { useMemo } from "react";
import { Link } from "react-router-dom";

export function PageIntro({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="page-intro">
      {eyebrow && <span>{eyebrow}</span>}
      <h1>{title}</h1>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  className = "",
  children
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <header>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyProjectState({ error }: { error?: string | null }) {
  return (
    <div className="page-grid">
      <Card className="empty-card">
        {error && <p className="form-error">{error}</p>}
        <Link className="new-audit" to="/audits/new">
          + New Audit
        </Link>
      </Card>
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  const kind = useMemo(() => value.toLowerCase().replace(/\s+/g, "-"), [value]);
  return <span className={`badge ${kind}`}>{value}</span>;
}

export function FormField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function Token({ label, className, color }: { label: string; className: string; color?: string }) {
  return (
    <div className={`token ${className}`}>
      <span style={{ background: color ?? "transparent", border: color ? "none" : "1px solid #d6dbd5" }} />
      {label}
    </div>
  );
}

function formatValue(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
