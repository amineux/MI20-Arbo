import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");

const DEMO_FIXTURES = [
  "Import_Rapide_exemple.xlsx",
  "Import_Rapide_Jalons.xlsx",
  "Copie_de_PPD_Template.xlsx",
  "MI20_BORD_TEMPLATE_M5_V12.xls",
  "KPI1_Template.xlsm",
  "BilanEnvois_Template.xlsx",
  "DoctsAutorisation_Template.xlsx",
  "Import_Retours_RATP_exemple.xlsx",
];

function copyDemoFixturesPlugin(): Plugin {
  const copy = () => {
    if (process.env.VITE_STATIC_DEMO !== "true") return;
    const dest = path.join(webRoot, "public/demo-fixtures");
    fs.mkdirSync(dest, { recursive: true });
    const srcDir = path.join(repoRoot, "fixtures");
    for (const file of DEMO_FIXTURES) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dest, file));
    }
  };
  return {
    name: "copy-demo-fixtures",
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  plugins: [react(), copyDemoFixturesPlugin()],
  base: process.env.VITE_BASE || "/",
  resolve: {
    alias: {
      "@mi20/domain/browser": path.resolve(repoRoot, "packages/domain/src/browser.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [repoRoot] },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
  },
});
