import { expect, test } from "vitest";
import { fooSerializer, Foo } from "./lib/serialization";
import { registerSerializer, spawn, Thread, Worker } from "../src/index";

registerSerializer(fooSerializer);

test("can use a custom serializer", async (t) => {
  const run = await spawn(new Worker("./workers/serialization.ts"));

  try {
    const input = new Foo("Test");
    const result: Foo<string> = await run(input);

    expect(result).toBeInstanceOf(Foo);
    expect(result.getValue()).toBe("TestTest");
  } finally {
    await Thread.terminate(run);
  }
});
