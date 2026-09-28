import assert from "node:assert/strict";
import { STUDIONET, switchToStudionet } from "../src/wallet.js";

const switchOnlyCalls = [];
await switchToStudionet({
  request: async (payload) => {
    switchOnlyCalls.push(payload);
  },
});

assert.deepEqual(switchOnlyCalls, [
  {
    method: "wallet_switchEthereumChain",
    params: [{ chainId: STUDIONET.chainId }],
  },
]);

const addAfterMissingCalls = [];
await switchToStudionet({
  request: async (payload) => {
    addAfterMissingCalls.push(payload);
    if (payload.method === "wallet_switchEthereumChain") {
      const error = new Error("Unknown chain");
      error.code = 4902;
      throw error;
    }
  },
});

assert.deepEqual(addAfterMissingCalls, [
  {
    method: "wallet_switchEthereumChain",
    params: [{ chainId: STUDIONET.chainId }],
  },
  {
    method: "wallet_addEthereumChain",
    params: [STUDIONET],
  },
]);

console.log("wallet switch flow ok");
