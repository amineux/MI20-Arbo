import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@mi20/domain/browser": path.resolve(repoRoot, "packages/domain/src/browser.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    root: webRoot,
    testTimeout: 30000,
  },
});
