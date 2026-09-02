import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { FluentProvider } from "@fluentui/react-components";
import { App } from "./App";
import { mi20Theme } from "./theme";
import { installStaticDemo, isStaticDemo, rewritePathToHash } from "./demo/install";
import "./styles.css";

if (isStaticDemo()) {
  rewritePathToHash();
  installStaticDemo();
}

const rawBase = import.meta.env.BASE_URL || "/";
const basename = rawBase === "./" || rawBase === "/" ? undefined : rawBase.replace(/\/$/, "");

const router = isStaticDemo() ? (
  <HashRouter>
    <App />
  </HashRouter>
) : (
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FluentProvider theme={mi20Theme}>{router}</FluentProvider>
  </React.StrictMode>,
);
