import { test, expect } from "vitest";
import { Observable, Subject } from "../src/observable";

test("Observable subject emits values and completion event", async (t) => {
  let completed1 = false;
  const values1: number[] = [];
  let completed2 = false;
  const values2: number[] = [];
  let completed3 = false;
  const values3: number[] = [];

  const subject = new Subject<number>();
  const observable = Observable.from(subject);

  const subscription1 = subject.subscribe(
    (value) => values1.push(value),
    undefined,
    () => (completed1 = true),
  );
  subject.subscribe(
    (value) => values2.push(value),
    undefined,
    () => (completed2 = true),
  );
  observable.subscribe(
    (value) => values3.push(value),
    undefined,
    () => (completed3 = true),
  );

  subject.next(1);
  subscription1.unsubscribe();

  subject.next(2);
  subject.complete();

  expect(values1).toEqual([1]);
  expect(values2).toEqual([1, 2]);
  expect(values3).toEqual([1, 2]);
  expect(completed1).toBe(false);
  expect(completed2).toBe(true);
  expect(completed3).toBe(true);
});

test("Observable subject propagates errors", async (t) => {
  let completed1 = false;
  let error1: Error | undefined;
  let completed2 = false;
  let error2: Error | undefined;
  let completed3 = false;
  let error3: Error | undefined;

  const subject = new Subject<number>();
  const observable = Observable.from(subject);

  const subscription1 = subject.subscribe(
    () => undefined,
    (error) => (error1 = error),
    () => (completed1 = true),
  );
  subject.subscribe(
    () => undefined,
    (error) => (error2 = error),
    () => (completed2 = true),
  );
  observable.subscribe(
    () => undefined,
    (error) => (error3 = error),
    () => (completed3 = true),
  );

  const testingError = Error("Test, test!");

  subscription1.unsubscribe();
  subject.error(testingError);

  expect(completed1).toBe(false);
  expect(error1).toBeUndefined();
  expect(completed2).toBe(false);
  expect(error2).toBe(testingError);
  expect(completed3).toBe(false);
  expect(error3).toBe(testingError);
});
