import { ArrowRight, ExternalLink, Info, Layers3, ShieldCheck } from "lucide-react";
import { coverageLabels, rfcUrl, standards, unsupportedCapabilities, type CoverageLevel } from "../shared/standards";
import { useI18n } from "./i18n";

const levels: CoverageLevel[] = ["subset", "demonstration", "runtime"];

export default function StandardsPage() {
  const { t, href } = useI18n();
  const statusLabel = (level: CoverageLevel) => t(level === "subset" ? "subset" : level === "demonstration" ? "demonstration" : "runtimeControlled");
  return (
    <main className="standards-page" id="main-content">
      <div className="standards-content">
        <div className="eyebrow"><ShieldCheck size={14} /> {t("rfcEyebrow")}</div>
        <h1>{t("rfcTitle")}</h1>
        <p className="standards-lede">
          {t("rfcLede")} <strong>{t("rfcDisclaimer")}</strong>
        </p>

        <div className="standards-summary" aria-label="Coverage levels">
          {levels.map((level) => (
            <div className="standards-summary-item" key={level}>
              <strong>{standards.filter((standard) => standard.level === level).length}</strong>
              <span>{statusLabel(level)}</span>
            </div>
          ))}
        </div>

        <section aria-labelledby="standards-heading" className="standards-section">
          <div className="standards-section-header">
            <div>
              <h2 id="standards-heading">{t("rfcHeading")}</h2>
              <p>{t("rfcHeadingHelp")}</p>
            </div>
            <a className="standards-doc-link" href="https://github.com/roseshot/HTTPBin/blob/main/docs/http-semantics.md" target="_blank" rel="noreferrer">
              {t("implementationNotes")} <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="standards-grid">
            {standards.map((standard) => (
              <article className="standard-card" key={standard.rfc}>
                <div className="standard-card-top">
                  <a className="standard-number" href={rfcUrl(standard.rfc)} target="_blank" rel="noreferrer" aria-label={`${t("rfcRead")} ${standard.rfc}`}>
                    RFC {standard.rfc} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                  <span className={`standard-badge standard-badge-${standard.level}`}>{statusLabel(standard.level)}</span>
                </div>
                <h3>{standard.title}</h3>
                <dl className="standard-details">
                  <div>
                    <dt>{t("covered")}</dt>
                    <dd>{standard.implemented}</dd>
                  </div>
                  <div>
                    <dt>{t("missing")}</dt>
                    <dd>{standard.missing}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="limitations-heading" className="standards-section">
          <h2 id="limitations-heading">{t("unsupported")}</h2>
          <p className="standards-section-intro">{t("unsupportedHelp")}</p>
          <ul className="standards-limitations">
            {unsupportedCapabilities.map((capability, index) => <li key={capability}>{t((`limit${index + 1}`) as "limit1" | "limit2" | "limit3" | "limit4" | "limit5")}</li>)}
          </ul>
        </section>

        <aside className="standards-notice">
          <Info size={18} aria-hidden="true" />
          <p>
            {t("rfcNotice")}
          </p>
        </aside>

        <a className="standards-back" href={href("/docs")}><Layers3 size={16} aria-hidden="true" /> {t("explore")} <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </main>
  );
}
