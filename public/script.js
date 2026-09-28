const CONTRACT_ADDRESS = "0x326bC3E58Ea37bd288E4B15DF6848706C3ec5E4A";
const RPC_URL = "https://studio.genlayer.com/api";
const SENDER = "0xc300be09cbd35189fb4c5d9cb69d1c3f";

const form = document.querySelector("#claim-form");
const readButton = document.querySelector("#read-latest");
const preparedTitle = document.querySelector("#prepared-title");
const preparedOutput = document.querySelector("#prepared-output");
const readTitle = document.querySelector("#read-title");
const readOutput = document.querySelector("#read-output");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const claim = document.querySelector("#claim").value.trim();
  const sources = [
    document.querySelector("#source-one").value.trim(),
    document.querySelector("#source-two").value.trim(),
    document.querySelector("#source-three").value.trim(),
  ];

  if (!claim || !sources[0]) {
    preparedTitle.textContent = "Missing input";
    preparedOutput.textContent = "Add a claim and at least one source URL.";
    return;
  }

  const call = {
    contract: CONTRACT_ADDRESS,
    method: "attest",
    args: [claim, ...sources],
    explorer:
      "https://explorer-studio.genlayer.com/address/" + CONTRACT_ADDRESS,
  };

  preparedTitle.textContent = "Ready for GenLayer";
  preparedOutput.textContent = JSON.stringify(call, null, 2);
});

readButton.addEventListener("click", async () => {
  readTitle.textContent = "Reading...";
  readOutput.textContent = "Calling GenLayer Studio RPC.";

  try {
    const calldata = encodeCalldataObject({ method: "get_latest_report" });
    const data = rlpEncode([calldata, Uint8Array.from([0])]);
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "gen_call",
        params: [
          {
            type: "read",
            to: CONTRACT_ADDRESS,
            from: SENDER,
            data: bytesToHex(data),
            transaction_hash_variant: "latest-nonfinal",
          },
        ],
      }),
    });
    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message || "RPC error");
    }
    readTitle.textContent = "Contract responded";
    readOutput.textContent = JSON.stringify(payload.result, null, 2);
  } catch (error) {
    readTitle.textContent = "Read unavailable";
    readOutput.textContent =
      "The deployed contract is still linked below. RPC read failed: " +
      error.message;
  }
});

function encodeCalldataObject(value) {
  const bytes = [];
  writeValue(bytes, value);
  return Uint8Array.from(bytes);
}

function writeValue(bytes, value) {
  if (value === null) {
    bytes.push(0);
  } else if (value === false) {
    bytes.push(1);
  } else if (value === true) {
    bytes.push(2);
  } else if (Number.isInteger(value)) {
    if (value >= 0) {
      writeUleb(bytes, (value << 3) | 1);
    } else {
      writeUleb(bytes, ((-value - 1) << 3) | 2);
    }
  } else if (typeof value === "string") {
    const encoded = new TextEncoder().encode(value);
    writeUleb(bytes, (encoded.length << 3) | 4);
    bytes.push(...encoded);
  } else if (Array.isArray(value)) {
    writeUleb(bytes, (value.length << 3) | 5);
    value.forEach((item) => writeValue(bytes, item));
  } else if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    writeUleb(bytes, (keys.length << 3) | 6);
    keys.forEach((key) => {
      const encodedKey = new TextEncoder().encode(key);
      writeUleb(bytes, encodedKey.length);
      bytes.push(...encodedKey);
      writeValue(bytes, value[key]);
    });
  }
}

function writeUleb(bytes, value) {
  if (value === 0) {
    bytes.push(0);
    return;
  }
  while (value > 0) {
    let current = value & 0x7f;
    value >>= 7;
    if (value > 0) current |= 0x80;
    bytes.push(current);
  }
}

function rlpEncode(value) {
  if (Array.isArray(value)) {
    const encodedItems = value.map((item) => rlpEncode(item));
    return concatBytes(encodeLength(sumLengths(encodedItems), 0xc0), ...encodedItems);
  }
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  return concatBytes(encodeLength(bytes.length, 0x80), bytes);
}

function encodeLength(length, offset) {
  if (length < 56) return Uint8Array.from([length + offset]);
  const lengthBytes = numberToBytes(length);
  return concatBytes(Uint8Array.from([offset + 55 + lengthBytes.length]), lengthBytes);
}

function numberToBytes(value) {
  const out = [];
  while (value > 0) {
    out.unshift(value & 0xff);
    value >>= 8;
  }
  return Uint8Array.from(out);
}

function sumLengths(items) {
  return items.reduce((total, item) => total + item.length, 0);
}

function concatBytes(...items) {
  const total = sumLengths(items);
  const out = new Uint8Array(total);
  let offset = 0;
  items.forEach((item) => {
    out.set(item, offset);
    offset += item.length;
  });
  return out;
}

function bytesToHex(bytes) {
  return (
    "0x" +
    [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
