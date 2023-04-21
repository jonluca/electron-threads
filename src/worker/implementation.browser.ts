/// <reference lib="dom" />

import { AbstractedWorkerAPI } from "../types/worker";

interface WorkerGlobalScope {
  addEventListener(eventName: string, listener: (event: Event) => void): void;
  postMessage(message: any, transferables?: any[]): void;
  removeEventListener(eventName: string, listener: (event: Event) => void): void;
}

declare const self: WorkerGlobalScope;

const isWorkerRuntime: AbstractedWorkerAPI["isWorkerRuntime"] = function isWorkerRuntime() {
  const isWindowContext = typeof self !== "undefined" && typeof Window !== "undefined" && self instanceof Window;
  return typeof self !== "undefined" && self.postMessage !== undefined && !isWindowContext ? true : false;
};

const postMessageToMaster: AbstractedWorkerAPI["postMessageToMaster"] = function postMessageToMaster(
  data,
  transferList?,
) {
  self.postMessage(data, transferList);
};

const subscribeToMasterMessages: AbstractedWorkerAPI["subscribeToMasterMessages"] = function subscribeToMasterMessages(
  onMessage,
) {
  const messageHandler = (messageEvent: MessageEvent) => {
    onMessage(messageEvent.data);
  };
  const unsubscribe = () => {
    self.removeEventListener("message", messageHandler as EventListener);
  };
  self.addEventListener("message", messageHandler as EventListener);
  return unsubscribe;
};

export default {
  isWorkerRuntime,
  postMessageToMaster,
  subscribeToMasterMessages,
};
