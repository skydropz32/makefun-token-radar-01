# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/skydropz32/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/skydropz32/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: pre-token protocols ranked by implied value, with a farm plan for each. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

The radar-3 model scores every protocol from the sealed DefiLlama snapshot alone: its value line is fitted, not hand-tuned — log(market cap) = 9.11 + 0.39 × log(TVL), fit by least squares on the snapshot's own 92 live-token peers, with a held-out rank correlation of 0.36 (5-fold) and 0.43 (80/20). Seven-day growth enters as a bounded tilt of at most 15%, log age since first listing, multi-chain reach and sector as small priors. Wrapped, staked, bridged and exchange products are excluded from the ranking, the same rule the watchlist uses — the snapshot's biggest "pre-token" rows by raw TVL are exchanges and wrapped assets, not protocols awaiting a launch. The board covers all 40 watchlist protocols plus 158 early pre-token protocols below the $50M floor: 198 rows in all. Live-token protocols are set aside with their market caps, never mixed into the ranking. Each row names its three nearest live-token peers, with their actual market caps, so the fitted line can be checked against the peers' record.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes `board.json`, the dashboard data and `dossier.json` to the output directory. Open `out/dashboard/index.html` in a browser: the board is sortable and filterable by category, chain and minimum TVL, every row opens a detail view with the model's inputs, its nearest peers and an eight-step farm plan with costs and times, ending in a totals summary.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
