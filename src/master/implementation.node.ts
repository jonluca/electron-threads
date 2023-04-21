type AnyFunction = (...args: any[]) => any;

interface CallSite {
  /**
   Returns the value of `this`.
   */
  getThis(): unknown | undefined;

  /**
   Returns the type of `this` as a string. This is the name of the function stored in the constructor field of `this`, if available, otherwise the object's `[[Class]]` internal property.
   */
  getTypeName(): string | null;

  /**
   Returns the current function.
   */
  getFunction(): AnyFunction | undefined;

  /**
   Returns the name of the current function, typically its `name` property. If a name property is not available an attempt will be made to try to infer a name from the function's context.
   */
  getFunctionName(): string | null;

  /**
   Returns the name of the property of `this` or one of its prototypes that holds the current function.
   */
  getMethodName(): string | undefined;

  /**
   Returns the name of the script if this function was defined in a script.
   */
  getFileName(): string | null;

  /**
   Returns the current line number if this function was defined in a script.
   */
  getLineNumber(): number | null;

  /**
   Returns the current column number if this function was defined in a script.
   */
  getColumnNumber(): number | null;

  /**
   Returns a string representing the location where `eval` was called if this function was created using a call to `eval`.
   */
  getEvalOrigin(): string | undefined;

  /**
   Returns `true` if this is a top-level invocation, that is, if it's a global object.
   */
  isToplevel(): boolean;

  /**
   Returns `true` if this call takes place in code defined by a call to `eval`.
   */
  isEval(): boolean;

  /**
   Returns `true` if this call is in native V8 code.
   */
  isNative(): boolean;

  /**
   Returns `true` if this is a constructor call.
   */
  isConstructor(): boolean;
}
function callsites(): CallSite[] {
  const _prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack!.slice(1); // eslint-disable-line unicorn/error-message
  Error.prepareStackTrace = _prepareStackTrace;
  return stack as unknown as CallSite[];
}

import { cpus } from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { ImplementationExport, ThreadsWorkerOptions, WorkerImplementation } from "../types/master";
import { isMainThread } from "worker_threads";
import { Worker as NativeWorker } from "worker_threads";

interface WorkerGlobalScope {
  addEventListener(eventName: string, listener: (event: Event) => void): void;
  postMessage(message: any, transferables?: any[]): void;
  removeEventListener(eventName: string, listener: (event: Event) => void): void;
}

declare const self: WorkerGlobalScope;

type WorkerEventName = "error" | "message";

let tsNodeAvailable: boolean | undefined;

export const defaultPoolSize = cpus().length;

function detectTsNode() {
  if (tsNodeAvailable) {
    return tsNodeAvailable;
  }

  try {
    eval("require").resolve("ts-node");
    tsNodeAvailable = true;
  } catch (error: any) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      tsNodeAvailable = false;
    } else {
      // Re-throw
      throw error;
    }
  }
  return tsNodeAvailable;
}

function createTsNodeModule(scriptPath: string) {
  const content = `
    require("ts-node/register/transpile-only");
    require(${JSON.stringify(scriptPath)});
  `;
  return content;
}

function rebaseScriptPath(scriptPath: string, ignoreRegex: RegExp) {
  const parentCallSite = callsites().find((callsite: CallSite) => {
    const filename = callsite.getFileName();
    return Boolean(
      filename &&
        !filename.match(ignoreRegex) &&
        !filename.match(/[\/\\]master[\/\\]implementation/) &&
        !filename.match(/^internal\/process/),
    );
  });

  const rawCallerPath = parentCallSite ? parentCallSite.getFileName() : null;
  let callerPath = rawCallerPath ? rawCallerPath : null;
  if (callerPath && callerPath.startsWith("file:")) {
    callerPath = fileURLToPath(callerPath);
  }
  const rebasedScriptPath = callerPath ? path.join(path.dirname(callerPath), scriptPath) : scriptPath;

  return rebasedScriptPath;
}

function resolveScriptPath(scriptPath: string, baseURL?: string | undefined) {
  const makeRelative = (filePath: string) => {
    return path.isAbsolute(filePath) ? filePath : path.join(baseURL || eval("__dirname"), filePath);
  };

  const workerFilePath = require.resolve(makeRelative(rebaseScriptPath(scriptPath, /[\/\\]worker_threads[\/\\]/)));

  return workerFilePath;
}

function initWorkerThreadsWorker(): ImplementationExport {
  let allWorkers: Array<Worker> = [];

  class Worker extends NativeWorker {
    private mappedEventListeners: WeakMap<EventListener, EventListener>;

    constructor(scriptPath: string, options?: ThreadsWorkerOptions & { fromSource: boolean }) {
      const resolvedScriptPath =
        options && options.fromSource ? null : resolveScriptPath(scriptPath, (options || {})._baseURL);

      if (!resolvedScriptPath) {
        // `options.fromSource` is true
        const sourceCode = scriptPath;
        super(sourceCode, { ...options, eval: true });
      } else if (resolvedScriptPath.match(/\.tsx?$/i) && detectTsNode()) {
        super(createTsNodeModule(resolvedScriptPath), { ...options, eval: true });
      } else if (!options?.asar && resolvedScriptPath.match(/\.asar[\/\\]/)) {
        // See <https://github.com/andywer/threads-plugin/issues/17>
        super(resolvedScriptPath.replace(/\.asar([\/\\])/, ".asar.unpacked$1"), options);
      } else {
        super(resolvedScriptPath, options);
      }

      this.mappedEventListeners = new WeakMap();
      allWorkers.push(this);
    }

    public addEventListener(eventName: string, rawListener: EventListener) {
      const listener = (message: any) => {
        rawListener({ data: message } as any);
      };
      this.mappedEventListeners.set(rawListener, listener);
      this.on(eventName, listener);
    }

    public removeEventListener(eventName: string, rawListener: EventListener) {
      const listener = this.mappedEventListeners.get(rawListener) || rawListener;
      this.off(eventName, listener);
    }
  }

  const terminateWorkersAndMaster = () => {
    // we should terminate all workers and then gracefully shutdown self process
    Promise.all(allWorkers.map((worker) => worker.terminate())).then(
      () => process.exit(0),
      () => process.exit(1),
    );
    allWorkers = [];
  };

  // Take care to not leave orphaned processes behind. See #147.
  process.on("SIGINT", () => terminateWorkersAndMaster());
  process.on("SIGTERM", () => terminateWorkersAndMaster());

  class BlobWorker extends Worker {
    constructor(blob: Uint8Array, options?: ThreadsWorkerOptions) {
      super(Buffer.from(blob).toString("utf-8"), { ...options, fromSource: true });
    }

    public static fromText(source: string, options?: ThreadsWorkerOptions): WorkerImplementation {
      return new Worker(source, { ...options, fromSource: true }) as any;
    }
  }

  return {
    blob: BlobWorker as any,
    default: Worker as any,
  };
}

let implementation: ImplementationExport;

function selectWorkerImplementation(): ImplementationExport {
  return initWorkerThreadsWorker();
}

export function getWorkerImplementation(): ImplementationExport {
  if (!implementation) {
    implementation = selectWorkerImplementation();
  }
  return implementation;
}

export function isWorkerRuntime() {
  return !isMainThread;
}
