# token-radar-graduation

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/emilvar-lgtm/token-radar-graduation/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/emilvar-lgtm/token-radar-graduation/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Graduation Radar: a token launch radar that predicts which pre-token protocol issues a token next — and what that token would be worth if it graduates at today's record.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, scores every pre-token protocol with the graduation model in `lib/model.ts`, writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, and copies `dashboard/` and `screenshots/` to `out/`, plus `out/dossier.json`.

## The model

Four signals from the snapshot's own figures — scale (TVL vs the $50M floor), momentum (7-day TVL change), staying power (days listed with no token), breadth (chains spanned) — feed a graduation probability `p`. Implied value = TVL × 0.30 × (0.50 + p) × growth × maturity × breadth. The estimated window (3–6, 6–12, 12–18 or 18–24+ months) is a bucket of `p`, never a date. No protocol name is special-cased. The board covers all 40 watchlist protocols plus 200 early finds below the floor, ranked by graduation score. Live-token protocols are shown separately as a reference table at their market caps, never ranked.

The dashboard is a static page (no network): sortable and filterable board, a detail view per protocol with the model's signal breakdown and a six-step farm plan, and a live-token reference table.

---

<sub>Entered on [make.fun](https://make.fun/?ref=emilvar-lgtm&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
