// FIXME
type MessagePort = any;

interface WorkerThreadsModule {
  MessagePort: typeof MessagePort;
  isMainThread: boolean;
  parentPort: MessagePort;
}

let implementation: WorkerThreadsModule | undefined;

function selectImplementation(): WorkerThreadsModule {
  return eval("require")("worker_threads");
}

export default function getImplementation(): WorkerThreadsModule {
  if (!implementation) {
    implementation = selectImplementation();
  }
  return implementation;
}
