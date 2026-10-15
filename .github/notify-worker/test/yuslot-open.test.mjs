/* 🎰 ゆうスロ オープン自動処理（.github/notify-worker/yuslot-open.mjs）のテスト（モック Firestore）
   実行：node --test ".github/notify-worker/test/*.test.mjs" */
import test from "node:test";
import assert from "node:assert/strict";
import { run, ANNOUNCE_ID, OPEN_MARKER, BONUS_FLAG, GRANT, ANNOUNCE_TITLE } from "../yuslot-open.mjs";

const ROOT = "projects/p/databases/(default)/documents";
/* 値を「素の JS」で持つ簡易ストア。commit の increment / fields / createIfAbsent / set / query を再現する */
function mockFs(users) {
  const docs = new Map();
  for (const [name, coins] of Object.entries(users)) docs.set(`users/${name}`, { uid: "u" + name, name, coins });
  return {
    _docs: docs,
    docName: (p) => `${ROOT}/${p}`,
    async get(p) { return docs.has(p) ? structuredClone(docs.get(p)) : null; },
    async set(p, data) { docs.set(p, structuredClone(data)); },
    async createIfAbsent(p, data) { if (docs.has(p)) return false; docs.set(p, structuredClone(data)); return true; },
    async query(collectionId, filters, { select } = {}) {
      return [...docs.entries()].filter(([p]) => p.startsWith(collectionId + "/")).map(([p, d]) => ({ id: p.split("/").slice(1).join("/"), path: p, data: structuredClone(d) }));
    },
    async commit(writes) {
      for (const w of writes) {
        const path = (w.update?.name || w.delete).slice(ROOT.length + 1);
        if (w.currentDocument?.exists === true && !docs.has(path)) throw new Error("404 not found " + path);
        const cur = docs.get(path) || {};
        if (w.updateMask) for (const fp of w.updateMask.fieldPaths) { if (w.update.fields[fp] !== undefined) cur[fp] = decode(w.update.fields[fp]); }
        (w.updateTransforms || []).forEach((t) => { if (t.increment) cur[t.fieldPath] = (Number(cur[t.fieldPath]) || 0) + Number(t.increment.integerValue); });
        docs.set(path, cur);
      }
    }
  };
}
function decode(v) { return "booleanValue" in v ? v.booleanValue : "integerValue" in v ? Number(v.integerValue) : "stringValue" in v ? v.stringValue : v; }
function deps(fs, nowMs = Date.UTC(2026, 9, 16, 2, 5, 0)) { return { firestore: fs, now: () => nowMs }; }

test("開店処理：公開・お知らせ投稿・全ユーザーに+1000・プッシュ通知", async () => {
  const fs = mockFs({ "たろう": 100, "はなこ": 0, "じろう": 50 });
  const notifyCalls = [];
  const r = await run({ deps: deps(fs), notify: async (_d, id) => { notifyCalls.push(id); return { tokens: 3, sent: 3 }; }, log: () => {} });

  assert.equal(fs._docs.get("worldConfig/yuslot").yuslotPublished, true, "公開された");
  const ann = fs._docs.get(`announcements/${ANNOUNCE_ID}`);
  assert.ok(ann && ann.title === ANNOUNCE_TITLE && ann.body.includes("ゆうスロ"), "お知らせが投稿された");
  assert.equal(fs._docs.get("users/たろう").coins, 100 + GRANT);
  assert.equal(fs._docs.get("users/はなこ").coins, 0 + GRANT);
  assert.equal(fs._docs.get("users/じろう").coins, 50 + GRANT);
  assert.equal(fs._docs.get("users/たろう")[BONUS_FLAG], true, "フラグが立つ");
  assert.ok(fs._docs.has(OPEN_MARKER), "完了マーカーが作られる");
  assert.equal(r.granted, 3); assert.equal(r.skipped, 0);
  assert.deepEqual(notifyCalls, [ANNOUNCE_ID], "プッシュ通知が1回呼ばれる");
});

test("冪等：もう一度実行してもコインは二重配布されない・お知らせも増えない", async () => {
  const fs = mockFs({ "たろう": 100, "はなこ": 0 });
  const r1 = await run({ deps: deps(fs), notify: async () => ({ skipped: "duplicate" }), log: () => {} });
  assert.equal(r1.granted, 2);
  const coinsAfter1 = { t: fs._docs.get("users/たろう").coins, h: fs._docs.get("users/はなこ").coins };
  // 2回目
  const r2 = await run({ deps: deps(fs), notify: async () => ({ skipped: "duplicate" }), log: () => {} });
  assert.equal(r2.granted, 0, "2回目は配布しない");
  assert.equal(fs._docs.get("users/たろう").coins, coinsAfter1.t, "残高は増えない");
  assert.equal(fs._docs.get("users/はなこ").coins, coinsAfter1.h, "残高は増えない");
});

test("途中失敗からの再実行：マーカー未作成なら、未配布のユーザーにだけ配る（済みは飛ばす）", async () => {
  const fs = mockFs({ "A": 10, "B": 20 });
  // A だけ配布済みの状態を手で作る（マーカーはまだ無い）
  fs._docs.get("users/A")[BONUS_FLAG] = true; fs._docs.get("users/A").coins = 10 + GRANT;
  const r = await run({ deps: deps(fs), notify: async () => ({}), log: () => {} });
  assert.equal(r.granted, 1, "未配布の B だけ配る"); assert.equal(r.skipped, 1);
  assert.equal(fs._docs.get("users/A").coins, 10 + GRANT, "A は二重配布されない");
  assert.equal(fs._docs.get("users/B").coins, 20 + GRANT, "B に配布");
});
