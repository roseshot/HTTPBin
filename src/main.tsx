import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/playground.css";
import "./styles/dropdown.css";
import "./styles/responsive.css";
import "./styles/standards.css";
import "./styles/i18n.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>);
