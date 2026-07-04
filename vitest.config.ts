import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/src/tests/**/*.test.ts"],
    globals: true
  }
});
