// 同時に参加・投票しても、ルールに拒否されずに人数・投票数が正しくなることを確かめる（Firestore Emulator で実行）
// アプリと同じやり直し処理（script.js の runCountedTransaction）をそのまま取り出して使う
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");
const { doc, getDoc, getDocs, setDoc, collection, runTransaction, serverTimestamp } = require("firebase/firestore");

const src = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const start = src.indexOf("async function runCountedTransaction(");
if (start < 0) throw new Error("script.js に runCountedTransaction が見つかりません");
const fnSrc = src.slice(start, src.indexOf("\n}\n", start) + 2);
const makeCounted = (db) => new Function("runTransaction", "db", `${fnSrc}; return runCountedTransaction;`)(runTransaction, db);
const min = (m) => new Date(Date.now() + m * 60000);

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-yuuchat-concurrency",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 }
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "events/e2"), { title: "t", startAt: min(120), entryOpenAt: min(-10), entryCloseAt: min(60), capacity: 5, status: "scheduled", participantCount: 0 });
    await setDoc(doc(d, "derbyManualRaces/2030-01-01-m1300"), { openAt: min(-10), closeAt: min(10), raceAt: min(20), status: "scheduled", betCount: 0 });
    for (let i = 0; i < 6; i++) await setDoc(doc(d, `users/u${i}`), { uid: `u${i}`, coins: 1000 });
  });
  const dbs = [0, 1, 2, 3, 4, 5].map((i) => env.authenticatedContext(`u${i}`).firestore());

  const join = (db, uid) => makeCounted(db)(async (t) => {
    const r = doc(db, "events/e2"), er = doc(db, `eventParticipants/e2_${uid}`);
    const s = await t.get(r); const es = await t.get(er);
    if (es.exists()) return;
    if (s.data().participantCount >= s.data().capacity) throw new Error("FULL");
    t.set(er, { eventId: "e2", uid, username: uid, joinedAt: serverTimestamp() });
    t.update(r, { participantCount: s.data().participantCount + 1 });
  });
  const bet = (db, uid) => makeCounted(db)(async (t) => {
    const m = doc(db, "derbyManualRaces/2030-01-01-m1300"), u = doc(db, `users/${uid}`);
    const ms = await t.get(m); const us = await t.get(u);
    t.update(m, { betCount: ms.data().betCount + 1 });
    t.update(u, { coins: us.data().coins - 10 });
    t.set(doc(collection(db, "raceBets")), { raceId: "2030-01-01-m1300", uid, amount: 10 });
  });

  // 6人が同時に参加（u0 は連打で2回）・定員5人／6人が同時に投票
  const joins = await Promise.allSettled([...dbs.map((db, i) => join(db, `u${i}`)), join(dbs[0], "u0")]);
  const bets = await Promise.allSettled(dbs.map((db, i) => bet(db, `u${i}`)));

  let ev, mr, entries;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    ev = (await getDoc(doc(d, "events/e2"))).data();
    mr = (await getDoc(doc(d, "derbyManualRaces/2030-01-01-m1300"))).data();
    entries = (await getDocs(collection(d, "eventParticipants"))).docs.filter((x) => x.id.startsWith("e2_")).length;
  });
  const label = (r) => (r.status === "fulfilled" ? "ok" : r.reason.message === "FULL" ? "FULL" : r.reason.code);
  console.log("同時参加 6人+連打1（定員5）:", joins.map(label).join(","), `→ 人数 ${ev.participantCount} / 記録 ${entries}`);
  console.log("同時投票 6人:", bets.map(label).join(","), `→ betCount ${mr.betCount}`);

  // 満員で断られる人がいるのは正しい（誰が断られるかは毎回変わる）。ルールに拒否された人がいないこと・数が合っていることを確かめる
  const noDenied = [...joins, ...bets].every((r) => r.status === "fulfilled" || r.reason?.message === "FULL");
  const ok = noDenied && ev.participantCount === 5 && entries === 5 && bets.every((r) => r.status === "fulfilled") && mr.betCount === 6;
  console.log(ok ? "同時実行テスト PASS" : "同時実行テスト FAIL");
  await env.cleanup();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
