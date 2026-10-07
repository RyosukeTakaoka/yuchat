/* =========================================================
   ゆうダービー：固定オッズ（script.js と derby-runner の両方が読み込む共通モジュール）

   ・FIXED_ODDS_FROM 以降に開催されるレースは「固定オッズ方式」。それより前のレースは従来の山分け方式（このファイルは使わない）。
   ・オッズはレースID から再現できる乱数で決まり、投票では一切変わらない。どの端末・derby-runner でも同じ値になるよう、
     オッズの計算は四則演算と整数演算だけで行う（Math.pow / Math.log などは使わない）。
   ・払戻し ＝ floor(賭け金 × オッズ)。オッズは 0.1 倍単位の整数（例：2.5倍 → 25）で扱う。
   ・【重要】oddsVersion ごとの計算（馬の能力・人気の表、係数、式）は、一度公開したら変えない。
     変えるときは新しい oddsVersion を追加し、その開始日以降のレースにだけ使う（過去のレースのオッズが変わらないように）。
   ・レース結果（着順）は、発走時刻を過ぎてから Math.random() で決める（generateRaceOrderV1）。オッズから結果は分からない。

   FIXED_ODDS_FROM は firestore.rules の isFixedOddsRaceId とも合わせること。
========================================================= */

/* この日（日本時間・レースIDの日付）以降のレースから固定オッズ方式 */
export const FIXED_ODDS_FROM = "2026-10-09";

export const BET_TYPES = ["win", "place", "quinella", "trio", "trifecta"];

/* 払戻しの記録に付ける目印（firestore.rules で、固定オッズ方式のレースはこの目印の付いた精算だけ認める） */
export const FIXED_PAYOUT_RULE = "fixed-v1";

/* ---------- oddsVersion 1（変更禁止） ---------- */

const V1 = Object.freeze({
  /* 馬番号・能力・人気（ファン人気）の表 */
  horses: Object.freeze([
    { number: 1, power: 6, fan: 0.5 },
    { number: 2, power: 7, fan: 0.4 },
    { number: 3, power: 8, fan: 0.5 },
    { number: 4, power: 5, fan: 0.3 },
    { number: 5, power: 9, fan: 0.8 },
    { number: 6, power: 4, fan: 0.5 },
    { number: 7, power: 6, fan: 0.4 },
    { number: 8, power: 3, fan: 0.6 },
    { number: 9, power: 7, fan: 1.0 },
    { number: 10, power: 8, fan: 0.6 }
  ].map(Object.freeze)),
  returnRate: 0.8,          /* 還元率（従来の 0.8 と同じ） */
  condMin: 0.75,            /* 当日の調子：0.75〜1.30 */
  condRange: 0.55,
  popShade: 0.05,           /* 人気補正：1番人気 0.95 〜 10番人気 1.00（オッズを下げるだけ） */
  minTenths: 11,            /* 下限 1.1倍 */
  capTenths: Object.freeze({ win: 999, place: 999, quinella: 4999, trio: 4999, trifecta: 9999 })
});

function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* 整数演算だけの乱数（mulberry32） */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* レースごとの値（当日の調子・人気順）。races/{raceId} に保存して、精算・表示はこの値から計算し直す */
function computeRaceParamsV1(raceId) {
  const random = seededRandom(hash32(`v1:${raceId}`));
  const cond = V1.horses.map(() => Math.round((V1.condMin + V1.condRange * random()) * 100) / 100);
  const strength = V1.horses.map((h, i) => h.power * cond[i]);
  const maxStrength = Math.max(...strength);
  const popScore = V1.horses.map((h, i) => 0.6 * strength[i] / maxStrength + 0.3 * h.fan + 0.1 * random());
  const order = V1.horses.map((_, i) => i).sort((a, b) => popScore[b] - popScore[a] || a - b);
  const popRank = new Array(V1.horses.length);
  order.forEach((i, k) => { popRank[i] = k + 1; });
  return { oddsVersion: 1, cond, popRank };
}

function toTenthsV1(probability, shade, type) {
  let tenths = Math.floor(V1.returnRate * shade / probability * 10);
  if (tenths > V1.capTenths[type]) tenths = V1.capTenths[type];
  if (tenths < V1.minTenths) tenths = V1.minTenths;
  return tenths;
}

/* 5券種すべてのオッズ（0.1倍単位の整数）と確率。キーは馬番号（単勝・複勝）または "a-b" / "a-b-c" */
function buildOddsTableV1(params) {
  const horses = V1.horses;
  const n = horses.length;
  const strength = horses.map((h, i) => h.power * params.cond[i]);
  let total = 0;
  for (let i = 0; i < n; i++) total += strength[i];
  const shade = params.popRank.map((rank) => 1 - V1.popShade * (n - rank) / (n - 1));

  const table = { oddsVersion: 1, win: {}, place: {}, quinella: {}, trio: {}, trifecta: {}, probability: { win: {}, place: {}, quinella: {}, trio: {}, trifecta: {} }, popRank: {} };
  const placeP = new Array(n).fill(0);
  const quinellaP = {};
  const trioP = {};

  /* 三連単：1着 a・2着 b・3着 c の確率 ＝ 強さa/合計 × 強さb/(合計−強さa) × 強さc/(合計−強さa−強さb) */
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        const p = (strength[a] / total) * (strength[b] / (total - strength[a])) * (strength[c] / (total - strength[a] - strength[b]));
        const key = `${horses[a].number}-${horses[b].number}-${horses[c].number}`;
        table.probability.trifecta[key] = p;
        table.trifecta[key] = toTenthsV1(p, (shade[a] + shade[b] + shade[c]) / 3, "trifecta");
        placeP[a] += p; placeP[b] += p; placeP[c] += p;
        const [q1, q2] = a < b ? [a, b] : [b, a];
        const qKey = `${horses[q1].number}-${horses[q2].number}`;
        quinellaP[qKey] = (quinellaP[qKey] || 0) + p;
        const [t1, t2, t3] = [a, b, c].sort((x, y) => x - y);
        const tKey = `${horses[t1].number}-${horses[t2].number}-${horses[t3].number}`;
        trioP[tKey] = (trioP[tKey] || 0) + p;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const num = horses[i].number;
    const p = strength[i] / total;
    table.probability.win[num] = p;
    table.win[num] = toTenthsV1(p, shade[i], "win");
    table.probability.place[num] = placeP[i];
    table.place[num] = toTenthsV1(placeP[i], shade[i], "place");
    table.popRank[num] = params.popRank[i];
  }
  const indexOf = (num) => horses.findIndex((h) => h.number === num);
  for (const [key, p] of Object.entries(quinellaP)) {
    const [x, y] = key.split("-").map(Number).map(indexOf);
    table.probability.quinella[key] = p;
    table.quinella[key] = toTenthsV1(p, (shade[x] + shade[y]) / 2, "quinella");
  }
  for (const [key, p] of Object.entries(trioP)) {
    const [x, y, z] = key.split("-").map(Number).map(indexOf);
    table.probability.trio[key] = p;
    table.trio[key] = toTenthsV1(p, (shade[x] + shade[y] + shade[z]) / 3, "trio");
  }
  return table;
}

/* 実際のレース結果：強さ（能力 × 当日の調子）の比で着順が決まる。乱数は発走時刻を過ぎてから Math.random() で引く
   （random(1/強さ乗) の大きい順＝強さの比で1着から順に選ぶのと同じ確率） */
function generateRaceOrderV1(params, random = Math.random) {
  const keyed = V1.horses.map((h, i) => ({ number: h.number, key: Math.pow(random(), 1 / (h.power * params.cond[i])) }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.map((h) => h.number);
}

/* ---------- 版の切り替え ---------- */

const VERSIONS = { 1: { params: computeRaceParamsV1, table: buildOddsTableV1, order: generateRaceOrderV1 } };

/* そのレースの oddsVersion（0 ＝ 従来の山分け方式） */
export function getOddsVersionForRace(raceId) {
  return String(raceId || "").slice(0, 10) >= FIXED_ODDS_FROM ? 1 : 0;
}

export function isFixedOddsRace(raceId) {
  return getOddsVersionForRace(raceId) > 0;
}

/* レースごとの値（当日の調子・人気順）。版はレースIDの日付で決まり、値はレースIDから計算し直す。
   races/{raceId} にも同じ値を記録するが、races はブラウザから書けるので、精算・表示には保存値ではなく計算し直した値を使う
   （版ごとの計算を変えないので、何度計算し直しても同じ値になる） */
export function getRaceOddsParams(raceId) {
  const version = getOddsVersionForRace(raceId);
  if (!VERSIONS[version]) return null;
  return VERSIONS[version].params(raceId);
}

const tableCache = new Map();

/* そのレースのオッズ表（固定オッズ方式でなければ null） */
export function getRaceOddsTable(raceId) {
  const params = getRaceOddsParams(raceId);
  if (!params) return null;
  const cacheKey = `${raceId}|${params.oddsVersion}|${params.cond.join(",")}|${params.popRank.join(",")}`;
  if (!tableCache.has(cacheKey)) {
    if (tableCache.size > 50) tableCache.clear();
    tableCache.set(cacheKey, VERSIONS[params.oddsVersion].table(params));
  }
  return tableCache.get(cacheKey);
}

/* 馬券1枚のオッズ（0.1倍単位の整数）。馬の選び方が正しくなければ null */
export function getTicketOddsTenths(table, type, horses) {
  if (!table || !Array.isArray(horses)) return null;
  const h = horses.map(Number);
  if (type === "win" || type === "place") return h.length === 1 ? table[type][h[0]] ?? null : null;
  if (type === "quinella") return h.length === 2 ? table.quinella[[...h].sort((x, y) => x - y).join("-")] ?? null : null;
  if (type === "trio") return h.length === 3 ? table.trio[[...h].sort((x, y) => x - y).join("-")] ?? null : null;
  if (type === "trifecta") return h.length === 3 ? table.trifecta[h.join("-")] ?? null : null;
  return null;
}

/* 払戻し ＝ floor(賭け金 × オッズ)（整数どうしの計算なので端数の誤差は出ない） */
export function computeFixedPayout(amount, oddsTenths) {
  const a = Math.floor(Number(amount) || 0);
  const t = Math.floor(Number(oddsTenths) || 0);
  if (a <= 0 || t <= 0) return 0;
  return Math.floor((a * t) / 10);
}

export function formatOddsTenths(tenths) {
  const t = Math.floor(Number(tenths) || 0);
  return `${Math.floor(t / 10)}.${t % 10}`;
}

/* races/{raceId} に保存する値（結果を作るときに一緒に書く） */
export function buildRaceOddsRecord(raceId) {
  const params = getRaceOddsParams(raceId);
  if (!params) return {};
  const table = VERSIONS[params.oddsVersion].table(params);
  const numbers = V1.horses.map((h) => h.number);
  return {
    oddsVersion: params.oddsVersion,
    oddsCond: params.cond,
    oddsPopRank: params.popRank,
    oddsWinTenths: numbers.map((n) => table.win[n]),
    oddsPlaceTenths: numbers.map((n) => table.place[n])
  };
}

/* 固定オッズ方式のレースの着順（発走時刻を過ぎてから呼ぶ。Math.random() を使う） */
export function generateFixedOddsRaceOrder(raceId, random = Math.random) {
  const params = getRaceOddsParams(raceId);
  if (!params) return null;
  return VERSIONS[params.oddsVersion].order(params, random);
}

/* 精算の計算（アプリ・derby-runner 共通）：的中なら floor(賭け金 × オッズ)、外れは 0 */
export function computeFixedBetSettlement(bet, raceId, isWin) {
  const table = getRaceOddsTable(raceId);
  const oddsTenths = getTicketOddsTenths(table, bet.type, bet.horses);
  if (oddsTenths === null) return { isWin: false, payout: 0, oddsTenths: null };
  return { isWin, payout: isWin ? computeFixedPayout(bet.amount, oddsTenths) : 0, oddsTenths };
}
