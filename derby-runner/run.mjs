/* =========================================================
   ゆうダービー 自動開催（GitHub Actions から毎日実行）

   誰もサイトを開いていなくても、開催時刻を過ぎたレースについて
     1. races/{raceId} にレース結果を作る（まだ無ければ）
     2. そのレースの未精算の馬券をすべて精算し、当たった人のコインを増やす
     3. raceLogs/{raceId} に開催ログを残す
   を行う。サイトを開いている利用者の端末も同じ処理を行うが、
   どちらもトランザクションで「まだ無ければ作る」「未精算なら精算する」ので二重にはならない。

   レースの作り方・払い戻しの計算は script.js と同じ（変えるときは両方を直すこと）。

   環境変数：
     FIREBASE_SERVICE_ACCOUNT  サービスアカウントの鍵（JSON）。GitHub Secrets に登録する
     FIRESTORE_EMULATOR_HOST   テスト用（Emulator を使うとき）
     DERBY_NOW                 テスト用（現在時刻を ISO 形式で上書き）
     DERBY_WAIT_FOR_RACE       "1" なら、今日の開催時刻の前に起動したときは開催時刻まで待ってから実行する
                               （GitHub の定期実行は15〜20分ほど遅れるので、早めに起動して待つ）
     GITHUB_STEP_SUMMARY       GitHub Actions が設定する。実行結果の表をここに書き出す
========================================================= */

import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

/* ----- script.js と同じ設定 ----- */
const RACE_HOUR = 15;
const RACE_MINUTE = 2;
const RACE_TAKEOUT_RATE = 0.8;
const RACE_SEGMENTS = 48;
const SAFE_RACE_HORSES = [
  { number: 1, name: "ユウウキ", power: 6, style: "start" },
  { number: 2, name: "ユウセイ", power: 7, style: "front" },
  { number: 3, name: "ユウヤン", power: 8, style: "mid" },
  { number: 4, name: "ユウチュウ", power: 5, style: "closer" },
  { number: 5, name: "ユウガ", power: 9, style: "stamina" },
  { number: 6, name: "ユウバエ", power: 4, style: "front" },
  { number: 7, name: "ユウキカイ", power: 6, style: "stamina" },
  { number: 8, name: "ユウマグレ", power: 3, style: "longshot" },
  { number: 9, name: "ユウジン", power: 7, style: "front" },
  { number: 10, name: "ユウシャ", power: 8, style: "closer" }
];

/* 開催時刻は日本時間。何日前までさかのぼって「作られていないレース・未精算の馬券」を処理するか */
const JST_OFFSET_HOURS = 9;
const LOOKBACK_DAYS = 7;

/* 早めに起動したとき、最大でどれだけ開催時刻まで待つか（GitHub Actions の1ジョブは最長6時間） */
const MAX_WAIT_MINUTES = 80;

/* ----- レース結果の生成（script.js と同じ） ----- */

function generateWeightedRaceOrder() {
  const withKey = SAFE_RACE_HORSES.map((h) => {
    const effectivePower = Math.max(0.1, h.power * (0.4 + Math.random() * 1.3));
    const key = Math.pow(Math.random(), 1 / effectivePower);
    return { number: h.number, key };
  });
  withKey.sort((a, b) => b.key - a.key);
  return withKey.map((h) => h.number);
}

function getStyleCurveMultiplier(style, frac) {
  switch (style) {
    case "start": return frac < 0.3 ? 1.5 : (frac < 0.7 ? 1.0 : 0.7);
    case "front": return frac < 0.5 ? 1.25 : 0.9;
    case "mid": return frac < 0.3 ? 0.8 : (frac < 0.75 ? 1.2 : 1.1);
    case "closer": return frac < 0.6 ? 0.65 : 1.6;
    case "stamina": return 1.0;
    case "longshot": return 0.5 + Math.random() * 1.3;
    default: return 1.0;
  }
}

function buildRaceCheckpoints(resultOrder) {
  const gapStep = 0.015 + Math.random() * 0.025;
  const finalProgress = {};

  resultOrder.forEach((horseNumber, rankIndex) => {
    finalProgress[horseNumber] = Math.max(0.7, 1 - rankIndex * gapStep);
  });
  finalProgress[resultOrder[0]] = 1;

  const rawWeights = {};
  SAFE_RACE_HORSES.forEach((h) => {
    rawWeights[h.number] = Array.from({ length: RACE_SEGMENTS }, (_, s) => {
      const frac = s / RACE_SEGMENTS;
      return getStyleCurveMultiplier(h.style, frac) * (0.3 + Math.random());
    });
  });

  SAFE_RACE_HORSES.forEach((h) => {
    const total = rawWeights[h.number].reduce((a, b) => a + b, 0);
    const scale = finalProgress[h.number] / total;
    rawWeights[h.number] = rawWeights[h.number].map((w) => w * scale);
  });

  const cumulative = {};
  SAFE_RACE_HORSES.forEach((h) => { cumulative[h.number] = 0; });

  const checkpoints = [];
  for (let s = 0; s < RACE_SEGMENTS; s++) {
    const frame = {};
    SAFE_RACE_HORSES.forEach((h) => {
      cumulative[h.number] += rawWeights[h.number][s];
      frame[h.number] = Math.min(1, Number(cumulative[h.number].toFixed(4)));
    });
    checkpoints.push(frame);
  }

  return checkpoints;
}

function formatRaceTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function getMarginLabel(gapSeconds) {
  if (gapSeconds < 0.05) return "ハナ";
  if (gapSeconds < 0.12) return "アタマ";
  if (gapSeconds < 0.2) return "クビ";
  if (gapSeconds < 0.35) return "1/2馬身";
  if (gapSeconds < 0.55) return "3/4馬身";
  if (gapSeconds < 0.8) return "1馬身";
  if (gapSeconds < 1.2) return "1馬身1/2";
  if (gapSeconds < 1.8) return "2馬身";
  return `${Math.round(gapSeconds / 0.8)}馬身`;
}

function buildFinishStats(resultOrder) {
  let currentSeconds = 116 + Math.random() * 10;
  const stats = [{ number: resultOrder[0], seconds: currentSeconds, gapSeconds: 0 }];

  for (let i = 1; i < resultOrder.length; i++) {
    const gapSeconds = 0.05 + Math.random() * 0.55;
    currentSeconds += gapSeconds;
    stats.push({ number: resultOrder[i], seconds: currentSeconds, gapSeconds });
  }

  return stats.map((s, index) => ({
    number: s.number,
    timeText: formatRaceTime(s.seconds),
    marginText: index === 0 ? "" : getMarginLabel(s.gapSeconds)
  }));
}

/* ----- 的中判定・払い戻し（script.js と同じ） ----- */

function evaluateBetWin(bet, resultOrder) {
  const top1 = resultOrder[0], top2 = resultOrder[1], top3 = resultOrder[2];
  const top3set = [top1, top2, top3];
  const horses = bet.horses || [];

  if (bet.type === "win") return horses[0] === top1;
  if (bet.type === "place") return top3set.includes(horses[0]);

  if (bet.type === "quinella") {
    if (horses.length !== 2) return false;
    const a = [...horses].sort((x, y) => x - y);
    const b = [top1, top2].sort((x, y) => x - y);
    return a[0] === b[0] && a[1] === b[1];
  }

  if (bet.type === "trio") {
    if (horses.length !== 3) return false;
    const a = [...horses].sort((x, y) => x - y);
    const b = [...top3set].sort((x, y) => x - y);
    return a.every((n, i) => n === b[i]);
  }

  if (bet.type === "trifecta") {
    return horses.length === 3 && horses[0] === top1 && horses[1] === top2 && horses[2] === top3;
  }

  return false;
}

/* パリミュチュエル方式：同じ券種の賭け金の合計 × 0.8 を、当たった人で賭け金に応じて分ける */
function computePayouts(allBets, resultOrder) {
  const pools = {};
  allBets.forEach((bet) => {
    const pool = pools[bet.type] || (pools[bet.type] = { total: 0, winning: 0 });
    const amount = Number(bet.amount || 0);
    pool.total += amount;
    if (evaluateBetWin(bet, resultOrder)) pool.winning += amount;
  });

  const payouts = {};
  allBets.forEach((bet) => {
    const pool = pools[bet.type];
    const isWin = evaluateBetWin(bet, resultOrder);
    const payout = isWin && pool.winning > 0
      ? Math.floor((Number(bet.amount || 0) / pool.winning) * pool.total * RACE_TAKEOUT_RATE)
      : 0;
    payouts[bet.id] = { isWin, payout };
  });
  return payouts;
}

/* ----- 日付（日本時間） ----- */

/* raceId（YYYY-MM-DD、日本時間の日付）と、その日の開催時刻 */
function getRaceForJstDay(now, daysAgo) {
  const jst = new Date(now.getTime() + JST_OFFSET_HOURS * 3600 * 1000);
  const y = jst.getUTCFullYear(), m = jst.getUTCMonth(), d = jst.getUTCDate() - daysAgo;
  const raceTime = new Date(Date.UTC(y, m, d, RACE_HOUR - JST_OFFSET_HOURS, RACE_MINUTE, 0, 0));
  const day = new Date(Date.UTC(y, m, d));
  const raceId = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
  return { raceId, raceTime };
}

/* ----- 処理本体 ----- */

async function ensureRaceResult(db, raceId, raceTime) {
  const raceRef = db.collection("races").doc(raceId);
  let created = false;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(raceRef);
    created = false;
    if (snap.exists) return;

    const resultOrder = generateWeightedRaceOrder();
    transaction.set(raceRef, {
      raceId,
      resultOrder,
      checkpoints: buildRaceCheckpoints(resultOrder),
      finishStats: buildFinishStats(resultOrder),
      status: "finished",
      generatedAt: FieldValue.serverTimestamp(),
      generatedBy: "github-actions"
    });
    transaction.set(db.collection("raceLogs").doc(raceId), {
      raceId,
      scheduledAt: Timestamp.fromDate(raceTime),
      resultGeneratedAt: FieldValue.serverTimestamp(),
      resultGeneratedBy: "github-actions",
      resultGeneratedDelaySeconds: Math.round((Date.now() - raceTime.getTime()) / 1000),
      resultStatus: "created"
    }, { merge: true });
    created = true;
  });

  const snap = await raceRef.get();
  return { created, race: snap.data() };
}

async function settleRaceBets(db, raceId, resultOrder) {
  const betsSnap = await db.collection("raceBets").where("raceId", "==", raceId).get();
  const allBets = betsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const payouts = computePayouts(allBets, resultOrder);

  const result = { betsTotal: allBets.length, settledNow: 0, payoutTotal: 0, errors: [] };

  for (const bet of allBets.filter((b) => !b.settled)) {
    const { isWin, payout } = payouts[bet.id];
    try {
      let settledNow = false;
      await db.runTransaction(async (transaction) => {
        settledNow = false;
        const betRef = db.collection("raceBets").doc(bet.id);
        const fresh = await transaction.get(betRef);
        /* 名前を変えても uid は変わらないので、uid でユーザーを探す */
        const userQuery = payout > 0 && bet.uid
          ? await transaction.get(db.collection("users").where("uid", "==", bet.uid).limit(1))
          : null;

        if (!fresh.exists || fresh.data().settled) return;
        if (payout > 0 && (!userQuery || userQuery.empty)) throw new Error(`USER_NOT_FOUND uid=${bet.uid}`);

        transaction.update(betRef, { settled: true, win: isWin, payout, settledBy: "github-actions" });
        if (payout > 0) transaction.update(userQuery.docs[0].ref, { coins: FieldValue.increment(payout) });
        settledNow = true;
      });
      if (settledNow) {
        result.settledNow++;
        result.payoutTotal += payout;
      }
    } catch (error) {
      result.errors.push(`bet ${bet.id}: ${error.message || error}`);
    }
  }

  const remaining = await db.collection("raceBets").where("raceId", "==", raceId).where("settled", "==", false).get();
  result.unsettledRemaining = remaining.size;
  return result;
}

export async function runDerby({ db, now = new Date(), lookbackDays = LOOKBACK_DAYS, log = console.log }) {
  const summary = [];

  for (let daysAgo = lookbackDays; daysAgo >= 0; daysAgo--) {
    const { raceId, raceTime } = getRaceForJstDay(now, daysAgo);
    if (now < raceTime) continue; /* まだ開催時刻になっていない */

    const logRef = db.collection("raceLogs").doc(raceId);
    const entry = { raceId, status: "ok" };

    try {
      const { created, race } = await ensureRaceResult(db, raceId, raceTime);
      entry.result = created ? "created" : `exists(${race.generatedBy || "client"})`;

      const settle = await settleRaceBets(db, raceId, race.resultOrder);
      Object.assign(entry, settle);
      if (settle.errors.length) entry.status = "error";

      await logRef.set({
        raceId,
        scheduledAt: Timestamp.fromDate(raceTime),
        lastRunnerRunAt: FieldValue.serverTimestamp(),
        lastRunnerStatus: entry.status,
        lastRunnerError: settle.errors.join("\n").slice(0, 1500) || null,
        betsTotal: settle.betsTotal,
        betsSettledByRunner: FieldValue.increment(settle.settledNow),
        payoutTotalByRunner: FieldValue.increment(settle.payoutTotal),
        unsettledAfterRun: settle.unsettledRemaining
      }, { merge: true });
    } catch (error) {
      entry.status = "error";
      entry.error = error.message || String(error);
      try {
        await logRef.set({
          raceId,
          scheduledAt: Timestamp.fromDate(raceTime),
          lastRunnerRunAt: FieldValue.serverTimestamp(),
          lastRunnerStatus: "error",
          lastRunnerError: entry.error.slice(0, 1500)
        }, { merge: true });
      } catch (logError) {
        entry.logError = logError.message || String(logError);
      }
    }

    log(JSON.stringify(entry));
    summary.push(entry);
  }

  return summary;
}

/* 今日のレースの開催時刻より前に起動していたら、開催時刻まで待つ（待ち時間が長すぎるときは待たない） */
export function getWaitMillisUntilTodayRace(now) {
  const { raceTime } = getRaceForJstDay(now, 0);
  const wait = raceTime.getTime() - now.getTime();
  if (wait <= 0 || wait > MAX_WAIT_MINUTES * 60 * 1000) return 0;
  return wait + 2000; /* 開催時刻ちょうど＋2秒 */
}

function writeStepSummary(summary, startedAt, finishedAt) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const jst = (d) => new Date(d.getTime() + JST_OFFSET_HOURS * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19) + " JST";
  const rows = summary.map((e) =>
    `| ${e.raceId} | ${e.status === "ok" ? "✅" : "❌"} | ${e.result || "-"} | ${e.betsTotal ?? "-"} | ${e.settledNow ?? "-"} | ${e.payoutTotal ?? "-"} | ${e.unsettledRemaining ?? "-"} | ${(e.error || (e.errors || []).join(" / ") || "").replace(/\|/g, "/")} |`);
  const text = [
    "## ゆうダービー自動開催",
    `起動 ${jst(startedAt)} ／ 完了 ${jst(finishedAt)}`,
    "",
    "| レース | 状態 | 結果 | 馬券 | 今回精算 | 払戻計 | 未精算 | エラー |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    ""
  ].join("\n");
  fs.appendFileSync(file, text);
}

/* ----- GitHub Actions から直接実行されたとき ----- */

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson && !process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("FIREBASE_SERVICE_ACCOUNT が設定されていません（GitHub の Settings → Secrets and variables → Actions で登録してください）");
    process.exit(1);
  }

  if (serviceAccountJson) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  } else {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-yuuchat" });
  }

  const startedAt = new Date();
  let now = process.env.DERBY_NOW ? new Date(process.env.DERBY_NOW) : new Date();
  console.log(`ゆうダービー自動開催 起動 now=${now.toISOString()}`);

  if (process.env.DERBY_WAIT_FOR_RACE === "1" && !process.env.DERBY_NOW) {
    const wait = getWaitMillisUntilTodayRace(now);
    if (wait > 0) {
      console.log(`開催時刻まで ${Math.round(wait / 1000)} 秒待ちます`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      now = new Date();
      console.log(`開催時刻になりました now=${now.toISOString()}`);
    }
  }

  const summary = await runDerby({ db: getFirestore(), now });
  writeStepSummary(summary, startedAt, new Date());
  const failed = summary.filter((e) => e.status !== "ok");
  if (failed.length) {
    console.error(`失敗したレース: ${failed.map((e) => e.raceId).join(", ")}`);
    process.exit(1); /* Actions の実行が「失敗」になり、GitHub からメールで気づける */
  }
}
