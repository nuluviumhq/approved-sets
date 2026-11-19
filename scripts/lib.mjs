// Shared helpers, no dependencies (Node 20+): JSON-RPC, RootUpdated decoding, CID check.

import { createHash } from "node:crypto";

export const NETWORK = {
  name: "Robinhood Chain testnet",
  chainId: 46630,
  entrypoint: "0x1C7Bd821a61A90BA06e21aac4e03640E3D065536",
  pool: "0x2B38bF53acc21a51603E68f5BC3bC8943B01fD4a",
  deployBlock: 153_603_397n,
  explorer: "https://explorer.testnet.chain.robinhood.com",
  aspUrl: "https://asp.nuluvium.com",
  publicRpc: "https://rpc.testnet.chain.robinhood.com",
};

/** keccak256("RootUpdated(uint256,string,uint256)"): the Entrypoint event that posts a root and its CID. */
export const ROOT_UPDATED_TOPIC = "0xf43641373d5bc20fddfffcd0496fd39bde41e1aa0ce326d8899b7e658261ac02";

export async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  // Only the RPC's error text; the URL (which may hold an API key) is never printed.
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/** RootUpdated data is abi.encode(uint256 root, string ipfsCID, uint256 timestamp). */
export function decodeRootUpdated(data) {
  const hex = data.slice(2);
  const word = (index) => BigInt(`0x${hex.slice(index * 64, index * 64 + 64)}`);
  const root = word(0);
  const stringOffset = Number(word(1)) / 32;
  const timestamp = Number(word(2));
  const length = Number(word(stringOffset));
  const start = (stringOffset + 1) * 64;
  const cid = Buffer.from(hex.slice(start, start + length * 2), "hex").toString("utf8");
  return { root, cid, timestamp };
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** Raw CIDv1 (base32, raw codec, SHA-256) of some bytes, as the ASP computes it. */
export function rawCid(bytes) {
  const digest = createHash("sha256").update(bytes).digest();
  const input = Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), digest]);
  let output = "b";
  let buffer = 0;
  let bits = 0;
  for (const byte of input) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(buffer << (5 - bits)) & 31];
  return output;
}
