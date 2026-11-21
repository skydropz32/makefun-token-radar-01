// Token Radar model radar-3: one snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and adds every other rankable pre-token protocol below the floor,
// ranked by implied value. A protocol is rankable only when it records no
// token AND passes the same exclusion the watchlist rule applies: it is not
// a wrapped, staked or bridged product of a token that already trades, not a
// centralised exchange, and not a versioned pool of another protocol. That
// matters: the snapshot's biggest "pre-token" rows by raw TVL are Bybit,
// Bitfinex, Robinhood, WBTC and Binance staked ETH - none of them is a
// protocol still waiting on a launch of its own, so ranking them would be a
// TVL table, not a radar. Live-token protocols are kept apart and shown with
// the market's own market cap, never mixed into the ranked board.
//
// Implied value is FITTED, not hand-tuned (this is what changed from
// radar-2). The peers are the snapshot's own live-token protocols with a
// recorded market cap (92 of them once the same exclusion above is applied):
//   log(mcap) = a + b * log(TVL), fit by least squares on those peers.
// The fit runs here, at runtime, on the sealed snapshot, so the numbers the
// dashboard shows are the ones this snapshot produces: a = 9.11, b = 0.39,
// R-squared 0.10, held-out rank correlation 0.36 (5-fold), 0.26 (80/20),
// 0.36 (walk-forward). That is the honest size of the signal: TVL is the
// only snapshot figure that ranks the peers at all, and market-cap LEVELS
// are not predictable from these figures (held-out R-squared around zero),
// so the model is validated on RANKING, which is what a board is.
//
// The other figures the bounty names - seven-day growth, age with no token,
// chain count, sector - enter as small bounded priors, not as fitted terms:
// their least-squares coefficients on the peers come out negative and
// unstable, and adding them makes held-out ranking WORSE (5-fold rank
// correlation 0.36 for TVL alone, 0.23 with all of them fitted), so the
// model does not pretend to fit them. Growth is a tilt of at most 15% either
// way; maturity is the same log-age curve radar-2 used (a protocol that has
// run 2 years with no token is much closer to a launch than a 2-month one);
// one extra chain adds 4%; fee-capturing markets get 1.05, allocators and
// risk curators 1.02. No protocol name is ever special-cased: the same
// function scores every row, and the dashboard recomputes each row from the
// same figures.
//
// What the fit buys: radar-2 valued the top row at $332M from
// TVL^0.92 x 0.62, a hand-tuned scale. The peers' record says the biggest
// comparable live-token protocols are worth $30M-$160M (ssv-network $29.5M
// on $10.2B of TVL, eigencloud $156M on $4.9B, babylon $48.7M on $2.8B),
// so radar-2 overvalued the top of the board about sixfold. Radar-3's top
// row is $54M, inside the peers' own range. The ranking barely moves (the
// top 10 are the same ten), which is the point: the fit corrects the scale,
// it does not invent a new order.
//
// Each row also names its three nearest live-token peers (closest in
// standardised log TVL, log age, chain count and sector), with their actual
// market caps, so a reader can see what the peers' record says about a row.

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

/** The fitted value model: log(mcap) = intercept + slope * log(TVL), fit on the peers. */
export interface ModelFit {
  method: string;
  nComps: number;
  intercept: number;
  slope: number;
  r2: number;
  cvSpearman: number;
  cvR2: number;
  holdoutR2: number;
  holdoutSpearman: number;
  walkForwardR2: number | null;
  walkForwardSpearman: number | null;
  walkForwardTrain: number;
  walkForwardTest: number;
  medianRatio: number;
  ratioP25: number;
  ratioP75: number;
}

/** The bounded priors: the figures the bounty names that the peers' record cannot fit. */
export interface ModelPriors {
  growthTilt: number;
  growthFloor: number;
  growthCap: number;
  maturityFloor: number;
  maturityRange: number;
  maturityDays: number;
  unknownAgeDays: number;
  chainStep: number;
  chainMaxExtra: number;
}

export const PRIORS: ModelPriors = {
  growthTilt: 0.15,
  growthFloor: -80,
  growthCap: 200,
  maturityFloor: 0.55,
  maturityRange: 0.45,
  maturityDays: 1095,
  unknownAgeDays: 365,
  chainStep: 0.04,
  chainMaxExtra: 4,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

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
  model: {
    growth_pct: number;
    growth_tilt: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    sector_multiplier: number;
    age_days: number | null;
    log_value: number;
  };
  farm_steps: string[];
}

/** A live-token peer: the closest recorded market caps to one board row. */
export interface NearestPeer {
  slug: string;
  name: string;
  mcap_usd: number;
  tvl_usd: number;
  dist: number;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_tilt: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  sector_multiplier: number;
  log_value: number;
  peers: NearestPeer[];
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

/** Everything the dashboard needs: the board, the live set, and the fitted model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  fit: ModelFit | null;
  priors: ModelPriors;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
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

/** A finite number, else `fallback`. */
function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Seven-day growth clamped to the model's band, so one wild week cannot dominate a row. */
function clampGrowth(rawGrowth: number, priors: ModelPriors): number {
  const lower = priors.growthFloor;
  const upper = priors.growthCap;
  if (rawGrowth < lower) return lower;
  if (rawGrowth > upper) return upper;
  return rawGrowth;
}

/** The growth tilt: a modest bounded adjustment, never a fitted driver. */
function growthTilt(growthPct: number, priors: ModelPriors): number {
  return 1 + (growthPct / 100) * priors.growthTilt;
}

/** The maturity multiplier: log age, so two years with no token counts far more than two months. */
function maturityMultiplier(ageDays: number | null, priors: ModelPriors): number {
  const age = ageDays ?? priors.unknownAgeDays;
  const capped = Math.min(Math.max(age, 0), priors.maturityDays);
  const share = Math.log(1 + capped) / Math.log(1 + priors.maturityDays);
  return priors.maturityFloor + share * priors.maturityRange;
}

/** The chain multiplier: one extra chain at a time, up to four. */
function chainMultiplier(chainCount: number, priors: ModelPriors): number {
  const extra = Math.min(Math.max(chainCount - 1, 0), priors.chainMaxExtra);
  return 1 + priors.chainStep * extra;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const listed = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(listed)) return null;
  return Math.max(0, Math.floor((start - listed) / DAY_MS));
}

/** The sector multiplier for a category: fee-capturing markets score a little higher. */
export function sectorMultiplier(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('dex') || c.includes('derivative') || c.includes('perpetual') || c.includes('yield')) return 1.05;
  if (c.includes('curator') || c.includes('allocator') || c.includes('rwa')) return 1.02;
  return 1.0;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped / staked / staking in a name: a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Exchange prefixes: a CEX product, not a protocol awaiting its own launch. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i;
/** Categories the watchlist rule excludes: bridged, staked and exchange products. */
const EXCLUDED_CATEGORIES = new Set(['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped, staked, bridged or exchange product. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category.toLowerCase())) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** Whether a protocol can be a peer for the fit: a recorded market cap, real TVL, and the same exclusion. */
function isFitComp(p: SnapshotProtocol): boolean {
  if (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd) || p.mcap_usd <= 0) return false;
  if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category.toLowerCase())) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The least-squares line of `ys` on `xs`: intercept and slope. */
function ols1(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** The share of variance a prediction explains, 1 minus residual over total. */
function rSquared(ys: number[], ps: number[]): number {
  const m = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ss = 0;
  let st = 0;
  for (let i = 0; i < ys.length; i++) {
    ss += (ys[i]! - ps[i]!) * (ys[i]! - ps[i]!);
    st += (ys[i]! - m) * (ys[i]! - m);
  }
  return st === 0 ? 0 : 1 - ss / st;
}

/** Ordinal ranks of `xs` (ties broken by order), for the rank correlation. */
function ranksOf(xs: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((i, j) => xs[i]! - xs[j]!);
  const r = new Array<number>(xs.length);
  idx.forEach((v, k) => {
    r[v] = k;
  });
  return r;
}

/** Spearman's rank correlation of two series: how well one orders the other. */
function spearman(xs: number[], ys: number[]): number {
  const rx = ranksOf(xs);
  const ry = ranksOf(ys);
  const n = xs.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) * (rx[i]! - mx);
    dy += (ry[i]! - my) * (ry[i]! - my);
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

/** The median of a sorted array, and a quantile by the same order. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[at]!;
}

/**
 * The fitted value model, computed from the snapshot's own live-token peers:
 * least squares of log(mcap) on log(TVL), with the validation the dashboard
 * shows (5-fold rank correlation, an 80/20 split, and a walk-forward split
 * by listing date). Null when too few peers carry a recorded market cap.
 */
export function fitValueModel(snapshot: Snapshot): ModelFit | null {
  const comps = snapshot.protocols.filter(isFitComp).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (comps.length < 10) return null;
  const xs = comps.map((p) => Math.log(Math.max(p.tvl_usd, 1)));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const { a, b } = ols1(xs, ys);
  const predict = (x: number): number => a + b * x;
  const full = xs.map(predict);
  // 5-fold, by slug order: each fold is the test set once.
  const cvSp: number[] = [];
  const cvR2: number[] = [];
  for (let f = 0; f < 5; f++) {
    const te = comps.map((_, i) => i).filter((i) => i % 5 === f);
    const tr = comps.map((_, i) => i).filter((i) => i % 5 !== f);
    const fold = ols1(tr.map((i) => xs[i]!), tr.map((i) => ys[i]!));
    const py = te.map((i) => fold.a + fold.b * xs[i]!);
    const ty = te.map((i) => ys[i]!);
    cvSp.push(spearman(ty, py));
    cvR2.push(rSquared(ty, py));
  }
  // 80/20: every fifth protocol by slug order is the test set.
  const te20 = comps.map((_, i) => i).filter((i) => i % 5 === 2);
  const tr20 = comps.map((_, i) => i).filter((i) => i % 5 !== 2);
  const split = ols1(tr20.map((i) => xs[i]!), tr20.map((i) => ys[i]!));
  const py20 = te20.map((i) => split.a + split.b * xs[i]!);
  const ty20 = te20.map((i) => ys[i]!);
  // Walk-forward: fit on protocols listed before 2024-06-01, test on the newer ones.
  const cut = Date.parse('2024-06-01T00:00:00Z');
  const wTr: number[] = [];
  const wTrY: number[] = [];
  const wTe: number[] = [];
  const wTeY: number[] = [];
  comps.forEach((p, i) => {
    if (p.listed_at === null) return;
    const t = Date.parse(`${p.listed_at}T00:00:00Z`);
    if (!Number.isFinite(t)) return;
    if (t < cut) {
      wTr.push(xs[i]!);
      wTrY.push(ys[i]!);
    } else {
      wTe.push(xs[i]!);
      wTeY.push(ys[i]!);
    }
  });
  let wfR2: number | null = null;
  let wfSp: number | null = null;
  if (wTr.length >= 10 && wTe.length >= 5) {
    const wf = ols1(wTr, wTrY);
    const py = wTe.map((x) => wf.a + wf.b * x);
    wfR2 = rSquared(wTeY, py);
    wfSp = spearman(wTeY, py);
  }
  const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd).sort((x, y) => x - y);
  // Full precision: the dashboard recomputes each row from these numbers and
  // must land on the same value board.json carries; it formats for display.
  return {
    method: 'ols-log-tvl',
    nComps: comps.length,
    intercept: a,
    slope: b,
    r2: rSquared(ys, full),
    cvSpearman: cvSp.reduce((s, v) => s + v, 0) / cvSp.length,
    cvR2: cvR2.reduce((s, v) => s + v, 0) / cvR2.length,
    holdoutR2: rSquared(ty20, py20),
    holdoutSpearman: spearman(ty20, py20),
    walkForwardR2: wfR2,
    walkForwardSpearman: wfSp,
    walkForwardTrain: wTr.length,
    walkForwardTest: wTe.length,
    medianRatio: quantile(ratios, 0.5),
    ratioP25: quantile(ratios, 0.25),
    ratioP75: quantile(ratios, 0.75),
  };
}

/** The multipliers and the implied value one protocol gets under `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: ModelFit | null,
  priors: ModelPriors = PRIORS,
): { implied: number; growthPct: number; growthTilt: number; maturityMult: number; chainMult: number; sectorMult: number; age: number | null; logValue: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = clampGrowth(finiteOr(protocol.change_7d, 0), priors);
  const tilt = growthTilt(growthPct, priors);
  const maturityMult = maturityMultiplier(age, priors);
  const chainMult = chainMultiplier(protocol.chains.length, priors);
  const sectorMult = sectorMultiplier(protocol.category);
  // The fitted line is the peers' value at this TVL; the priors tilt around it.
  // With no fit to speak of, fall back to radar-2's hand-tuned base.
  const logValue =
    fit === null
      ? Math.log(Math.max(Math.pow(Math.max(protocol.tvl_usd, 1), 0.92) * 0.62, 1))
      : fit.intercept + fit.slope * Math.log(Math.max(protocol.tvl_usd, 1));
  const implied = Math.max(1, Math.round(Math.exp(logValue) * tilt * maturityMult * chainMult * sectorMult));
  return { implied, growthPct, growthTilt: round4(tilt), maturityMult: round4(maturityMult), chainMult: round4(chainMult), sectorMult, age, logValue: round4(logValue) };
}

/** By slug, for a deterministic order before the model sorts anything. */
const bySlug = (a: SnapshotProtocol, b: SnapshotProtocol): number => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** Implied value first, then TVL, then slug: the board's order is never a tie. */
const byImpliedThenTvl = (a: { implied_value_usd: number; tvl_usd: number; slug: string }, b: { implied_value_usd: number; tvl_usd: number; slug: string }): number =>
  b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1);

/** The standardisation of a feature: its mean and spread across the peers. */
interface FeatureStats {
  means: number[];
  sds: number[];
}

/** The five features a nearest peer is judged on: log TVL, log age, chain count, fee, alloc. */
function peerFeatures(p: SnapshotProtocol, asOf: string): number[] {
  return [
    Math.log(Math.max(p.tvl_usd, 1)),
    Math.log(1 + (ageDays(asOf, p.listed_at) ?? 365)),
    Math.min(p.chains.length, 5),
    sectorMultiplier(p.category) === 1.05 ? 1 : 0,
    sectorMultiplier(p.category) === 1.02 ? 1 : 0,
  ];
}

/** Mean and spread of the peer features, so each one counts equally in the distance. */
function featureStats(comps: SnapshotProtocol[], asOf: string): FeatureStats {
  const rows = comps.map((p) => peerFeatures(p, asOf));
  const means = [0, 0, 0, 0, 0].map((_, k) => rows.reduce((s, r) => s + r[k]!, 0) / rows.length);
  const sds = means.map((m, k) => {
    const v = rows.reduce((s, r) => s + (r[k]! - m) * (r[k]! - m), 0) / rows.length;
    const sd = Math.sqrt(v);
    return sd > 0 ? sd : 1;
  });
  return { means, sds };
}

/** The three live-token peers closest to `p`, with their actual market caps to anchor the row. */
function nearestPeers(p: SnapshotProtocol, comps: SnapshotProtocol[], stats: FeatureStats, asOf: string): NearestPeer[] {
  const f = peerFeatures(p, asOf);
  const scored = comps.map((c) => {
    const g = peerFeatures(c, asOf);
    let d = 0;
    for (let k = 0; k < f.length; k++) {
      const diff = (f[k]! - stats.means[k]!) / stats.sds[k]! - (g[k]! - stats.means[k]!) / stats.sds[k]!;
      d += diff * diff;
    }
    return { c, dist: Math.sqrt(d) };
  });
  scored.sort((a, b) => a.dist - b.dist || (a.c.slug < b.c.slug ? -1 : 1));
  return scored.slice(0, 3).map(({ c, dist }) => ({
    slug: c.slug,
    name: c.name,
    mcap_usd: c.mcap_usd!,
    tvl_usd: c.tvl_usd,
    dist: round4(dist),
  }));
}

/** The prepared fit: the model, its peers, and their feature standardisation, computed once per run. */
interface FitPrep {
  fit: ModelFit | null;
  comps: SnapshotProtocol[];
  stats: FeatureStats | null;
}

function prepareFit(snapshot: Snapshot): FitPrep {
  const fit = fitValueModel(snapshot);
  const comps = snapshot.protocols.filter(isFitComp).sort(bySlug);
  const stats = comps.length >= 3 ? featureStats(comps, snapshot.as_of) : null;
  return { fit, comps, stats };
}

/** The ranked board: every rankable protocol, the watchlist first in the input but ranked by implied value. */
function buildBoard(snapshot: Snapshot, prep: FitPrep): BoardRow[] {
  const scored = snapshot.protocols
    .filter(isRankable)
    .map((p) => {
      const model = impliedValue(p, snapshot.as_of, prep.fit);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        mcap_usd: p.mcap_usd,
        listed_at: p.listed_at,
        gecko_id: p.gecko_id,
        symbol: p.symbol,
        token_status: 'pre-token' as const,
        age_days: model.age,
        implied_value_usd: model.implied,
        model: {
          growth_pct: model.growthPct,
          growth_tilt: model.growthTilt,
          momentum_multiplier: 1,
          maturity_multiplier: model.maturityMult,
          chain_multiplier: model.chainMult,
          sector_multiplier: model.sectorMult,
          age_days: model.age,
          log_value: model.logValue,
        },
        farm_steps: farmSteps(p, model.implied).map(stepText),
      };
    })
    .sort(byImpliedThenTvl);
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });
  return scored;
}

/** The first chain the farm plan uses: Ethereum first, else the chain the protocol lists first. */
function chainOf(chains: string[]): string {
  if (chains.length === 0) return 'ethereum';
  if (chains.some((c) => c.toLowerCase().includes('ethereum'))) return 'ethereum';
  return chains[0]!.toLowerCase();
}

/** A gas price in dollars for one transaction on the named chain. */
function gasFor(chain: string): string {
  if (chain.includes('solana')) return '$0.10';
  if (chain.includes('base') || chain.includes('arbitrum') || chain.includes('optimism') || chain.includes('polygon') || chain.includes('unichain')) return '$0.50';
  if (chain.includes('ethereum')) return '$4.00';
  return '$2.00';
}

/** The same gas price as a number, for the totals step. */
function gasDollarsFor(chain: string): number {
  return parseFloat(gasFor(chain).replace('$', ''));
}

/** How much capital this protocol is worth farming with, set by its TVL. */
function capitalFor(tvl: number): string {
  if (tvl >= 1_000_000_000) return '$10,000';
  if (tvl >= 100_000_000) return '$5,000';
  return '$1,000';
}

/** How long this protocol is worth holding for, set by its TVL: the bigger the protocol, the longer the runway. */
function holdDaysFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 60;
  if (tvl >= 100_000_000) return 30;
  return 14;
}

/** The TVL tier the farm plan varies on: large protocols run weekly, small ones monthly. */
function tvlTier(tvl: number): 'large' | 'mid' | 'small' {
  if (tvl >= 1_000_000_000) return 'large';
  if (tvl >= 100_000_000) return 'mid';
  return 'small';
}

/** The cadence a tier farms at: how often a qualifying action is needed. */
function cadenceFor(tier: 'large' | 'mid' | 'small'): { every: string; days: number } {
  if (tier === 'large') return { every: 'every week', days: 7 };
  if (tier === 'mid') return { every: 'every two weeks', days: 14 };
  return { every: 'once a month', days: 30 };
}

/** The second, different action for this protocol's plan, drawn from its name and category. */
function actionFor(protocol: SnapshotProtocol): string {
  const category = protocol.category ?? '';
  const name = protocol.name;
  if (/lend|borrow|yield|vault|allocator|curator|restaking|restake/i.test(category)) return `deposit ${capitalFor(protocol.tvl_usd)} of stables as a lender`;
  if (/dex|perp|deriv|options/i.test(category)) return `open one small hedged trade in the app`;
  if (/bridge/i.test(category)) return `move ${capitalFor(protocol.tvl_usd)} across one supported chain`;
  if (/rwa/i.test(category)) return `subscribe ${capitalFor(protocol.tvl_usd)} to the product on the app`;
  if (/stablecoin|stable/i.test(category)) return `mint ${capitalFor(protocol.tvl_usd)} of the stablecoin and hold it`;
  return `use the ${name} app at least once`;
}

/**
 * The farm plan: eight steps per protocol, the first seven matching the page's
 * list and the last one a totals summary. Steps 4 and 6 vary by TVL tier
 * (large protocols are farmed weekly, small ones monthly); the totals step
 * counts the gas across the whole plan, the capital held and the days to
 * unwind, so a reader can tell whether farming is worth it at a glance.
 */
export function farmSteps(protocol: SnapshotProtocol, implied: number): FarmStep[] {
  const tvl = protocol.tvl_usd;
  const chain = chainOf(protocol.chains);
  const gas = gasFor(chain);
  const gasN = gasDollarsFor(chain);
  const capital = capitalFor(tvl);
  const holdDays = holdDaysFor(tvl);
  const tier = tvlTier(tvl);
  const cadence = cadenceFor(tier);
  const secondAction = actionFor(protocol);
  const cadenceActions = Math.max(1, Math.round(holdDays / cadence.days));
  const gasTx = 1 + 1 + cadenceActions + 2;
  const gasTotal = gasTx * gasN;
  const totalDays = holdDays + 14;
  const cadenceNote = tier === 'small' ? 'never leave it idle for two months' : 'never leave it idle for a whole month';
  return [
    { text: `Create a fresh wallet for this airdrop and never reuse it for another protocol's farm.`, cost: '$0.00', time: '10 minutes' },
    { text: `Connect that wallet to ${protocol.name} on ${chain} and deposit ${capital} of stablecoins.`, cost: `${gas} of gas`, time: '20 minutes' },
    { text: `Then ${secondAction} on ${chain} so the wallet shows more than a deposit alone.`, cost: `${gas} of gas`, time: '20 minutes' },
    { text: `Make one qualifying action ${cadence.every} - a deposit, a borrow, a swap or a vote - so the wallet shows steady activity across snapshots; ${cadenceNote}.`, cost: `${gas} of gas per action`, time: `${holdDays} days` },
    { text: `Keep ${capital} in the protocol for ${holdDays} days and do not withdraw early, because early exits usually reset points.`, cost: '$0.00', time: `${holdDays} days` },
    { text: `Before you withdraw, open ${protocol.name}'s own points or rewards page from its app ${cadence.every} and claim only from the link it publishes; never pay anyone to claim for you.`, cost: '$0.00', time: '10 minutes' },
    { text: `Write down every transaction hash, the dates, and the balances, because airdrop support asks for proof.`, cost: '$0.00', time: '5 minutes' },
    { text: `Total for this plan: about $${gasTotal.toFixed(2)} of gas across ${gasTx} transactions, ${capital} of capital held for ${holdDays} days, plus 2 weeks to unwind. The position is worth farming while the implied value is $${implied.toLocaleString('en-US')}.`, cost: `$${gasTotal.toFixed(2)} of gas across the whole plan`, time: `${totalDays} days from first deposit to unwound` },
  ];
}

/** One farm step as the board carries it: the action, its cost and its time in one line. */
function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The live-token protocols, ordered by market cap, for the Live token view. */
function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : 1))
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

/** One board row, reshaped for the dashboard page. */
function radarRow(row: BoardRow, snapshot: Snapshot, prep: FitPrep): RadarRow {
  const p: SnapshotProtocol = {
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    gecko_id: row.gecko_id,
    symbol: row.symbol,
  };
  const peers = prep.stats === null ? [] : nearestPeers(p, prep.comps, prep.stats, snapshot.as_of);
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_tilt: row.model.growth_tilt,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    sector_multiplier: row.model.sector_multiplier,
    log_value: row.model.log_value,
    peers,
  };
}

/** The dashboard's data: the ranked board, the live set, and the fitted model. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const prep = prepareFit(snapshot);
  const board = buildBoard(snapshot, prep);
  const rows = board.map((row) => radarRow(row, snapshot, prep));
  const live = liveRows(snapshot);
  const watchlistSize = snapshot.watchlist.length;
  const earlySize = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    fit: prep.fit,
    priors: PRIORS,
    model_version: MODEL_VERSION,
    watchlist_size: watchlistSize,
    board_size: board.length,
    early_size: earlySize,
    live_size: live.length,
    rows,
    live,
  };
  return { board, radar };
}

/** Whether `v` is a plain record with only string keys. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The snapshot, from one JSON document: one object, one sealed array of protocols. */
export function parseSnapshot(text: string): Snapshot {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot is not valid JSON');
  }
  if (!isRecord(doc)) throw new SnapshotError('snapshot is not an object');
  if (typeof doc.as_of !== 'string' || doc.as_of.length === 0) throw new SnapshotError('snapshot.as_of is not a string');
  if (typeof doc.source !== 'string' || doc.source.length === 0) throw new SnapshotError('snapshot.source is not a string');
  if (typeof doc.floor_usd !== 'number' || !Number.isFinite(doc.floor_usd) || doc.floor_usd <= 0) throw new SnapshotError('snapshot.floor_usd is not a positive number');
  if (!Array.isArray(doc.protocols)) throw new SnapshotError('snapshot.protocols is not an array');
  if (doc.protocols.length === 0) throw new SnapshotError('snapshot.protocols is empty');
  if (!Array.isArray(doc.watchlist) || doc.watchlist.some((w) => typeof w !== 'string')) throw new SnapshotError('snapshot.watchlist is not an array of strings');
  const protocols: SnapshotProtocol[] = doc.protocols.map((p, i) => {
    if (!isRecord(p)) throw new SnapshotError(`protocol ${i} is not an object`);
    if (typeof p.slug !== 'string' || p.slug.length === 0) throw new SnapshotError(`protocol ${i} has no slug`);
    if (typeof p.name !== 'string' || p.name.length === 0) throw new SnapshotError(`protocol ${i} has no name`);
    if (p.category !== null && typeof p.category !== 'string') throw new SnapshotError(`protocol ${i} has a bad category`);
    if (!Array.isArray(p.chains) || p.chains.some((c) => typeof c !== 'string')) throw new SnapshotError(`protocol ${i} has bad chains`);
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd < 0) throw new SnapshotError(`protocol ${i} has a bad tvl_usd`);
    if (p.change_7d !== null && (typeof p.change_7d !== 'number' || !Number.isFinite(p.change_7d))) throw new SnapshotError(`protocol ${i} has a bad change_7d`);
    if (p.mcap_usd !== null && (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd))) throw new SnapshotError(`protocol ${i} has a bad mcap_usd`);
    if (p.listed_at !== null && typeof p.listed_at !== 'string') throw new SnapshotError(`protocol ${i} has a bad listed_at`);
    if (p.gecko_id !== null && typeof p.gecko_id !== 'string') throw new SnapshotError(`protocol ${i} has a bad gecko_id`);
    if (p.symbol !== null && typeof p.symbol !== 'string') throw new SnapshotError(`protocol ${i} has a bad symbol`);
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      // A negative market cap is DefiLlama's sentinel for "no recorded cap": treat it as unknown.
      mcap_usd: p.mcap_usd !== null && p.mcap_usd < 0 ? null : p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
    };
  });
  return {
    as_of: doc.as_of,
    source: doc.source,
    floor_usd: doc.floor_usd,
    protocols,
    watchlist: doc.watchlist as string[],
  };
}

/** The one problem with a board, else null: coverage first, then order, then value. */
export function boardIssue(snapshot: Snapshot, board: BoardRow[]): string | null {
  if (board.length === 0) return 'board is empty';
  for (const w of snapshot.watchlist) {
    if (!board.some((r) => r.slug === w)) return `watchlist slug ${w} is missing from the board`;
  }
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (row.rank !== i + 1) return `row ${row.slug} has rank ${row.rank}, expected ${i + 1}`;
    if (row.token_status !== 'pre-token') return `row ${row.slug} is not pre-token`;
    if (!Number.isFinite(row.implied_value_usd) || row.implied_value_usd < 1) return `row ${row.slug} has a bad implied value`;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.slug} has ${row.farm_steps.length} farm steps, expected 3 to 12`;
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) return `row ${row.slug} has a farm step of ${step.length} characters, expected 20 to 600`;
    }
    if (i > 0 && row.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${row.slug} is out of order`;
  }
  return null;
}

/** The dashboard's compact data: the page reads `window.RADAR`, never the sealed snapshot. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
