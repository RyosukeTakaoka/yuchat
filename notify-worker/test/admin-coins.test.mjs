/* 👤 ユーザー管理：ゆうコインの増減（worker.js の adjustCoins）のテスト
   Firestore はメモリ上の偽物（更新時刻の条件・まとめて書き込みを本物と同じように扱う）
   実行：node --test "notify-worker/test/*.test.mjs" */

import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminAction } from "../worker.js";

const ADMIN = "adminUid";
const ROOT = "projects/p/databases/(default)/documents";

/* users/{名前}・userDeletions・adminAuditLogs だけを扱う偽の Firestore */
function fakeFirestore(users) {
  const docs = new Map();
  let clock = 1;
  const put = (path, fields) => docs.set(path, { fields: structuredClone(fields), updateTime: `t${clock++}` });
  Object.entries(users).forEach(([name, data]) => put(`users/${name}`, data));
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  const plain = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? v.booleanValue ?? v.timestampValue)]));
  const fs = {
    docs,
    commits: 0,
    async query(collection, filters) {
      await tick();
      return [...docs.entries()].filter(([p]) => p.startsWith(`${collection}/`) && p.split("/").length === 2)
        .filter(([, d]) => filters.every(([f, , v]) => plain(d.fields)[f] === v))
        .map(([p, d]) => ({ id: p.split("/")[1], path: p, updateTime: d.updateTime, data: plain(d.fields) }));
    },
    async get(path) { await tick(); const d = docs.get(path); return d ? plain(d.fields) : null; },
    async getRaw(path) { await tick(); const d = docs.get(path); return d ? structuredClone(d) : null; },
    docName: (path) => `${ROOT}/${path}`,
    async add() { throw new Error("使わない"); },
    async commit(writes) {
      await tick();
      /* まず全部の条件を確かめてから、まとめて書く（1つでも合わなければ何も書かない） */
      for (const w of writes) {
        const path = w.update.name.slice(ROOT.length + 1);
        const cur = docs.get(path);
        if (w.currentDocument?.updateTime && cur?.updateTime !== w.currentDocument.updateTime) {
          throw Object.assign(new Error("firestore commit 400 FAILED_PRECONDITION: the stored version does not match the required base version"), { status: 400 });
        }
        if (w.currentDocument?.exists === false && cur) throw Object.assign(new Error("firestore commit 409 ALREADY_EXISTS"), { status: 409 });
      }
      for (const w of writes) {
        const path = w.update.name.slice(ROOT.length + 1);
        const cur = docs.get(path)?.fields || {};
        const next = w.updateMask ? { ...cur, ...Object.fromEntries(w.updateMask.fieldPaths.map((f) => [f, w.update.fields[f]])) } : { ...w.update.fields };
        (w.updateTransforms || []).forEach((t) => { next[t.fieldPath] = { timestampValue: "REQUEST_TIME" }; });
        put(path, next);
      }
      fs.commits++;
    }
  };
  return fs;
}

const userFields = (uid, coins, extra = {}) => ({
  uid: { stringValue: uid },
  name: { stringValue: "x" },
  coins: { integerValue: String(coins) },
  bank: { mapValue: { fields: { deposit: { integerValue: "777" } } } },
  stocks: { mapValue: { fields: { YGM: { mapValue: { fields: { qty: { integerValue: "3" }, cost: { integerValue: "600" } } } } } } },
  ...extra
});

function setup(coins = 1250) {
  const firestore = fakeFirestore({ "たろう": userFields("uT", coins), "かんりしゃ": userFields(ADMIN, 99) });
  return { firestore, deps: { adminUid: ADMIN, firestore, now: () => Date.now() } };
}

const coinsOf = (fs, name) => Number(fs.docs.get(`users/${name}`).fields.coins.integerValue);
const logs = (fs) => [...fs.docs.entries()].filter(([p]) => p.startsWith("adminAuditLogs/")).map(([, d]) => d.fields);

test("管理者が増やせる：残高が増え、銀行・株などはそのまま。操作の記録が同じ書き込みで残る", async () => {
  const { firestore, deps } = setup(1250);
  const before = structuredClone(firestore.docs.get("users/たろう").fields);
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "increase", amount: 500, expectedCoins: 1250 });
  assert.deepEqual([r.ok, r.beforeCoins, r.afterCoins], [true, 1250, 1750]);
  assert.equal(coinsOf(firestore, "たろう"), 1750);
  const after = firestore.docs.get("users/たろう").fields;
  assert.deepEqual({ ...after, coins: null }, { ...before, coins: null }, "coins 以外は1項目も変わらない");
  assert.equal(firestore.commits, 1, "コインと記録は1回の書き込み");
  const [log] = logs(firestore);
  assert.equal(log.action.stringValue, "adjustCoins");
  assert.equal(log.targetUid.stringValue, "uT");
  assert.equal(log.targetName.stringValue, "たろう");
  assert.equal(log.delta.integerValue, "500");
  assert.equal(log.beforeCoins.integerValue, "1250");
  assert.equal(log.afterCoins.integerValue, "1750");
  assert.equal(log.byUid.stringValue, ADMIN);
  assert.equal(log.byName.stringValue, "かんりしゃ");
  assert.ok(log.at, "実行日時（サーバーの時刻）");
});

test("管理者が減らせる：残高がちょうど0までは減らせる", async () => {
  const { firestore, deps } = setup(300);
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "decrease", amount: 300 });
  assert.deepEqual([r.ok, r.afterCoins], [true, 0]);
  assert.equal(coinsOf(firestore, "たろう"), 0);
  assert.equal(logs(firestore)[0].delta.integerValue, "-300");
});

test("残高がマイナスになる減らし方は拒否（何も書かない）", async () => {
  const { firestore, deps } = setup(300);
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "decrease", amount: 301 });
  assert.equal(r.status, 409); assert.equal(r.error, "insufficient_coins"); assert.equal(r.coins, 300);
  assert.equal(coinsOf(firestore, "たろう"), 300);
  assert.equal(firestore.commits, 0);
});

for (const [label, amount] of [["0", 0], ["マイナス", -5], ["小数", 1.5], ["文字列", "100"], ["大きすぎる（100万を超える）", 1000001], ["無限大", Infinity], ["NaN", NaN], ["指定なし", undefined]]) {
  test(`不正な金額（${label}）は拒否`, async () => {
    const { firestore, deps } = setup();
    const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "increase", amount });
    assert.equal(r.status, 400); assert.equal(r.error, "invalid_amount");
    assert.equal(firestore.commits, 0);
  });
}

test("増やす・減らす以外の指定は拒否", async () => {
  const { firestore, deps } = setup();
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "set", amount: 5 });
  assert.equal(r.error, "invalid_direction");
  assert.equal(firestore.commits, 0);
});

test("管理者以外（一般ユーザー・本人）は 403。何も書かない", async () => {
  const { firestore, deps } = setup();
  for (const caller of ["uT", "someone", ""]) {
    const r = await handleAdminAction(deps, caller, { action: "adjustCoins", uid: "uT", direction: "increase", amount: 100 });
    assert.equal(r.status, 403); assert.equal(r.error, "not_admin");
  }
  assert.equal(coinsOf(firestore, "たろう"), 1250);
  assert.equal(firestore.commits, 0);
});

test("表示したあとに残高が変わっていたら（expectedCoins が違う）変更せずに最新の残高を返す", async () => {
  const { firestore, deps } = setup(1250);
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "increase", amount: 100, expectedCoins: 1000 });
  assert.deepEqual([r.status, r.error, r.coins], [409, "balance_changed", 1250]);
  assert.equal(firestore.commits, 0);
});

test("同時に20回増減しても、成功した分だけ正しく反映され、記録の数も一致する（失われた更新・二重の更新なし）", async () => {
  const { firestore, deps } = setup(10000);
  const calls = Array.from({ length: 20 }, (_, i) => handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: i % 2 ? "decrease" : "increase", amount: i % 2 ? 30 : 100 }));
  const results = await Promise.all(calls);
  const ok = results.filter((r) => r.ok);
  const expected = 10000 + ok.reduce((sum, r) => sum + (r.direction === "increase" ? r.amount : -r.amount), 0);
  assert.equal(coinsOf(firestore, "たろう"), expected);
  assert.equal(logs(firestore).length, ok.length);
  assert.ok(ok.length >= 5, `成功 ${ok.length} 件`);
  results.filter((r) => !r.ok).forEach((r) => assert.equal(r.error, "busy"));
  /* 記録の「前→後」をつなげると、最初から最後まで途切れない */
  const chain = logs(firestore).map((l) => [Number(l.beforeCoins.integerValue), Number(l.afterCoins.integerValue)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.ok(chain.every(([b, a]) => Number.isSafeInteger(b) && Number.isSafeInteger(a)));
});

test("増減の途中でアプリ側がコインを書き換えても（競馬の精算など）、その変更を消さずにやり直す", async () => {
  const { firestore, deps } = setup(1000);
  const realGetRaw = firestore.getRaw;
  let interfered = false;
  firestore.getRaw = async (path) => {
    const doc = await realGetRaw(path);
    if (!interfered && path === "users/たろう") {
      interfered = true;
      /* 読んだ直後に、アプリの別の処理が +250（払い戻し）を書いた */
      const cur = firestore.docs.get(path);
      firestore.docs.set(path, { fields: { ...cur.fields, coins: { integerValue: "1250" } }, updateTime: "app-write" });
    }
    return doc;
  };
  const r = await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "increase", amount: 100 });
  assert.equal(r.ok, true);
  assert.deepEqual([r.beforeCoins, r.afterCoins], [1250, 1350]);
  assert.equal(coinsOf(firestore, "たろう"), 1350, "払い戻しの +250 と管理者の +100 の両方が残る");
});

test("ユーザーが見つからない・削除の途中なら変更しない", async () => {
  const { firestore, deps } = setup();
  assert.equal((await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "nobody", direction: "increase", amount: 1 })).error, "user_not_found");
  firestore.docs.set("userDeletions/uT", { fields: { status: { stringValue: "failed" } }, updateTime: "x" });
  assert.equal((await handleAdminAction(deps, ADMIN, { action: "adjustCoins", uid: "uT", direction: "increase", amount: 1 })).error, "deletion_in_progress");
  assert.equal(firestore.commits, 0);
});
