import { Link } from "react-router-dom";
import { LogoMark } from "../components/LogoMark";
import { Token } from "../components/ui";

export function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link className="brand-link" to="/audits/new">
          <LogoMark />
          <span>ShipShape</span>
        </Link>
        <div className="landing-actions">
          <a>GitHub Docs</a>
          <Link to="/audits/new">Start for free</Link>
        </div>
      </header>

      <section className="hero">
        <h1>Know what blocks launch before your users do</h1>
        <p>
          ShipShape turns TestSprite evidence into a clean launch gate: failed checks, fix plans, reruns, and a final ready-to-ship report.
        </p>
        <Link className="hero-cta" to="/audits/new">
          Start Audit
        </Link>
      </section>

      <Token label="Launch gate" className="token-left-a" color="#2f7d4a" />
      <Token label="Real TestSprite run" className="token-left-b" color="#2e7bab" />
      <Token label="Fix loop" className="token-left-c rotate-left" color="#a0632c" />
      <Token label="Open blocker" className="token-right-a" color="#e83b3b" />
      <Token label="Ready report" className="token-right-b" color="#2f7d4a" />
      <Token label="Ship decision" className="token-right-c rotate-right" color="#2e7bab" />
      <div className="floral floral-left" />
      <div className="floral floral-right" />
    </main>
  );
}
