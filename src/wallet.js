export const STUDIONET = {
  chainId: "0xf22f",
  chainName: "GenLayer Studionet",
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

export async function switchToStudionet(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET.chainId }],
    });
  } catch (error) {
    if (error.code !== 4902) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [STUDIONET],
    });
  }
}

export function readableWalletError(error) {
  if (error?.code === 4001) {
    return "Wallet request was rejected.";
  }
  return error?.message || "Wallet could not connect to GenLayer Studionet.";
}
