import { ArrowRight, ExternalLink, Info, Layers3, ShieldCheck } from "lucide-react";
import { coverageLabels, rfcUrl, standards, unsupportedCapabilities, type CoverageLevel } from "../shared/standards";

const levels: CoverageLevel[] = ["subset", "demonstration", "runtime"];

export default function StandardsPage() {
  return (
    <main className="standards-page" id="main-content">
      <div className="standards-content">
        <div className="eyebrow"><ShieldCheck size={14} /> Protocol reference</div>
        <h1>RFC coverage &amp; limitations</h1>
        <p className="standards-lede">
          HTTPBin Workers implements selected HTTP behaviors described by IETF RFCs.
          This is a feature-level implementation summary, <strong>not a claim of full RFC compliance or certification.</strong>
        </p>

        <div className="standards-summary" aria-label="Coverage levels">
          {levels.map((level) => (
            <div className="standards-summary-item" key={level}>
              <strong>{standards.filter((standard) => standard.level === level).length}</strong>
              <span>{coverageLabels[level]}</span>
            </div>
          ))}
        </div>

        <section aria-labelledby="standards-heading" className="standards-section">
          <div className="standards-section-header">
            <div>
              <h2 id="standards-heading">Standard-by-standard coverage</h2>
              <p>What the service demonstrates, and where support stops.</p>
            </div>
            <a className="standards-doc-link" href="https://github.com/roseshot/HTTPBin/blob/main/docs/http-semantics.md" target="_blank" rel="noreferrer">
              Implementation notes <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="standards-grid">
            {standards.map((standard) => (
              <article className="standard-card" key={standard.rfc}>
                <div className="standard-card-top">
                  <a className="standard-number" href={rfcUrl(standard.rfc)} target="_blank" rel="noreferrer" aria-label={`Read RFC ${standard.rfc} on RFC Editor`}>
                    RFC {standard.rfc} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                  <span className={`standard-badge standard-badge-${standard.level}`}>{coverageLabels[standard.level]}</span>
                </div>
                <h3>{standard.title}</h3>
                <dl className="standard-details">
                  <div>
                    <dt>Covered behavior</dt>
                    <dd>{standard.implemented}</dd>
                  </div>
                  <div>
                    <dt>Not covered / limited</dt>
                    <dd>{standard.missing}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="limitations-heading" className="standards-section">
          <h2 id="limitations-heading">Known unsupported capabilities</h2>
          <p className="standards-section-intro">Some features are intentionally out of scope; others are controlled by Cloudflare Workers or the browser.</p>
          <ul className="standards-limitations">
            {unsupportedCapabilities.map((capability) => <li key={capability}>{capability}</li>)}
          </ul>
        </section>

        <aside className="standards-notice">
          <Info size={18} aria-hidden="true" />
          <p>
            Coverage reflects the application's documented behavior and automated tests, not an independent
            conformance audit. Cloudflare may control response framing, compression, and transport negotiation.
            Do not use the authentication examples to protect real resources.
          </p>
        </aside>

        <a className="standards-back" href="/docs"><Layers3 size={16} aria-hidden="true" /> Explore HTTP endpoints <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </main>
  );
}
