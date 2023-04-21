import { expose } from "../../dist/worker";

expose(async function add(a, b) {
  return a + b;
});
