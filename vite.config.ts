import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
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
