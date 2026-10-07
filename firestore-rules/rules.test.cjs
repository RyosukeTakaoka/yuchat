// 管理者機能の Firestore Rules セキュリティテスト（Rules Emulator で実際に許可・拒否を確かめる）
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, runTransaction, writeBatch, serverTimestamp } = require("firebase/firestore");

const ADMIN = "g51wzTvJFsZiYEfre5aDuDckJXY2";
let pass = 0, fail = 0;
const log = [];
async function ok(name, p) { try { await assertSucceeds(p); pass++; log.push(`PASS 許可 ${name}`); } catch (e) { fail++; log.push(`FAIL (許可されるべき) ${name}: ${String(e.message).split("\n")[0]}`); } }
async function ng(name, p) { try { await assertFails(p); pass++; log.push(`PASS 拒否 ${name}`); } catch (e) { fail++; log.push(`FAIL (拒否されるべき) ${name}`); } }
const min = (m) => new Date(Date.now() + m * 60000);

(async () => {
  const env = await initializeTestEnvironment({ projectId: "demo-yuuchat-rules", firestore: { rules: fs.readFileSync(process.env.RULES || path.join(__dirname, "..", "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 } });
  const admin = env.authenticatedContext(ADMIN).firestore();
  const A = env.authenticatedContext("userA").firestore();
  const B = env.authenticatedContext("userB").firestore();
  // メールアドレスやユーザー名が管理者っぽくても、UID が違えば管理者ではない
  const fake = env.authenticatedContext("fakeAdmin", { email: "admin@example.com", name: "admin" }).firestore();
  const anon = env.unauthenticatedContext().firestore();

  const race = (o) => ({ raceId: o.id, dayId: o.id.slice(0, 10), openAt: o.openAt, closeAt: o.closeAt, raceAt: o.raceAt, status: o.status || "scheduled", betCount: o.betCount || 0, createdByUid: ADMIN, createdAt: new Date() });
  const ev = (o) => ({ title: o.title || "テスト", description: "", location: "", startAt: o.startAt, entryOpenAt: o.entryOpenAt, entryCloseAt: o.entryCloseAt, capacity: o.capacity || 0, status: o.status || "scheduled", participantCount: o.participantCount || 0, createdByUid: ADMIN, createdByName: "admin", createdAt: new Date() });

  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "users/alice"), { uid: "userA", name: "alice", coins: 1000, totalBetAmount: 0 });
    await setDoc(doc(d, "users/bob"), { uid: "userB", name: "bob", coins: 1000 });
    await setDoc(doc(d, "derbyManualRaces/2030-01-01-m1200"), race({ id: "2030-01-01-m1200", openAt: min(-10), closeAt: min(10), raceAt: min(20) }));
    await setDoc(doc(d, "derbyManualRaces/2030-01-01-m1300"), race({ id: "2030-01-01-m1300", openAt: min(-30), closeAt: min(-5), raceAt: min(5) }));
    await setDoc(doc(d, "derbyManualRaces/2030-01-01-m1400"), race({ id: "2030-01-01-m1400", openAt: min(-10), closeAt: min(10), raceAt: min(20), status: "cancelled" }));
    await setDoc(doc(d, "derbyManualRaces/2030-01-01-m1500"), race({ id: "2030-01-01-m1500", openAt: min(30), closeAt: min(40), raceAt: min(50) }));
    await setDoc(doc(d, "events/ev-open"), ev({ startAt: min(120), entryOpenAt: min(-10), entryCloseAt: min(60) }));
    await setDoc(doc(d, "events/ev-before"), ev({ startAt: min(120), entryOpenAt: min(30), entryCloseAt: min(60) }));
    await setDoc(doc(d, "events/ev-cancelled"), ev({ startAt: min(120), entryOpenAt: min(-10), entryCloseAt: min(60), status: "cancelled" }));
    await setDoc(doc(d, "events/ev-full"), ev({ startAt: min(120), entryOpenAt: min(-10), entryCloseAt: min(60), capacity: 1, participantCount: 1 }));
    await setDoc(doc(d, "eventParticipants/ev-full_userB"), { eventId: "ev-full", uid: "userB", username: "bob", joinedAt: new Date() });
    await setDoc(doc(d, "events/ev-closed"), ev({ startAt: min(120), entryOpenAt: min(-60), entryCloseAt: min(-5), participantCount: 1 }));
    await setDoc(doc(d, "eventParticipants/ev-closed_userA"), { eventId: "ev-closed", uid: "userA", username: "alice", joinedAt: new Date() });
    await setDoc(doc(d, "events/ev-admin-edit"), ev({ startAt: min(120), entryOpenAt: min(30), entryCloseAt: min(60) }));
    await setDoc(doc(d, "events/ev-admin-cancel"), ev({ startAt: min(120), entryOpenAt: min(-10), entryCloseAt: min(60) }));
  });

  // アプリと同じ形のトランザクション
  const createManualRace = (db, id) => runTransaction(db, async (t) => {
    const ref = doc(db, "derbyManualRaces", id);
    await t.get(ref); await t.get(doc(db, "races", id));
    t.set(ref, race({ id, openAt: min(60), closeAt: min(70), raceAt: min(80) }));
  });
  const cancelManualRace = (db, id) => runTransaction(db, async (t) => {
    const ref = doc(db, "derbyManualRaces", id);
    await t.get(ref);
    t.update(ref, { status: "cancelled", cancelledAt: serverTimestamp(), cancelledByUid: ADMIN });
  });
  const bet = (db, uid, username, raceId) => runTransaction(db, async (t) => {
    const userRef = doc(db, "users", username), manualRef = doc(db, "derbyManualRaces", raceId);
    const u = await t.get(userRef); const m = await t.get(manualRef);
    t.update(manualRef, { betCount: Number(m.data().betCount || 0) + 1 });
    t.update(userRef, { coins: u.data().coins - 100, totalBetAmount: Number(u.data().totalBetAmount || 0) + 100 });
    t.set(doc(collection(db, "raceBets")), { raceId, uid, username, type: "win", horses: [1], amount: 100, settled: false, win: null, payout: null, createdAt: serverTimestamp() });
  });
  const createEvent = (db, id) => runTransaction(db, async (t) => {
    const ref = doc(db, "events", id); await t.get(ref);
    t.set(ref, ev({ title: "新イベント", startAt: min(300), entryOpenAt: min(100), entryCloseAt: min(200) }));
  });
  const join = (db, uid, name, id) => runTransaction(db, async (t) => {
    const ref = doc(db, "events", id), entryRef = doc(db, "eventParticipants", `${id}_${uid}`);
    const s = await t.get(ref); await t.get(entryRef);
    t.set(entryRef, { eventId: id, uid, username: name, joinedAt: serverTimestamp() });
    t.update(ref, { participantCount: Number(s.data().participantCount || 0) + 1 });
  });
  const leave = (db, uid, id) => runTransaction(db, async (t) => {
    const ref = doc(db, "events", id), entryRef = doc(db, "eventParticipants", `${id}_${uid}`);
    const s = await t.get(ref); await t.get(entryRef);
    t.delete(entryRef);
    t.update(ref, { participantCount: Math.max(0, Number(s.data().participantCount || 0) - 1) });
  });

  log.push("--- ① 管理者 → 管理操作が成功する");
  await ok("管理者：手動レースの作成（アプリと同じトランザクション）", createManualRace(admin, "2030-02-01-m1000"));
  await ok("管理者：手動レースのキャンセル", cancelManualRace(admin, "2030-02-01-m1000"));
  await ok("管理者：キャンセル済みの手動レースを作り直す", createManualRace(admin, "2030-02-01-m1000"));
  await ok("管理者：手動レースの削除", deleteDoc(doc(admin, "derbyManualRaces/2030-02-01-m1000")));
  await ok("管理者：イベントの作成（アプリと同じトランザクション）", createEvent(admin, "ev-new"));
  await ok("管理者：イベントの編集", runTransaction(admin, async (t) => { const r = doc(admin, "events/ev-admin-edit"); await t.get(r); t.update(r, { title: "変更後", description: "説明", capacity: 10, updatedAt: serverTimestamp() }); }));
  await ok("管理者：イベントのキャンセル", runTransaction(admin, async (t) => { const r = doc(admin, "events/ev-admin-cancel"); await t.get(r); t.update(r, { status: "cancelled", cancelledAt: serverTimestamp(), cancelledByUid: ADMIN }); }));
  await ok("管理者：参加者一覧の読み取り", getDocs(query(collection(admin, "eventParticipants"), where("eventId", "==", "ev-full"))));
  await ok("管理者：参加者記録の削除（管理用）", deleteDoc(doc(admin, "eventParticipants/ev-closed_userA")));
  await ok("管理者：イベントの削除", deleteDoc(doc(admin, "events/ev-new")));

  log.push("--- ② 一般ユーザー → 手動レースを直接 Firestore に書き込もうとしても拒否される");
  await ng("一般：手動レースの作成（アプリと同じトランザクション）", createManualRace(A, "2030-03-01-m1000"));
  await ng("一般：手動レースの作成（setDoc）", setDoc(doc(A, "derbyManualRaces/2030-03-01-m1100"), race({ id: "2030-03-01-m1100", openAt: min(1), closeAt: min(2), raceAt: min(3) })));
  await ng("一般：手動レースの作成（addDoc）", addDoc(collection(A, "derbyManualRaces"), { status: "scheduled" }));
  await ng("一般：手動レースのキャンセル", cancelManualRace(A, "2030-01-01-m1500"));
  await ng("一般：手動レースの時刻の書き換え", updateDoc(doc(A, "derbyManualRaces/2030-01-01-m1200"), { raceAt: min(1) }));
  await ng("一般：手動レースの上書き（set）", setDoc(doc(A, "derbyManualRaces/2030-01-01-m1200"), { status: "cancelled" }));
  await ng("一般：手動レースの削除", deleteDoc(doc(A, "derbyManualRaces/2030-01-01-m1500")));
  await ng("一般：betCount を0に戻す（キャンセル可能にする改ざん）", updateDoc(doc(A, "derbyManualRaces/2030-01-01-m1200"), { betCount: 0 }));
  await ng("一般：betCount を一気に増やす", updateDoc(doc(A, "derbyManualRaces/2030-01-01-m1200"), { betCount: 50 }));
  await ng("一般：betCount と status を同時に変更", updateDoc(doc(A, "derbyManualRaces/2030-01-01-m1200"), { betCount: 1, status: "cancelled" }));
  await ng("メールアドレス・名前が管理者風でも UID が違えば拒否（作成）", createManualRace(fake, "2030-03-02-m1000"));
  await ng("メールアドレス・名前が管理者風でも UID が違えば拒否（イベント作成）", createEvent(fake, "ev-fake"));
  await ng("未ログイン：手動レースの読み取り", getDoc(doc(anon, "derbyManualRaces/2030-01-01-m1200")));

  log.push("--- ③ 一般ユーザー → イベントを直接 Firestore に書き込もうとしても拒否される");
  await ng("一般：イベントの作成（アプリと同じトランザクション）", createEvent(A, "ev-by-user"));
  await ng("一般：イベントの作成（setDoc）", setDoc(doc(A, "events/ev-by-user2"), ev({ startAt: min(100), entryOpenAt: min(10), entryCloseAt: min(50) })));
  await ng("一般：イベントの作成（addDoc）", addDoc(collection(A, "events"), { title: "x" }));
  await ng("一般：イベントの編集（タイトル）", updateDoc(doc(A, "events/ev-before"), { title: "乗っ取り" }));
  await ng("一般：イベントのキャンセル", updateDoc(doc(A, "events/ev-open"), { status: "cancelled" }));
  await ng("一般：イベントの削除", deleteDoc(doc(A, "events/ev-open")));
  await ng("一般：参加記録なしで人数だけ増やす", updateDoc(doc(A, "events/ev-open"), { participantCount: 1 }));
  await ng("一般：人数を大きく書き換える", updateDoc(doc(A, "events/ev-open"), { participantCount: 999 }));
  await ng("一般：人数と定員を同時に書き換える", updateDoc(doc(A, "events/ev-full"), { participantCount: 2, capacity: 0 }));
  await ng("一般：イベントの下にデータを作る", setDoc(doc(A, "events/ev-open/x/y"), { a: 1 }));

  log.push("--- ④ 一般ユーザー → 正常なイベント参加・取り消しは成功する");
  await ok("一般：イベント一覧の読み取り", getDocs(collection(A, "events")));
  await ok("一般：手動レースの読み取り", getDocs(collection(A, "derbyManualRaces")));
  await ok("一般：自分の参加状況の読み取り", getDocs(query(collection(A, "eventParticipants"), where("uid", "==", "userA"))));
  await ok("一般(A)：受付中のイベントに参加（アプリと同じトランザクション）", join(A, "userA", "alice", "ev-open"));
  await ok("一般(B)：同じイベントに参加", join(B, "userB", "bob", "ev-open"));
  await ng("一般(A)：同じイベントに二重参加（記録の上書き＋人数+1）", join(A, "userA", "alice", "ev-open"));
  await ng("一般(A)：他人(B)の参加を勝手に取り消す", deleteDoc(doc(A, "eventParticipants/ev-open_userB")));
  await ng("一般(A)：他人の名前で参加記録を作る", join(A, "userC", "carol", "ev-open"));
  await ng("一般(A)：人数を増やさずに参加記録だけ作る", setDoc(doc(A, "eventParticipants/ev-before_userA"), { eventId: "ev-before", uid: "userA", username: "alice", joinedAt: serverTimestamp() }));
  await ng("一般(A)：ID と eventId が合わない参加記録", runTransaction(A, async (t) => { const r = doc(A, "events/ev-open"); const s = await t.get(r); t.set(doc(A, "eventParticipants/ev-before_userA"), { eventId: "ev-open", uid: "userA", username: "alice", joinedAt: serverTimestamp() }); t.update(r, { participantCount: s.data().participantCount + 1 }); }));
  await ng("一般(A)：受付開始前のイベントに参加", join(A, "userA", "alice", "ev-before"));
  await ng("一般(A)：キャンセルされたイベントに参加", join(A, "userA", "alice", "ev-cancelled"));
  await ng("一般(A)：定員いっぱいのイベントに参加", join(A, "userA", "alice", "ev-full"));
  await ok("一般(A)：参加の取り消し（アプリと同じトランザクション）", leave(A, "userA", "ev-open"));
  await ok("一般(A)：もう一度参加", join(A, "userA", "alice", "ev-open"));
  {
    let s; await env.withSecurityRulesDisabled(async (ctx) => { s = (await getDoc(doc(ctx.firestore(), "events/ev-open"))).data()?.participantCount; });
    if (s === 2) { pass++; log.push("PASS 参加者数が実際の参加記録と一致（2人）"); } else { fail++; log.push(`FAIL 参加者数が ${s}`); }
  }

  log.push("--- ⑤ 一般ユーザー → 手動レースへの正常な投票は成功・受付外は拒否");
  await ok("一般：受付中の手動レースに投票（betCount+1・コイン・馬券を同じトランザクション）", bet(A, "userA", "alice", "2030-01-01-m1200"));
  await ok("一般(B)：同じ手動レースに投票", bet(B, "userB", "bob", "2030-01-01-m1200"));
  await ng("一般：締切後の手動レースに投票", bet(A, "userA", "alice", "2030-01-01-m1300"));
  await ng("一般：受付開始前の手動レースに投票", bet(A, "userA", "alice", "2030-01-01-m1500"));
  await ng("一般：キャンセルされた手動レースに投票", bet(A, "userA", "alice", "2030-01-01-m1400"));

  log.push("--- ⑥ 既存のデータは今まで通り（ログイン済みなら読み書き可・未ログインは不可）");
  await ok("users：自分のデータ更新", updateDoc(doc(A, "users/alice"), { online: true, lastSeen: serverTimestamp() }));
  await ok("users：新規登録", setDoc(doc(A, "users/alice_new"), { uid: "userA", name: "alice_new", coins: 1000 }));
  await ok("friends：友達追加", setDoc(doc(A, "friends/alice_bob"), { user1: "alice", user2: "bob", createdAt: serverTimestamp() }));
  await ok("groups：グループ作成", addDoc(collection(A, "groups"), { name: "g", members: ["alice", "bob"] }));
  await ok("messages：メッセージ送信", addDoc(collection(A, "messages"), { sender: "alice", receiver: "bob", text: "hi", createdAt: serverTimestamp() }));
  await ok("messages：既読（他人のメッセージ更新）", (async () => { const r = await addDoc(collection(B, "messages"), { sender: "bob", receiver: "alice", readBy: [] }); await updateDoc(r, { readBy: ["alice"] }); })());
  await ok("gameRooms：部屋作成・更新・削除", (async () => { const r = doc(A, "gameRooms/room1"); await setDoc(r, { host: "alice" }); await updateDoc(doc(B, "gameRooms/room1"), { guest: "bob" }); await deleteDoc(r); })());
  await ok("gameInvites：招待", setDoc(doc(A, "gameInvites/inv1"), { from: "alice", to: "bob" }));
  await ok("fcmTokens：トークン保存・削除", (async () => { await setDoc(doc(A, "fcmTokens/tok1"), { uid: "userA" }); await deleteDoc(doc(A, "fcmTokens/tok1")); })());
  await ok("races：自動レースの結果作成（クライアントの抽選）", setDoc(doc(A, "races/2030-01-02"), { raceId: "2030-01-02", resultOrder: [1, 2, 3], status: "finished", generatedBy: "client" }));
  await ok("raceLogs：開催ログ", setDoc(doc(A, "raceLogs/2030-01-02"), { raceId: "2030-01-02" }, { merge: true }));
  await ok("raceBets：自動レースへの投票・精算", (async () => { const r = await addDoc(collection(A, "raceBets"), { raceId: "2030-01-02", uid: "userA", settled: false }); await updateDoc(r, { settled: true, win: false, payout: 0 }); })());
  await ok("derbyNotifications など他のコレクションも今まで通り", setDoc(doc(A, "derbyNotifications/2030-01-02"), { a: 1 }));
  await ok("サブコレクション（既存データ）も今まで通り", setDoc(doc(A, "users/alice/sub/x"), { a: 1 }));
  await ok("一括書き込み（batch）も今まで通り", (() => { const b = writeBatch(A); b.update(doc(A, "users/alice"), { online: false }); b.set(doc(A, "friends/x_y"), { user1: "x" }); return b.commit(); })());
  await ng("未ログイン：users の読み取り（今まで通り拒否）", getDoc(doc(anon, "users/alice")));
  await ng("未ログイン：messages への書き込み（今まで通り拒否）", addDoc(collection(anon, "messages"), { text: "x" }));
  await ng("未ログイン：イベントの読み取り", getDocs(collection(anon, "events")));

  log.push("--- ⑦ ゆう経済：株価（market）・総資産ランキング（rankings）は読み取りだけ（書くのは自動処理だけ）");
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "market/current"), { date: "2030-01-01", companies: { YGM: { price: 180 } } });
    await setDoc(doc(d, "rankings/assets"), { date: "2030-01-01", users: [{ name: "alice", total: 1000, rank: 1 }] });
  });
  await ok("market：株価の読み取り", getDoc(doc(A, "market/current")));
  await ok("rankings：総資産ランキングの読み取り", getDoc(doc(A, "rankings/assets")));
  await ng("market：株価の書き換え", updateDoc(doc(A, "market/current"), { "companies.YGM.price": 99999 }));
  await ng("market：株価の上書き", setDoc(doc(A, "market/current"), { date: "x" }));
  await ng("market：株価の削除", deleteDoc(doc(A, "market/current")));
  await ng("market：新しいドキュメントの作成", setDoc(doc(A, "market/other"), { a: 1 }));
  await ng("rankings：総資産ランキングの書き換え", updateDoc(doc(A, "rankings/assets"), { users: [] }));
  await ng("rankings：ランキングの作成", setDoc(doc(A, "rankings/coins"), { users: [] }));
  await ng("market：管理者でもブラウザからは書けない", updateDoc(doc(admin, "market/current"), { date: "y" }));
  await ng("market：売買と同じトランザクションの中でも書けない", runTransaction(A, async (t) => { await t.get(doc(A, "market/current")); t.update(doc(A, "market/current"), { date: "z" }); t.update(doc(A, "users/alice"), { coins: 1 }); }));
  await ok("users：自分の銀行・株・ログインボーナスの更新（今まで通り）", updateDoc(doc(A, "users/alice"), { coins: 900, bank: { deposit: 100, interestBase: 0, loan: 0 }, "stocks.YGM": { qty: 1, cost: 180 }, lastLoginBonusDate: "2030-01-01" }));
  await ok("users：株価を読んで売買するトランザクション（今まで通り）", runTransaction(A, async (t) => { await t.get(doc(A, "market/current")); const u = await t.get(doc(A, "users/alice")); t.update(doc(A, "users/alice"), { coins: u.data().coins - 180 }); }));
  await ng("未ログイン：株価の読み取り", getDoc(doc(anon, "market/current")));

  await env.cleanup();
  console.log(log.join("\n"));
  console.log(`\nRules セキュリティテスト: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
