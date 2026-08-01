import { defineConfig } from "vitest/config";
import path from "path";

// Unit/invariant tests only — pure functions, node environment, no DB/network.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) }
  }
});
