/* ゆうスロのシミュレーション（worker.js の権威ロジックをそのまま使う）。
   台別に多数のスピンを回し、確率合計・実測還元率（RTP）・各種カウントを報告する。
   実行：node notify-worker/yuslot-sim.mjs [1スピンあたり試行回数] [FEVER中のスピン数の想定]
   FEVER は時間（20秒）で終わるため、クライアントのスピン速度に依存する。ここでは想定スピン数で近似する。 */
import { SLOT_MACHINES, SLOT_RULES, slotDrawOutcome } from "./worker.js";

const PAID = Number(process.argv[2] || 500000);     // 台ごとの有料スピン数
const FEVER_SPINS = Number(process.argv[3] || 15);  // FEVER中に回ると想定するスピン数

// 再現性のある疑似乱数（xorshift128+相当の簡易版）
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function checkProbabilitySum(machineId) {
  const m = SLOT_MACHINES[machineId], R = SLOT_RULES;
  const sum = R.cherry + R.bell + R.watermelon + R.replay + R.star + R.treasure + m.specialRate;
  const lose = 1 - sum;
  return { sum, lose };
}

function simulate(machineId, rng) {
  const m = SLOT_MACHINES[machineId];
  let staked = 0, returned = 0;
  const cnt = { cherry: 0, bell: 0, watermelon: 0, replay: 0, star: 0, treasure: 0, special: 0, lose: 0, fruitFever: 0 };
  let paidSpins = 0, freeSpins = 0, feverSpins = 0, coinWins = 0, fevers = 0;

  const play = (opts) => {
    const d = slotDrawOutcome(machineId, opts, rng);
    returned += d.payout;
    cnt[opts.fever ? "fruitFever" : d.result] = (cnt[opts.fever ? "fruitFever" : d.result] || 0) + 1;
    if (d.payout > 0) coinWins++;
    return d;
  };
  const runFree = (n) => {
    let pending = n;
    while (pending > 0) { pending--; freeSpins++; const d = play({ free: true, fever: false }); pending += d.freeAdd; if (d.feverStart) runFever(); }
  };
  const runFever = () => {
    fevers++;
    for (let i = 0; i < FEVER_SPINS; i++) { staked += m.price; paidSpins++; feverSpins++; play({ free: false, fever: true }); }
  };

  for (let i = 0; i < PAID; i++) {
    staked += m.price; paidSpins++;
    const d = play({ free: false, fever: false });
    if (d.freeAdd) runFree(d.freeAdd);
    if (d.feverStart) runFever();
  }
  return { staked, returned, rtp: returned / staked, cnt, paidSpins, freeSpins, feverSpins, coinWins, fevers };
}

console.log(`# ゆうスロ シミュレーション（有料 ${PAID.toLocaleString()} スピン/台、FEVER想定 ${FEVER_SPINS} スピン）\n`);
let allSumOk = true;
for (const id of Object.keys(SLOT_MACHINES)) {
  const { sum, lose } = checkProbabilitySum(id);
  const sumOk = Math.abs(sum + lose - 1) < 1e-9 && lose >= 0;
  if (!sumOk) allSumOk = false;
  const rng = makeRng(0x9e3779b9 ^ id.length ^ (id.charCodeAt(0) << 8));
  const r = simulate(id, rng);
  const m = SLOT_MACHINES[id];
  console.log(`■ ${id}  料金${m.price}  特別役=${m.special}(${(m.specialRate * 10000).toFixed(2)}/万=1/${Math.round(1 / m.specialRate)})`);
  console.log(`   確率合計(特別役まで)=${(sum * 100).toFixed(3)}%  ハズレ=${(lose * 100).toFixed(3)}%  合計=${((sum + lose) * 100).toFixed(3)}% ${sumOk ? "OK" : "NG"}`);
  console.log(`   実測RTP=${(r.rtp * 100).toFixed(2)}%  総投入=${r.staked.toLocaleString()}  総払出=${r.returned.toLocaleString()}  純収支(ユーザー)=${(r.returned - r.staked).toLocaleString()}`);
  console.log(`   有料${r.paidSpins.toLocaleString()}(うちFEVER${r.feverSpins.toLocaleString()}) 無料${r.freeSpins.toLocaleString()} コイン当たり${r.coinWins.toLocaleString()} FEVER${r.fevers.toLocaleString()}回`);
  const c = r.cnt;
  console.log(`   内訳: 🍒${c.cherry} 🔔${c.bell} 🍉${c.watermelon} REPLAY${c.replay} ⭐${c.star} 🎁${c.treasure} 特別${c.special} FEVER中${c.fruitFever} ハズレ${c.lose}\n`);
}
console.log(allSumOk ? "確率合計はすべて 100%（OK）" : "確率合計に問題あり（NG）");
process.exit(allSumOk ? 0 : 1);
