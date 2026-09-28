import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  readableWalletError,
  requestAccountPicker,
  revokeAccountPermission,
  switchToStudionet,
} from "./wallet.js";
import "./styles.css";

const CONTRACT_ADDRESS = "0x326bC3E58Ea37bd288E4B15DF6848706C3ec5E4A";

window.sourceGuardReady = true;

const readClient = createClient({ chain: studionet });
let writeClient = null;
let walletAddress = "";
let latestReport = "";

const walletTitle = document.querySelector("#wallet-title");
const connectButton = document.querySelector("#connect-wallet");
const disconnectButton = document.querySelector("#disconnect-wallet");
const submitButton = document.querySelector("#submit-attestation");
const readButton = document.querySelector("#read-latest");
const txTitle = document.querySelector("#tx-title");
const txOutput = document.querySelector("#tx-output");
const readTitle = document.querySelector("#read-title");
const readOutput = document.querySelector("#read-output");
const copyReportButton = document.querySelector("#copy-report");

connectButton.addEventListener("click", connectWallet);
disconnectButton.addEventListener("click", disconnectWallet);
submitButton.addEventListener("click", submitAttestation);
readButton.addEventListener("click", readLatestReport);
copyReportButton.addEventListener("click", copyLatestReport);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", handleAccountsChanged);
  window.ethereum.on?.("chainChanged", handleChainChanged);
  syncExistingWallet();
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      walletTitle.textContent = "Wallet missing";
      txOutput.textContent = "Install MetaMask or another EIP-1193 wallet.";
      return false;
    }

    txTitle.textContent = "Switching network";
    txOutput.textContent = "Approve GenLayer Studionet in your wallet.";
    await switchToStudionet(window.ethereum);

    const changingWallet = Boolean(walletAddress);
    if (changingWallet) {
      txTitle.textContent = "Choose wallet";
      txOutput.textContent = "Approve account reset, then pick the wallet to use.";
      await revokeAccountPermission(window.ethereum);
    }

    await requestAccountPicker(window.ethereum);
    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    setConnectedWallet(address);
    return true;
  } catch (error) {
    setDisconnectedWallet();
    txTitle.textContent = "Wallet blocked";
    txOutput.textContent = readableWalletError(error);
    return false;
  }
}

async function submitAttestation() {
  try {
    if (!writeClient) {
      const connected = await connectWallet();
      if (!connected) return;
    }

    const claim = document.querySelector("#claim").value.trim();
    const sources = [
      document.querySelector("#source-one").value.trim(),
      document.querySelector("#source-two").value.trim(),
      document.querySelector("#source-three").value.trim(),
    ].filter(Boolean);

    if (!claim || sources.length === 0) {
      txTitle.textContent = "Missing input";
      txOutput.textContent = "Add a claim and at least one source URL.";
      return;
    }

    txTitle.textContent = "Wallet signing";
    txOutput.textContent = "Confirm the GenLayer transaction in your wallet.";

    const hash = await writeClient.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "attest",
      args: [claim, sources],
      value: BigInt(0),
    });

    txTitle.textContent = "Submitted";
    txOutput.textContent = JSON.stringify({ transactionHash: hash }, null, 2);

    const receipt = await readClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      fullTransaction: false,
    });

    txTitle.textContent = "Accepted";
    txOutput.textContent = JSON.stringify(receipt, formatBigInt, 2);
    await readLatestReport();
  } catch (error) {
    txTitle.textContent = "Action failed";
    txOutput.textContent = error.message;
  }
}

async function readLatestReport() {
  try {
    readTitle.textContent = "Reading";
    readOutput.textContent = "Calling the deployed Intelligent Contract.";

    const result = await readClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_latest_report",
      args: [],
      stateStatus: "accepted",
    });

    latestReport = JSON.stringify(result, formatBigInt, 2);
    readTitle.textContent = "Contract responded";
    readOutput.textContent = latestReport;
    copyReportButton.disabled = false;
  } catch (error) {
    readTitle.textContent = "Read failed";
    readOutput.textContent = error.message;
    copyReportButton.disabled = true;
  }
}

async function copyLatestReport() {
  if (!latestReport) return;
  await navigator.clipboard.writeText(latestReport);
  copyReportButton.textContent = "Copied";
  window.setTimeout(() => {
    copyReportButton.textContent = "Copy";
  }, 1200);
}

async function syncExistingWallet() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      setConnectedWallet(accounts[0]);
    }
  } catch {
    setDisconnectedWallet();
  }
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
    return;
  }
  setConnectedWallet(accounts[0]);
}

function handleChainChanged() {
  if (walletAddress && window.ethereum) {
    switchToStudionet(window.ethereum).catch(() => {
      txTitle.textContent = "Wrong network";
      txOutput.textContent = "Switch back to GenLayer Studionet in your wallet.";
    });
  }
}

function setConnectedWallet(address) {
  walletAddress = address;
  writeClient = createClient({
    chain: studionet,
    account: walletAddress,
    provider: window.ethereum,
  });
  walletTitle.textContent = shortAddress(walletAddress);
  connectButton.textContent = "Change wallet";
  disconnectButton.hidden = false;
  txTitle.textContent = "Wallet ready";
  txOutput.textContent =
    "Connected to GenLayer Studionet. You can submit an attestation.";
}

async function disconnectWallet() {
  if (window.ethereum) {
    try {
      await revokeAccountPermission(window.ethereum);
    } catch {
    }
  }
  setDisconnectedWallet();
  txTitle.textContent = "Disconnected";
  txOutput.textContent =
    "Wallet cleared in this app. Use Change wallet to pick another account.";
}

function setDisconnectedWallet() {
  walletAddress = "";
  writeClient = null;
  walletTitle.textContent = "Not connected";
  connectButton.textContent = "Connect wallet";
  disconnectButton.hidden = true;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBigInt(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}
