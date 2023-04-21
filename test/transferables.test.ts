import { test, expect } from "vitest";
import { spawn, Thread, Transfer, TransferDescriptor, Worker } from "../src/index";
import { XorBuffer } from "./workers/arraybuffer-xor";

type SpyInit<Args extends any[], OriginalReturn, NewReturn> = (
  originalFn: (...args: Args) => OriginalReturn,
) => (...args: Args) => NewReturn;

const arrayBufferPlaceholder = Symbol("ArrayBufferPlaceholder");

function spyOn<Args extends any[], OriginalReturn, NewReturn>(
  target: (...args: Args) => OriginalReturn,
  spy: SpyInit<Args, OriginalReturn, NewReturn>,
): (...args: Args) => NewReturn {
  return spy(target);
}

function replaceArrayBufferWithPlaceholder<In extends any>(
  obj: In,
  arrayBuffer: ArrayBuffer,
): In extends ArrayBuffer ? In | typeof arrayBufferPlaceholder : In {
  if ((obj as any) === arrayBuffer) {
    return arrayBufferPlaceholder as any;
  } else if (Array.isArray(obj)) {
    return (obj as any[]).map((element) => replaceArrayBufferWithPlaceholder(element, arrayBuffer)) as any;
  } else if (obj && typeof obj === "object") {
    const result: In = Object.create(Object.getPrototypeOf(obj));

    for (const key of Object.getOwnPropertyNames(obj)) {
      (result as any)[key] = replaceArrayBufferWithPlaceholder((obj as any)[key], arrayBuffer);
    }
    return result as any;
  } else {
    return obj as any;
  }
}

test("can pass transferable objects on thread call", async (t) => {
  const testData = new ArrayBuffer(64);

  const worker = new Worker("./workers/arraybuffer-xor.ts");
  const postMessageCalls: Array<any[]> = [];

  worker.postMessage = spyOn(worker.postMessage.bind(worker), (postMessage) => (...args) => {
    postMessageCalls.push(replaceArrayBufferWithPlaceholder(args, testData));
    return postMessage(...args);
  });

  const xorBuffer = await spawn<XorBuffer>(worker);
  const returnedBuffer = await xorBuffer(Transfer(testData), 15);

  expect(returnedBuffer.byteLength).toEqual(64);

  expect(postMessageCalls.length).toEqual(1);
  expect(postMessageCalls[0].length).toEqual(2);
  expect(postMessageCalls[0][0]).toEqual({
    args: [arrayBufferPlaceholder, 15],
    method: undefined,
    type: "run",
    uid: postMessageCalls[0][0].uid,
  });
  expect(postMessageCalls[0][1]).toEqual([arrayBufferPlaceholder]);

  await Thread.terminate(xorBuffer);
});

test.todo("can pass transferable objects as observable values");
