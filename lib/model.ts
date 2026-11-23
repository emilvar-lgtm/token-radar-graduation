// Graduation Radar — a token launch radar built around one question:
// which pre-token protocol is closest to "graduating", i.e. issuing a token?
//
// The snapshot says nothing about airdrops or launches. This model predicts
// graduation from the snapshot's own figures only: how big a protocol is, how
// fast its TVL is moving, how long it has run without a token, and how many
// chains it spans. No protocol name is ever special-cased: the same function
// scores every row, and the dashboard shows every input that went into each
// protocol's number so a reader can check the claim.
//
//   scale      = log10(tvl_usd / floor_usd), clamped to [0, 2]
//   momentum   = clamp(change_7d, -50, 100), mapped to [0, 1]
//   staying    = min(age_days, 1095) / 1095            (age unknown: 365)
//   breadth    = min(chains, 8) / 8
//   z          = -1.35 + 1.25*scale + 0.95*momentum + 0.75*staying
//                + 0.55*breadth + categoryTilt
//   pGrad      = 1 / (1 + exp(-z)), clamped to [0.02, 0.97]
//   implied    = tvl_usd * 0.30 * (0.50 + pGrad)
//                * (1 + clamp(change_7d, -60, 120)/100 * 0.6)
//                * (0.60 + staying * 0.40) * (0.95 + breadth * 0.15)
//
// pGrad is the graduation probability: the chance the protocol issues a token
// while its record stays as it is. The implied value is the token's value if
// it graduates at today's record — big, fast-growing, long-lived,
// multi-chain protocols graduate first and are worth the most. The estimated
// window (3–6, 6–12, 12–18 or 18–24+ months) is a bucket of pGrad, not a date.
//
// The board covers every watchlist slug (the floor, never the ceiling) and
// adds pre-token protocols below the floor ranked by graduation score
// (pGrad * log TVL), the early graduates the radar exists to find. Live-token
// protocols are kept apart: their market cap is the market's own value, never
// a model's, and they are shown as a reference table only.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  p_offset: number;
  p_scale: number;
  p_momentum: number;
  p_staying: number;
  p_breadth: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  p_offset: -1.35,
  p_scale: 1.25,
  p_momentum: 0.95,
  p_staying: 0.75,
  p_breadth: 0.55,
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_days: 1095,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'graduation-1';

/** How many pre-token protocols below the watchlist floor the early radar carries. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the reference table carries, by market cap. */
export const LIVE_ROWS = 24;

/** Graduation tiers, from the probability. */
export type GradTier = 'soon' | 'watch' | 'early';

export function tierOf(p: number): GradTier {
  if (p >= 0.6) return 'soon';
  if (p >= 0.35) return 'watch';
  return 'early';
}

export function tierLabel(t: GradTier): string {
  if (t === 'soon') return 'Graduating soon';
  if (t === 'watch') return 'On watch';
  return 'Early';
}

/** The estimated graduation window, a bucket of the probability, never a date. */
export function windowOf(p: number): string {
  if (p >= 0.7) return '3–6 months';
  if (p >= 0.5) return '6–12 months';
  if (p >= 0.35) return '12–18 months';
  return '18–24+ months';
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  graduation_probability: number;
  graduation_tier: GradTier;
  graduation_window: string;
  model: {
    base_multiple: number;
    scale_signal: number;
    momentum_signal: number;
    staying_signal: number;
    breadth_signal: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  graduation_probability: number;
  graduation_tier: GradTier;
  graduation_window: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  tier_counts: { soon: number; watch: number; early: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * A category's tilt on graduation, from the category alone — never a name.
 * Lending, trading and perps venues graduate on usage; bridges and staking
 * wrappers rarely issue a second token, so they tilt down.
 */
export function categoryTilt(p: SnapshotProtocol): number {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 0.15;
  if (c.includes('dex') || c.includes('perpetual') || c.includes('derivative')) return 0.15;
  if (c.includes('yield') || c.includes('leveraged farm')) return 0.1;
  if (c.includes('rwa')) return 0.1;
  if (c.includes('bridge')) return -0.2;
  if (c.includes('staking') || c.includes('restak')) return -0.2;
  if (c.includes('liquid staking')) return -0.25;
  return 0;
}

/** The graduation signals, probability and implied value one protocol gets under `model`. */
export function graduate(
  protocol: SnapshotProtocol,
  asOf: string,
  floorUsd: number,
  model: ModelConstants,
): {
  probability: number;
  implied: number;
  scale: number;
  momentum: number;
  staying: number;
  breadth: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const scale = clamp(Math.log10(Math.max(protocol.tvl_usd, 1) / Math.max(floorUsd, 1)) / 2, 0, 1);
  const rawGrowth = finite(protocol.change_7d, 0);
  const momentum = clamp((clamp(rawGrowth, -50, 100) + 50) / 150, 0, 1);
  const staying = clamp(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days, 0, 1);
  const breadth = clamp(protocol.chains.length / 8, 0, 1);
  const z =
    model.p_offset +
    model.p_scale * scale +
    model.p_momentum * momentum +
    model.p_staying * staying +
    model.p_breadth * breadth +
    categoryTilt(protocol);
  const probability = clamp(1 / (1 + Math.exp(-z)), 0.02, 0.97);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = model.maturity_floor + staying * (1 - model.maturity_floor);
  const breadthMult = 0.95 + breadth * 0.15;
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * model.base_multiple * (0.5 + probability) * growthMult * maturityMult * breadthMult),
  );
  return { probability, implied, scale, momentum, staying, breadth, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, ranked by
  // graduation score (probability x log TVL) — not by TVL alone — capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => {
      const g = graduate(p, snapshot.as_of, snapshot.floor_usd, model);
      return { p, score: g.probability * Math.log10(Math.max(p.tvl_usd, 1)) };
    })
    .sort((a, b) => b.score - a.score || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const g = graduate(p, snapshot.as_of, snapshot.floor_usd, model);
    return { p, g };
  });
  scored.sort((a, b) => b.g.implied - a.g.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const prob = round4(s.g.probability);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.g.age,
      implied_value_usd: s.g.implied,
      graduation_probability: prob,
      graduation_tier: tierOf(prob),
      graduation_window: windowOf(prob),
      model: {
        base_multiple: model.base_multiple,
        scale_signal: round4(s.g.scale),
        momentum_signal: round4(s.g.momentum),
        staying_signal: round4(s.g.staying),
        breadth_signal: round4(s.g.breadth),
        growth_multiplier: round4(s.g.growthMult),
        maturity_multiplier: round4(s.g.maturityMult),
        age_days: s.g.age,
      },
      farm_steps: farmSteps(s.p, s.g.age, tierOf(prob)).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age and graduation tier. */
function holdDaysFor(age: number | null, tier: GradTier): number {
  if (tier === 'soon') return 21;
  if (tier === 'early') return 90;
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** How often to act, from the graduation tier: soon means weekly, early means monthly. */
function cadenceFor(tier: GradTier): string {
  if (tier === 'soon') return 'every week';
  if (tier === 'watch') return 'every two weeks';
  return 'once a month';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is tuned to the graduation tier — a protocol graduating soon gets
 * front-loaded weekly activity, an early one gets a cheap long hold — and is
 * otherwise derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, tier: GradTier): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, tier);
  const cadence = cadenceFor(tier);
  const action = actionFor(p, capital, chain);
  const urgency =
    tier === 'soon'
      ? 'Graduation looks near, so act now and keep the position active every week.'
      : tier === 'watch'
        ? 'Graduation is plausible within a year, so build a steady record of activity.'
        : 'Graduation looks distant, so keep the position cheap and let time do the work.';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. ${urgency}`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Repeat one qualifying action ${cadence}, such as a deposit, a borrow, a swap or a vote, so the wallet shows a live pattern.`,
      cost: 'about $2 of gas each time',
      time: '10 minutes each time',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's reference table. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    graduation_probability: row.graduation_probability,
    graduation_tier: row.graduation_tier,
    graduation_window: row.graduation_window,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const tier_counts = {
    soon: board.filter((r) => r.graduation_tier === 'soon').length,
    watch: board.filter((r) => r.graduation_tier === 'watch').length,
    early: board.filter((r) => r.graduation_tier === 'early').length,
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    tier_counts,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
