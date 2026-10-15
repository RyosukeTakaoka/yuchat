/* verify-production.mjs の Firestore REST 値エンコーダのテスト（node --test）
   配列（arrayValue）対応の追加に加え、文字列・数値・真偽値・null・日時・オブジェクトが壊れていないことを確かめる。
   本番にも Emulator にも接続しない（encode は純粋関数）。 */
const test = require("node:test");
const assert = require("node:assert/strict");

test("encode：各種の値を Firestore REST の形にする", async () => {
  const { encode, fields } = await import("./verify-production.mjs");

  assert.deepEqual(encode(null), { nullValue: null });
  assert.deepEqual(encode(undefined), { nullValue: null });
  assert.deepEqual(encode("abc"), { stringValue: "abc" });
  assert.deepEqual(encode(""), { stringValue: "" });
  assert.deepEqual(encode(true), { booleanValue: true });
  assert.deepEqual(encode(false), { booleanValue: false });
  assert.deepEqual(encode(42), { integerValue: "42" });
  assert.deepEqual(encode(0), { integerValue: "0" });
  assert.deepEqual(encode(-7), { integerValue: "-7" });
  assert.deepEqual(encode(3.5), { doubleValue: 3.5 });
  assert.deepEqual(encode(new Date("2020-01-02T03:04:05.000Z")), { timestampValue: "2020-01-02T03:04:05.000Z" });

  // 配列（今回の修正の対象）
  assert.deepEqual(encode([]), { arrayValue: { values: [] } });
  assert.deepEqual(encode(["x", "y"]), { arrayValue: { values: [{ stringValue: "x" }, { stringValue: "y" }] } });
  assert.deepEqual(encode([1, true]), { arrayValue: { values: [{ integerValue: "1" }, { booleanValue: true }] } });

  // オブジェクト（mapValue）とネスト
  assert.deepEqual(encode({ a: 1, b: "x" }), { mapValue: { fields: { a: { integerValue: "1" }, b: { stringValue: "x" } } } });
  assert.deepEqual(
    encode({ members: ["alice", "bob"], n: 2 }),
    { mapValue: { fields: { members: { arrayValue: { values: [{ stringValue: "alice" }, { stringValue: "bob" }] } }, n: { integerValue: "2" } } } }
  );

  // fields（ドキュメント全体）：以前クラッシュしていた配列入りのペイロードが通る
  assert.deepEqual(
    fields({ gameType: "othello", ownerUid: "u", members: ["x"], memberUids: ["u"], status: "waiting" }),
    {
      gameType: { stringValue: "othello" },
      ownerUid: { stringValue: "u" },
      members: { arrayValue: { values: [{ stringValue: "x" }] } },
      memberUids: { arrayValue: { values: [{ stringValue: "u" }] } },
      status: { stringValue: "waiting" }
    }
  );
});
