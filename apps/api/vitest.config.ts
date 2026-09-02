import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    root: dirname(fileURLToPath(import.meta.url)),
    testTimeout: 20000,
  },
});
