// Copies every approved set the ASP has posted on chain into sets/<cid>.json, byte for byte, and
// rebuilds index.json. Reads RootUpdated events from the Entrypoint since the deploy, fetches each
// document from the ASP and refuses any whose bytes do not hash to the CID posted on chain.
//
// Usage: RPC_URL=<your RPC> node scripts/export.mjs
// (the public RPC works where it is reachable; an RPC with a 10,000-block log limit works too)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NETWORK, ROOT_UPDATED_TOPIC, decodeRootUpdated, rawCid, rpc } from "./lib.mjs";

const RPC_URL = process.env.RPC_URL || NETWORK.publicRpc;
const CHUNK = 10_000n;
const MAX_CHUNKS = 2_000n; // safety cap: 20 million blocks per run

const latest = BigInt(await rpc(RPC_URL, "eth_blockNumber", []));
const index = existsSync("index.json") ? JSON.parse(readFileSync("index.json", "utf8")) : { sets: [] };
const known = new Set(index.sets.map((set) => set.cid));
let from = index.scannedTo ? BigInt(index.scannedTo) + 1n : NETWORK.deployBlock;
mkdirSync("sets", { recursive: true });

let chunks = 0n;
let added = 0;
for (; from <= latest && chunks < MAX_CHUNKS; from += CHUNK, chunks++) {
  const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
  const logs = await rpc(RPC_URL, "eth_getLogs", [
    { address: NETWORK.entrypoint, topics: [ROOT_UPDATED_TOPIC], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` },
  ]);
  for (const log of logs) {
    const { root, cid, timestamp } = decodeRootUpdated(log.data);
    if (known.has(cid)) continue;
    const base = { number: index.sets.length + 1, cid, root: root.toString(), postedAt: new Date(timestamp * 1000).toISOString(), block: Number(BigInt(log.blockNumber)), tx: log.transactionHash };
    // Roots posted by hand while the pool was being set up carry a label instead of a CID: listed,
    // with no document.
    if (!/^b[a-z2-7]{58}$/.test(cid)) {
      index.sets.push({ ...base, document: null, note: "posted during setup, before the ASP published documents" });
      known.add(cid);
      continue;
    }
    const response = await fetch(`${NETWORK.aspUrl}/sets/${cid}`);
    if (!response.ok) throw new Error(`ASP has no document for ${cid} (HTTP ${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (rawCid(bytes) !== cid) throw new Error(`document for ${cid} does not hash to its CID`);
    const document = JSON.parse(bytes.toString("utf8"));
    if (BigInt(document.root) !== root) throw new Error(`document ${cid} has root ${document.root}, chain says ${root}`);
    writeFileSync(`sets/${cid}.json`, bytes);
    index.sets.push({ ...base, document: `sets/${cid}.json`, approved: document.approvedLabels.length, rejected: document.rejected.length });
    known.add(cid);
    added += 1;
  }
  index.scannedTo = to.toString();
}

index.network = { name: NETWORK.name, chainId: NETWORK.chainId, entrypoint: NETWORK.entrypoint, pool: NETWORK.pool };
writeFileSync("index.json", `${JSON.stringify(index, null, 2)}\n`);
console.log(`${added} new sets, ${index.sets.length} in total, scanned to block ${index.scannedTo}${BigInt(index.scannedTo) < latest ? " (run again to continue)" : ""}`);
