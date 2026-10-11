/* 👤 ユーザー管理：管理者の名前強制変更のあと、名前が入ったチャット・グループ・友達関係を
   新しい名前に書き換える（worker.js の admin renameUserRefs）のテスト */
import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminAction } from "../worker.js";

const ADMIN = "adminUid";
const ROOT = "projects/p/databases/(default)/documents";
const enc = (v) => Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) };
const encF = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const dec = (v) => v.arrayValue ? (v.arrayValue.values || []).map(dec) : v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.booleanValue);
const decF = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));

function fakeFirestore(initial) {
  const docs = new Map();
  let clock = 1;
  const put = (path, fields) => docs.set(path, { fields: structuredClone(fields), updateTime: `t${clock++}` });
  Object.entries(initial).forEach(([path, data]) => put(path, encF(data)));
  const fs = {
    docs, commits: 0,
    async query(collection, filters) {
      const match = (val, op, v) => op === "ARRAY_CONTAINS" ? (Array.isArray(val) && val.includes(v)) : val === v;
      return [...docs.entries()].filter(([p]) => p.startsWith(`${collection}/`) && p.split("/").length === 2)
        .filter(([, d]) => filters.every(([f, op, v]) => match(decF(d.fields)[f], op, v)))
        .map(([p, d]) => ({ id: p.split("/")[1], path: p, updateTime: d.updateTime, data: decF(d.fields) }));
    },
    docName: (path) => `${ROOT}/${path}`,
    async commit(writes) {
      for (const w of writes) {
        const path = w.update.name.slice(ROOT.length + 1);
        const cur = docs.get(path)?.fields || {};
        put(path, w.updateMask ? { ...cur, ...Object.fromEntries(w.updateMask.fieldPaths.map((f) => [f, w.update.fields[f]])) } : { ...w.update.fields });
      }
      fs.commits++;
    }
  };
  return fs;
}

test("管理者 renameUserRefs：本人の名前が入ったメッセージ・グループ・友達関係を書き換える。他人のは変えない", async () => {
  const firestore = fakeFirestore({
    "messages/m1": { sender: "きゅう", receiver: "あいて", text: "a" },
    "messages/m2": { sender: "あいて", receiver: "きゅう", text: "b" },
    "messages/m3": { sender: "べつ", receiver: "あいて", text: "c" },
    "groups/g1": { owner: "きゅう", members: ["きゅう", "あいて"] },
    "friends/f1": { user1: "きゅう", user2: "あいて" }
  });
  const deps = { adminUid: ADMIN, firestore };
  const r = await handleAdminAction(deps, ADMIN, { action: "renameUserRefs", from: "きゅう", to: "しん" });
  assert.equal(r.ok, true);
  assert.equal(decF(firestore.docs.get("messages/m1").fields).sender, "しん");
  assert.equal(decF(firestore.docs.get("messages/m2").fields).receiver, "しん");
  assert.equal(decF(firestore.docs.get("messages/m3").fields).sender, "べつ");
  assert.deepEqual(decF(firestore.docs.get("groups/g1").fields).members, ["しん", "あいて"]);
  assert.equal(decF(firestore.docs.get("groups/g1").fields).owner, "しん");
  assert.equal(decF(firestore.docs.get("friends/f1").fields).user1, "しん");
});

test("管理者 renameUserRefs：管理者でないと 403／不正な名前は 400", async () => {
  const deps = { adminUid: ADMIN, firestore: fakeFirestore({}) };
  assert.equal((await handleAdminAction(deps, "notAdmin", { action: "renameUserRefs", from: "a", to: "b" })).status, 403);
  assert.equal((await handleAdminAction(deps, ADMIN, { action: "renameUserRefs", from: "a", to: "a" })).status, 400);
  assert.equal((await handleAdminAction(deps, ADMIN, { action: "renameUserRefs", from: "a/b", to: "c" })).status, 400);
});
