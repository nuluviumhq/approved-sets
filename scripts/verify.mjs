// Checks this archive. No dependencies (Node 20+).
//   1. Every file in sets/ hashes to the CID in its name (raw CIDv1, SHA-256), and its root matches
//      index.json.
//   2. With RPC_URL (or the public RPC), every entry's transaction carries a RootUpdated event from
//      the Entrypoint with the same root and CID. That ties each document to what the chain holds.
// The Merkle root of the labels (Poseidon lean IMT) is checked by the Nuluvium SDK before every
// withdrawal; it is not recomputed here to keep this script dependency-free.
//
// Usage: node scripts/verify.mjs            (files only)
//        RPC_URL=<rpc> node scripts/verify.mjs --chain

import { readFileSync, readdirSync } from "node:fs";
import { NETWORK, ROOT_UPDATED_TOPIC, decodeRootUpdated, rawCid, rpc } from "./lib.mjs";

const index = JSON.parse(readFileSync("index.json", "utf8"));
const byCid = new Map(index.sets.map((set) => [set.cid, set]));
let problems = 0;
const fail = (message) => {
  problems += 1;
  console.error(`FAIL ${message}`);
};

for (const file of readdirSync("sets")) {
  const cid = file.replace(/\.json$/, "");
  const bytes = readFileSync(`sets/${file}`);
  if (rawCid(bytes) !== cid) fail(`${file}: content does not hash to its CID`);
  const entry = byCid.get(cid);
  if (!entry) fail(`${file}: not in index.json`);
  else if (JSON.parse(bytes.toString("utf8")).root !== entry.root) fail(`${file}: root differs from index.json`);
}
const documents = index.sets.filter((set) => set.document);
for (const set of documents) if (!readdirSync("sets").includes(`${set.cid}.json`)) fail(`set ${set.number}: ${set.document} is missing`);
console.log(`files: ${readdirSync("sets").length} documents checked against their CIDs`);

if (process.argv.includes("--chain")) {
  const url = process.env.RPC_URL || NETWORK.publicRpc;
  for (const set of index.sets) {
    const receipt = await rpc(url, "eth_getTransactionReceipt", [set.tx]);
    const log = receipt?.logs.find((item) => item.address.toLowerCase() === NETWORK.entrypoint.toLowerCase() && item.topics[0] === ROOT_UPDATED_TOPIC);
    if (!log) {
      fail(`set ${set.number}: no RootUpdated event in ${set.tx}`);
      continue;
    }
    const event = decodeRootUpdated(log.data);
    if (event.root.toString() !== set.root || event.cid !== set.cid) fail(`set ${set.number}: event in ${set.tx} names another root or CID`);
  }
  console.log(`chain: ${index.sets.length} RootUpdated events checked`);
}

if (problems) {
  console.error(`${problems} problem(s)`);
  process.exit(1);
}
console.log("all checks passed");
