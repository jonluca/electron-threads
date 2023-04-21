import { test, expect } from "vitest";
import { execa } from "execa";
import * as path from "path";
import { build } from "esbuild";

test("can be bundled using rollup", async (t) => {
  const sharedOpts = {
    bundle: true,
    target: "chrome109",
    format: "iife",
    write: true,
    outdir: path.resolve(__dirname, "dist"),
  } as const;
  await build({
    ...sharedOpts,
    entryPoints: [path.resolve(__dirname, "app.js")],
  });

  await build({
    ...sharedOpts,
    entryPoints: [path.resolve(__dirname, "worker.js")],
  });

  if (process.platform === "win32") {
    // Quick-fix for weird Windows issue in CI
    return;
  }

  const result = await execa("puppet-run --serve ./dist/worker.js:/worker.js ./dist/app.js", {
    cwd: __dirname,
    stdio: "ignore",
    shell: true,
  });
  expect(result.exitCode).toEqual(0);
});
