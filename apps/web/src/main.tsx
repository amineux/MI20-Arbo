import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { App } from "./App";
import "./styles.css";

async function boot() {
  if (import.meta.env.VITE_STATIC_DEMO === "true") {
    const { installStaticDemo } = await import("./demo/install");
    installStaticDemo();
  }

  const rawBase = import.meta.env.BASE_URL || "/";
  const basename = rawBase === "./" || rawBase === "/" ? undefined : rawBase.replace(/\/$/, "");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <FluentProvider theme={webLightTheme}>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </FluentProvider>
    </React.StrictMode>,
  );
}

void boot();
