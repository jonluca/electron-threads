/*
 * This file is only a stub to make './implementation' resolve to the right module.
 */

import { AbstractedWorkerAPI } from "../types/worker";
import WebWorkerImplementation from "./implementation.browser";
import WorkerThreadsImplementation from "./implementation.worker_threads";

const runningInNode = typeof process !== "undefined" && (process.arch as string) !== "browser" && "pid" in process;

function selectNodeImplementation(): AbstractedWorkerAPI {
  WorkerThreadsImplementation.testImplementation();
  return WorkerThreadsImplementation;
}

export default runningInNode ? selectNodeImplementation() : WebWorkerImplementation;
