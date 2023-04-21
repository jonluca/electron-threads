import { expect, test } from "vitest";
import { Observable } from "observable-fns";
import { ObservablePromise } from "../src/observable-promise";
import exp = require("constants");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("can create an observable promise", async (t) => {
  await new ObservablePromise((observer) => {
    expect(observer).toBeDefined();
    observer.complete();
  });
});

test("init function is only called once", async (t) => {
  let initCallCount = 0;

  const async = new ObservablePromise((observer) => {
    initCallCount++;
    setTimeout(() => observer.complete(), 10);
  });

  await Promise.all([
    async.then(() => expect(true).toBeTruthy()),
    async.then(() => expect(true).toBeTruthy()),
    async.then(() => expect(true).toBeTruthy()),
  ]);

  expect(initCallCount).toEqual(1);
});

test("can proxy a promise fulfillment", async (t) => {
  const async = new ObservablePromise((observer) => {
    setTimeout(() => {
      observer.next(123);

      // Ignore all values after the first one
      observer.next(456);
      observer.complete();
    }, 1);
  });

  const promise1 = async.then((value) => expect(value).toEqual(123), expect.fail);
  await delay(10);
  const promise2 = async.then((value) => expect(value).toEqual(123), expect.fail);

  await Promise.all([promise1, promise2]);
});

test("can proxy a promise rejection", async (t) => {
  let handlerCallCount = 0;

  const async = new ObservablePromise((observer) => {
    setTimeout(() => observer.error(Error("I am supposed to be rejected.")), 1);
  });

  const promise1 = async.then(
    () => expect.fail("Promise should not become fulfilled"),
    () => Promise.resolve(handlerCallCount++),
  );
  await delay(10);
  const promise2 = async.then(
    () => expect.fail("Promise should not become fulfilled"),
    () => Promise.resolve(handlerCallCount++),
  );

  await Promise.all([promise1.catch(() => true), promise2.catch(() => true)]);
  expect(handlerCallCount).toEqual(2);
});

test("can proxy a promise rejection caused by a sync throw", async (t) => {
  let handlerCallCount = 0;

  const async = new ObservablePromise(() => {
    throw Error("I am supposed to be rejected.");
  });

  const promise1 = async.then(
    () => expect.fail("Promise should not become fulfilled"),
    () => Promise.resolve(handlerCallCount++),
  );
  await delay(10);
  const promise2 = async.then(
    () => {
      return expect.fail("Promise should not become fulfilled");
    },
    () => Promise.resolve(handlerCallCount++),
  );

  await Promise.all([promise1, promise2]);
  expect(handlerCallCount).toEqual(2);
});

test("can subscribe to values and completion", async (t) => {
  let capturedValues: any[] = [];
  let capturedCompletions = 0;

  const async = new ObservablePromise((observer) => {
    setTimeout(() => observer.next(1), 10);
    setTimeout(() => observer.next(2), 20);
    setTimeout(() => observer.complete(), 30);
  });

  for (let index = 0; index < 2; index++) {
    async.subscribe(
      (value) => capturedValues.push(value),
      () => undefined,
      () => capturedCompletions++,
    );
  }

  await async.finally();
  await delay(1);

  expect(capturedValues).toEqual([1, 1, 2, 2]);
  expect(capturedCompletions).toEqual(2);
});

test("can subscribe to errors", async (t) => {
  let capturedErrorMessages: string[] = [];
  let capturedValues: any[] = [];
  let capturedCompletions = 0;

  const async = new ObservablePromise((observer) => {
    setTimeout(() => observer.next(1), 10);
    setTimeout(() => observer.error(Error("Fails as expected.")), 20);
    setTimeout(() => observer.next(2), 30);
    setTimeout(() => observer.complete(), 40);
  });

  for (let index = 0; index < 2; index++) {
    async.subscribe(
      (value) => capturedValues.push(value),
      (error) => capturedErrorMessages.push(error.message),
      () => capturedCompletions++,
    );
  }

  await async.finally();
  await delay(35);

  expect(capturedValues).toEqual([1, 1]);
  expect(capturedErrorMessages).toEqual(["Fails as expected.", "Fails as expected."]);
  expect(capturedCompletions).toEqual(0);
});

test("from(Observable) works", async (t) => {
  let capturedErrorMessages: string[] = [];
  let capturedValues: any[] = [];
  let capturedCompletions = 0;

  const async = ObservablePromise.from(
    new Observable((observer) => {
      setTimeout(() => observer.next(1), 10);
      setTimeout(() => observer.error(Error("Fails as expected.")), 20);
      setTimeout(() => observer.next(2), 30);
      setTimeout(() => observer.complete(), 40);
    }),
  );

  for (let index = 0; index < 2; index++) {
    async.subscribe(
      (value) => capturedValues.push(value),
      (error) => capturedErrorMessages.push(error.message),
      () => capturedCompletions++,
    );
  }

  await async.finally();
  await delay(35);

  expect(capturedValues).toEqual([1, 1]);
  expect(capturedErrorMessages).toEqual(["Fails as expected.", "Fails as expected."]);
  expect(capturedCompletions).toEqual(0);
});

test("from(Promise) works", async (t) => {
  const resolved = ObservablePromise.from(
    new Promise((resolve) => {
      setTimeout(() => resolve("Works"), 10);
    }),
  );
  expect(await resolved).toEqual("Works");

  try {
    await ObservablePromise.from(Promise.reject(Error("Fails")));
  } catch (error) {
    expect(error.message).toEqual("Fails");
  }
});
