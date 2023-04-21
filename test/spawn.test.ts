import { expect, test } from "vitest";
import { Observable } from "observable-fns";
import { spawn, Thread, Worker } from "../src/index";
import { Counter } from "./workers/counter";

test("Spawning", async () => {
  test("can spawn and terminate a thread", async (t) => {
    // We also test here that running spawn() without type parameters works
    const helloWorld = await spawn(new Worker("./workers/hello-world.ts"));
    expect(await helloWorld()).toBe("Hello World");
    await Thread.terminate(helloWorld);
  });

  test("can call a function thread more than once", async (t) => {
    const increment = await spawn<() => number>(new Worker("./workers/increment.ts"));
    expect(await increment()).toEqual(1);
    expect(await increment()).toEqual(2);
    expect(await increment()).toEqual(3);
    await Thread.terminate(increment);
  });

  test("can subscribe to an observable returned by a thread call", async (t) => {
    const countToFive = await spawn<() => Observable<number>>(new Worker("./workers/count-to-five.ts"));
    const encounteredValues: any[] = [];

    const observable = countToFive();
    observable.subscribe((value) => encounteredValues.push(value));
    await observable;

    expect(encounteredValues).toEqual([1, 2, 3, 4, 5]);
    await Thread.terminate(countToFive);
  });

  test("can spawn a module thread", async (t) => {
    const counter = await spawn<Counter>(new Worker("./workers/counter.ts"));
    expect(await counter.getCount()).toEqual(0);
    await Promise.all([counter.increment(), counter.increment()]);
    expect(await counter.getCount()).toEqual(2);
    await counter.decrement();
    expect(await counter.getCount()).toEqual(1);
    await Thread.terminate(counter);
  });

  test("thread job errors are handled", async (t) => {
    const fail = await spawn<() => Promise<never>>(new Worker("./workers/faulty-function.ts"));
    await expect(() => fail()).rejects.toThrowErrorMatchingSnapshot();
    await Thread.terminate(fail);
  });

  test("thread transfer errors are handled", async (t) => {
    const builtin = require("module").builtinModules;
    if (builtin.indexOf("worker_threads") > -1) {
      // test is actual for native worker_threads only
      const helloWorld = await spawn(new Worker("./workers/hello-world.ts"));
      const badTransferObj = { fn: () => {} };
      await expect(() => helloWorld(badTransferObj)).rejects.toThrowErrorMatchingSnapshot();
      await Thread.terminate(helloWorld);
    }
  });

  test("catches top-level thread errors", async (t) => {
    await expect(() => spawn(new Worker("./workers/top-level-throw.ts"))).rejects.toThrowErrorMatchingSnapshot();
  });

  test.todo("can subscribe to thread events");
});
