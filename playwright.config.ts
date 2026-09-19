import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.test.ts",
  use: {
    baseURL: "http://localhost:3000",
  },
});
