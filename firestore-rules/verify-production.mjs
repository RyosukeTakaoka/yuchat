/* =========================================================
   本番の Firestore で、公開したルールが実際に効いているかを確かめる（公開の直後に GitHub Actions から実行）

   1. サービスアカウントで、確認用の一般ユーザー（UID: rules-verify-bot。管理者ではない）のログイン用トークンを作り、
      Firebase Authentication にログインする（アプリと同じ Web API キーを使う）
   2. そのユーザーとして Firestore の REST API に直接書き込みを試す
      ・手動レースの作成・キャンセル・投票数の改ざん → 拒否されること
      ・廃止したイベント機能（events / eventParticipants）の読み取り・書き込み → 拒否されること
        （本番に残っている過去のイベントのデータには触れない。確認には存在しない ID を使う）
      ・管理用以外のデータ（今まで通りのルール）への書き込み・読み取り → 成功すること
      ・ログインしていない人の読み取り → 拒否されること
   3. 確認用のデータとユーザーは最後に必ず削除する

   確認用のデータ：
   ・手動レースは 2000年の日付で作る（アプリの一覧にも、自動開催の処理にも出てこない）

   環境変数：FIREBASE_SERVICE_ACCOUNT（Secrets）、GITHUB_STEP_SUMMARY
            FIRESTORE_REST_BASE / AUTH_REST_BASE はテスト用（Emulator に向けるとき）
========================================================= */

import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "yuuchat-be666";
const ADMIN_UID = "g51wzTvJFsZiYEfre5aDuDckJXY2";
const TEST_UID = "rules-verify-bot";
const APP_REFERER = "https://yuchin0809.github.io/yuchat/";

const summary = [];
const out = (line = "") => { console.log(line); summary.push(line); };
const writeSummary = () => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n"); };

function readWebApiKey() {
  const src = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const m = src.match(/apiKey:\s*"([^"]+)"/);
  if (!m) throw new Error("script.js に apiKey が見つかりません");
  return m[1];
}

/* ----- Firestore REST の値の形 ----- */
function encode(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  throw new Error(`未対応の値: ${value}`);
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

/* ----- 公開直後のルールの反映待ち -----
   ルールを公開してから本番全体に行き渡るまで、最大1分ほどかかる。そのあいだは古いルールで判定されて
   「許可」（データが無いときは 404）が返ることがあるので、「拒否されるはず」の確認は、拒否が返るまで数秒おきに確かめ直す。
   最大 90 秒待っても拒否にならなければ失敗（最後の結果をそのまま記録する）。
   許可されて書き込めてしまったときは、onAllowed で消してから確かめ直す */
const PROPAGATION_TIMEOUT_MS = Number(process.env.RULES_PROPAGATION_TIMEOUT_MS || 90000);
const PROPAGATION_INTERVAL_MS = Number(process.env.RULES_PROPAGATION_INTERVAL_MS || 5000);

async function waitForDeny(attempt, { timeoutMs = PROPAGATION_TIMEOUT_MS, intervalMs = PROPAGATION_INTERVAL_MS, onAllowed } = {}) {
  const started = Date.now();
  for (let tries = 1; ; tries++) {
    const result = await attempt();
    const waitedMs = Date.now() - started;
    if (result.status === "DENY") return { ...result, tries, waitedMs };
    if (result.status === "ALLOW" && onAllowed) await onAllowed();
    if (waitedMs + intervalMs > timeoutMs) return { ...result, tries, waitedMs };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (credentials.project_id !== EXPECTED_PROJECT_ID) throw new Error("サービスアカウントのプロジェクトが違います");
  if (TEST_UID === ADMIN_UID) throw new Error("確認用ユーザーが管理者になっています");
  initializeApp({ credential: cert(credentials) });
  const db = getFirestore();
  const auth = getAuth();
  const projectId = credentials.project_id;
  const DOCS = `projects/${projectId}/databases/(default)/documents`;
  const BASE = `${process.env.FIRESTORE_REST_BASE || "https://firestore.googleapis.com"}/v1/${DOCS}`;
  const stamp = Date.now();
  const now = Date.now();
  const minutes = (m) => new Date(now + m * 60000);

  /* 確認用のデータ（管理者の権限で作る＝ルールの影響を受けない） */
  const ids = {
    closedRace: "2000-01-01-m0000",
    createRace: "2000-01-02-m0000",
    retiredEvent: `rules-verify-retired-${stamp}`,
    scratch: `rulesVerify/${TEST_UID}-${stamp}`
  };
  const cleanupRefs = [
    db.doc(`derbyManualRaces/${ids.closedRace}`),
    db.doc(`derbyManualRaces/${ids.createRace}`),
    /* 拒否されるはずだが、万一書き込めてしまったときのために片付ける（存在しない ID なので過去のデータは消さない） */
    db.doc(`events/${ids.retiredEvent}`),
    db.doc(`eventParticipants/${ids.retiredEvent}_${TEST_UID}`),
    db.doc(ids.scratch)
  ];

  const results = [];
  const record = (label, expected, actual, detail = "") => {
    results.push({ label, expected, actual, ok: expected === actual, detail });
  };
  /* ルールの反映待ちで確かめ直した項目のメモ（最後のまとめに出すので、try の外で宣言する） */
  const propagationNotes = [];

  try {
    const old = new Date("2000-01-01T00:00:00Z");
    await db.doc(`derbyManualRaces/${ids.closedRace}`).set({
      raceId: ids.closedRace, dayId: "2000-01-01", openAt: Timestamp.fromDate(old), closeAt: Timestamp.fromDate(new Date(old.getTime() + 600000)),
      raceAt: Timestamp.fromDate(new Date(old.getTime() + 1200000)), status: "scheduled", betCount: 0, createdByUid: ADMIN_UID, rulesVerify: true
    });

    /* 確認用の一般ユーザーでログイン */
    const customToken = await auth.createCustomToken(TEST_UID);
    const authBase = process.env.AUTH_REST_BASE || "https://identitytoolkit.googleapis.com";
    const signIn = await fetch(`${authBase}/v1/accounts:signInWithCustomToken?key=${readWebApiKey()}`, {
      method: "POST", headers: { "Content-Type": "application/json", Referer: APP_REFERER }, body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const signInBody = await signIn.json();
    if (!signIn.ok) throw new Error(`確認用ユーザーでログインできませんでした: ${signInBody.error?.message || signIn.status}`);
    const idToken = signInBody.idToken;

    const call = async (method, url, body, token = idToken) => {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const text = await response.text();
      const status = response.ok ? "ALLOW" : response.status === 403 ? "DENY" : `ERROR ${response.status}`;
      return { status, text: response.ok ? "" : text.slice(0, 300) };
    };
    const create = (collection, id, data) => call("POST", `${BASE}/${collection}?documentId=${encodeURIComponent(id)}`, { fields: fields(data) });
    const patch = (docPath, data) => call("PATCH", `${BASE}/${docPath}?${Object.keys(data).map((k) => `updateMask.fieldPaths=${k}`).join("&")}&currentDocument.exists=true`, { fields: fields(data) });
    const remove = (docPath) => call("DELETE", `${BASE}/${docPath}`);
    const get = (docPath, token) => call("GET", `${BASE}/${docPath}`, undefined, token);
    const check = async (label, expected, promise) => { const r = await promise; record(label, expected, r.status, r.text); };
    /* 公開直後の反映待ちを考えて、拒否が返るまで確かめ直す（廃止したイベント機能の確認だけに使う） */
    const checkDeniedAfterPropagation = async (label, attempt, onAllowed) => {
      const r = await waitForDeny(attempt, { onAllowed });
      if (r.tries > 1) propagationNotes.push(`${label}：${r.tries}回目（約${Math.round(r.waitedMs / 1000)}秒後）に${r.status === "DENY" ? "拒否を確認" : "最後まで拒否にならず"}`);
      record(label, "DENY", r.status, r.text);
    };

    /* ① 手動レース：一般ユーザーは直接書き換えられない */
    await check("手動レースの作成", "DENY", create("derbyManualRaces", ids.createRace, { raceId: ids.createRace, dayId: "2000-01-02", status: "scheduled", betCount: 0, openAt: old, closeAt: old, raceAt: old }));
    await check("手動レースのキャンセル", "DENY", patch(`derbyManualRaces/${ids.closedRace}`, { status: "cancelled" }));
    await check("手動レースの投票数の改ざん（0 → 50）", "DENY", patch(`derbyManualRaces/${ids.closedRace}`, { betCount: 50 }));
    await check("手動レースの時刻の書き換え", "DENY", patch(`derbyManualRaces/${ids.closedRace}`, { raceAt: minutes(1) }));
    await check("手動レースの削除", "DENY", remove(`derbyManualRaces/${ids.closedRace}`));

    /* ② 廃止したイベント機能：読み取りも書き込みもできない（存在しない ID で確かめる） */
    /*    公開直後は古いルールで判定されることがあるので、拒否が返るまで数秒おきに確かめ直す（最大 90 秒） */
    const retiredEventRef = db.doc(`events/${ids.retiredEvent}`);
    const retiredEntryRef = db.doc(`eventParticipants/${ids.retiredEvent}_${TEST_UID}`);
    await checkDeniedAfterPropagation("イベントの読み取り（廃止）", () => get(`events/${ids.retiredEvent}`));
    await checkDeniedAfterPropagation("イベントの作成（廃止）", () => create("events", ids.retiredEvent, { title: "（自動テスト）", participantCount: 0 }), () => retiredEventRef.delete());
    await checkDeniedAfterPropagation("イベント参加記録の読み取り（廃止）", () => get(`eventParticipants/${ids.retiredEvent}_${TEST_UID}`));
    await checkDeniedAfterPropagation("イベント参加記録の作成（廃止）", () => create("eventParticipants", `${ids.retiredEvent}_${TEST_UID}`, { eventId: ids.retiredEvent, uid: TEST_UID, username: "自動テスト", joinedAt: new Date() }), () => retiredEntryRef.delete());

    /* ③ 読み取りと、管理用以外のデータ（今まで通りのルール） */
    await check("手動レースの読み取り", "ALLOW", get(`derbyManualRaces/${ids.closedRace}`));
    await check("管理用以外のデータへの書き込み（今まで通り可）", "ALLOW", create("rulesVerify", ids.scratch.split("/")[1], { uid: TEST_UID, at: new Date() }));
    await check("管理用以外のデータの削除（今まで通り可）", "ALLOW", remove(ids.scratch));
    await check("ログインしていない人の読み取り（今まで通り拒否）", "DENY", get(`derbyManualRaces/${ids.closedRace}`, null));
  } finally {
    /* 確認用のデータとユーザーを必ず削除する */
    for (const ref of cleanupRefs) {
      try { await ref.delete(); } catch (error) { console.error(`削除に失敗: ${ref.path}`, error.message); }
    }
    try { await auth.deleteUser(TEST_UID); } catch (error) { if (error.code !== "auth/user-not-found") console.error("確認用ユーザーの削除に失敗", error.message); }
  }

  out("## 本番での確認（確認用の一般ユーザーで Firestore に直接書き込み）");
  out("| 内容 | 期待 | 結果 |");
  out("|---|---|---|");
  for (const r of results) out(`| ${r.label} | ${r.expected === "ALLOW" ? "成功" : r.expected === "DENY" ? "拒否" : r.expected} | ${r.ok ? "✅" : `❌ ${r.actual}`} |`);
  const passed = results.filter((r) => r.ok).length;
  out("");
  out(`- ${passed} / ${results.length} 期待どおり。確認用のデータとユーザーは削除しました`);
  if (propagationNotes.length) out(`- ルールの反映待ち：${propagationNotes.join(" ／ ")}`);
  for (const r of results.filter((x) => !x.ok)) console.error(`期待と違う: ${r.label} → ${r.actual} ${r.detail}`);
  return passed === results.length;
}

try {
  const ok = await main();
  writeSummary();
  process.exit(ok ? 0 : 1);
} catch (error) {
  out(`- **エラー**：${error.message}`);
  writeSummary();
  console.error(error);
  process.exit(1);
}
