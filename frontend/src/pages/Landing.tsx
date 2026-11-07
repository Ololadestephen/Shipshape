import { Link } from "react-router-dom";
import { LogoMark } from "../components/LogoMark";
import { Token } from "../components/ui";

export function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link className="brand-link" to="/audits/new">
          <LogoMark />
          <span>ShipBot</span>
        </Link>
        <div className="landing-actions">
          <a href="https://botchain.ai" target="_blank" rel="noreferrer">
            BOT Chain
          </a>
          <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
            Explorer
          </a>
          <Link to="/audits/new">Launch App</Link>
        </div>
      </header>

      <section className="hero">
        <h1>Know what blocks launch before your users do</h1>
        <p>
          ShipBot turns real test evidence into an immutable launch-readiness gate. Verify live applications, resolve critical blockers, and publish cryptographically verified release reports to BOT Chain.
        </p>
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", zIndex: 10 }}>
          <Link className="hero-cta" to="/audits/new">
            Start Audit
          </Link>
          <Link
            className="hero-cta"
            to="/report"
            style={{
              background: "#ffffff",
              color: "var(--primary)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
            }}
          >
            View Reports
          </Link>
        </div>
      </section>

      <Token label="Launch gate" className="token-left-a" color="#2f7d4a" />
      <Token label="BOT Chain registry" className="token-left-b" color="#2e7bab" />
      <Token label="Fix loop" className="token-left-c rotate-left" color="#a0632c" />
      <Token label="Open blocker" className="token-right-a" color="#e83b3b" />
      <Token label="On-chain proof" className="token-right-b" color="#2f7d4a" />
      <Token label="Ship decision" className="token-right-c rotate-right" color="#2e7bab" />
      <div className="floral floral-left" />
      <div className="floral floral-right" />

      <footer className="footer-nav" style={{ position: "relative", zIndex: 10, marginTop: "60px" }}>
        <div>
          <span>ShipBot · Release readiness backed by TestSprite &amp; BOT Chain</span>
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
    </main>
  );
}
