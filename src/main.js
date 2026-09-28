import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { readableWalletError, switchToStudionet } from "./wallet.js";
import "./styles.css";

const CONTRACT_ADDRESS = "0x326bC3E58Ea37bd288E4B15DF6848706C3ec5E4A";

window.sourceGuardReady = true;

const readClient = createClient({ chain: studionet });
let writeClient = null;
let walletAddress = "";
let latestReport = "";

const walletTitle = document.querySelector("#wallet-title");
const connectButton = document.querySelector("#connect-wallet");
const submitButton = document.querySelector("#submit-attestation");
const readButton = document.querySelector("#read-latest");
const txTitle = document.querySelector("#tx-title");
const txOutput = document.querySelector("#tx-output");
const readTitle = document.querySelector("#read-title");
const readOutput = document.querySelector("#read-output");
const copyReportButton = document.querySelector("#copy-report");

connectButton.addEventListener("click", connectWallet);
submitButton.addEventListener("click", submitAttestation);
readButton.addEventListener("click", readLatestReport);
copyReportButton.addEventListener("click", copyLatestReport);

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

    const [address] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    walletAddress = address;
    writeClient = createClient({
      chain: studionet,
      account: walletAddress,
      provider: window.ethereum,
    });

    walletTitle.textContent = shortAddress(walletAddress);
    txTitle.textContent = "Wallet ready";
    txOutput.textContent =
      "Connected to GenLayer Studionet. You can submit an attestation.";
    return true;
  } catch (error) {
    walletTitle.textContent = "Not connected";
    txTitle.textContent = "Wallet blocked";
    txOutput.textContent = readableWalletError(error);
    writeClient = null;
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

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBigInt(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}
