# approved-sets

Every approved set that the Nuluvium approved-set provider (ASP) has posted on chain, byte for byte.

A deposit into the Nuluvium pool can pay for trades only once the ASP has put it in an approved set:
the depositor is checked against the OFAC sanctions list, the stock token issuer's blocklist, our
own denylist and the beta caps. The ASP publishes each set as a JSON document and posts its Merkle
root and content ID (CID) on chain with the Privacy Pools Entrypoint (`RootUpdated` event). Every
withdrawal proves its deposit is in the latest set.

This repository keeps a public copy of all of them, so anyone can see what was approved, what was
not and why, and check it against the chain without trusting our servers.

**Testnet** (Robinhood Chain testnet, chain 46630, test tokens). Entrypoint
[`0x1C7Bd821…5536`](https://explorer.testnet.chain.robinhood.com/address/0x1C7Bd821a61A90BA06e21aac4e03640E3D065536),
pool [`0x2B38bF53…fD4a`](https://explorer.testnet.chain.robinhood.com/address/0x2B38bF53acc21a51603E68f5BC3bC8943B01fD4a).

## Files

| Path | What |
|---|---|
| `sets/<cid>.json` | A set document exactly as the ASP served it. Its SHA-256 is the CID in the file name. |
| `index.json` | Every root posted on chain: number, CID, root, approved and not-approved counts, time, block, transaction. |
| `scripts/export.mjs` | Adds new sets: reads `RootUpdated` events since the last run and fetches each document from the ASP, refusing any that does not hash to its CID or carry the root posted on chain. |
| `scripts/verify.mjs` | Checks the archive (below). |

Set 1 was posted by hand while the pool was being set up, before the ASP published documents: it is
listed in `index.json` with no document.

A document holds the rules it was screened with, the approved deposit labels (`approvedLabels`), the
deposits not approved with the reason (`rejected`), the root and its time. Labels identify deposits,
which are public on chain anyway; nothing here says which trades a deposit paid for.

## Check it yourself

Node.js 20 or newer, no install:

```sh
node scripts/verify.mjs                 # every file hashes to its CID and matches index.json
node scripts/verify.mjs --chain         # every entry matches the RootUpdated event in its transaction
```

`--chain` uses the public Robinhood Chain testnet RPC; set `RPC_URL` to use your own. The Merkle
root of the labels is checked by the [Nuluvium SDK](https://github.com/nuluviumhq/nuluvium/tree/main/sdk)
before every withdrawal and is not recomputed here (it needs a Poseidon library).

## Links

- How the ASP screens deposits: [asp/](https://github.com/nuluviumhq/nuluvium/tree/main/asp) in the main repository
- Live totals, including approved and not-approved counts: [stats](https://nuluvium.com/stats)
- The ASP's own copy: `https://asp.nuluvium.com/sets/<cid>`

License: Apache-2.0.
