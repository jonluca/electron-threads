import { defineConfig } from "vitest/config";
const env = process.env.BROWSER ? "jsdom" : "node";
export default defineConfig({
  test: {
    environment: env,
    dir: ".",
    watch: false,
    testTimeout: 5000,
    passWithNoTests: true,
    reporters: ["verbose"],
    deps: {
      interopDefault: true,
      registerNodeLoader: true,
    },
  },
});
