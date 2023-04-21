import { test, expect } from "vitest";
import { execa } from "execa";

test("can compile with a minimal TypeScript config", async (t) => {
  const result = await execa("tsc", ["--project", require.resolve("./minimal-tsconfig.json")]);
  expect(result.exitCode).toEqual(0);
});
