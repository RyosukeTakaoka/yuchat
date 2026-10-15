/* =========================================================
   🎰 ゆうスロ オープン（2026-10-16 11:05 JST 予定）の自動処理
   GitHub Actions（.github/workflows/yuslot-open.yml）から、サービスアカウントで実行する。

   1. ゆうスロを公開（worldConfig/yuslot.yuslotPublished = true）
   2. お知らせ（📢）に「お詫び＋ゆうスロ オープン＋1000コインプレゼント」の記事を投稿
   3. その時点の全ユーザーに ゆうコイン +1000（開店時点の全員・1人1回だけ）
   4. お知らせのプッシュ通知を送る（通知ONの端末へ。通知サーバーと同じ処理・二重送信しない）

   安全策（冪等）：
   ・公開は何度実行しても安全（true を入れ直すだけ）。
   ・お知らせは固定IDで createIfAbsent（すでにあれば作らない）。
   ・コイン配布は「開店完了マーカー」が無いときだけ実行し、各ユーザーのフラグで1人1回に限定。
     完了後はマーカーで二度と配布しない（年1回 cron が再発火しても no-op）。
   ・プッシュ通知は notificationLogs の記録で二重送信しない。
   ・コインは既存残高に +1000 加算（残高を壊さない）。クライアントからは実行できない（サービスアカウントのみ）。
========================================================= */

import { createDefaultDeps, notifyNewAnnouncement } from "../../notify-worker/worker.js";

const EXPECTED_PROJECT_ID = "yuuchat-be666";
export const ANNOUNCE_ID = "yuslot-open-2026-10-16";
export const OPEN_MARKER = "notificationLogs/yuslot-open-done-2026-10-16";
export const BONUS_FLAG = "yuslotOpenBonus2026";
export const GRANT = 1000;
export const ANNOUNCE_TITLE = "🎰 ゆうスロ オープン＆1000コインプレゼント！";
export const ANNOUNCE_BODY = [
  "いつもゆうChatをご利用いただきありがとうございます。",
  "",
  "はじめに、先日サーバー障害でゆうChatをご利用いただけない時間があり、大変ご迷惑をおかけしました。心よりお詫び申し上げます。",
  "",
  "本日、「ゆうワールド」タブに新しいお店「ゆうスロ」がオープンしました！🎰 6種類のスロットがあり、フルーツの小役や 777・オリジナル絵柄、FEVER を楽しめます。遊べる時間は毎日 7:00〜21:00、ゆうChat共通のゆうコインで遊べます。",
  "",
  "オープンを記念して、本日ご利用中のみなさま全員に、ゆうコインを 1000 枚プレゼントしました！🎁",
  "",
  "ぜひ「ゆうワールド」からゆうスロで遊んでみてください。"
].join("\n");

export async function run({ deps, notify = notifyNewAnnouncement, log = console.log } = {}) {
  const fs = deps.firestore;
  const result = { published: false, announced: false, granted: 0, skipped: 0, notified: null };

  // 1) 公開
  await fs.set("worldConfig/yuslot", { yuslotPublished: true, updatedAtMs: deps.now(), updatedByUid: "github-actions-yuslot-open" });
  result.published = true;
  log("✓ ゆうスロを公開しました（worldConfig/yuslot.yuslotPublished = true）");

  // 2) お知らせ投稿（固定ID・まだ無ければ）
  const now = new Date(deps.now());
  result.announced = await fs.createIfAbsent(`announcements/${ANNOUNCE_ID}`, {
    title: ANNOUNCE_TITLE, body: ANNOUNCE_BODY, createdAt: now, updatedAt: now,
    createdByUid: "github-actions", createdByName: "ゆうChat自動更新"
  });
  log(result.announced ? `✓ お知らせを投稿しました（announcements/${ANNOUNCE_ID}）` : "・お知らせはすでにあります（作成しません）");

  // 3) コイン配布（開店が未完了のときだけ・1人1回）
  const done = await fs.get(OPEN_MARKER);
  if (!done) {
    const users = await fs.query("users", [], { select: ["coins", BONUS_FLAG] });
    const targets = users.filter((u) => u.data[BONUS_FLAG] !== true);
    result.skipped = users.length - targets.length;
    for (let i = 0; i < targets.length; i += 400) {
      const chunk = targets.slice(i, i + 400);
      await fs.commit(chunk.map((u) => ({
        update: { name: fs.docName(`users/${u.id}`), fields: { [BONUS_FLAG]: { booleanValue: true } } },
        updateMask: { fieldPaths: [BONUS_FLAG] },
        updateTransforms: [{ fieldPath: "coins", increment: { integerValue: String(GRANT) } }],
        currentDocument: { exists: true }
      })));
      result.granted += chunk.length;
    }
    await fs.createIfAbsent(OPEN_MARKER, { kind: "yuslot-open", grantedTo: result.granted, grant: GRANT, at: now });
    log(`✓ コイン配布：${result.granted} 人に +${GRANT}（配布済みでスキップ ${result.skipped} 人）`);
  } else {
    log("・開店処理はすでに完了しています（コイン配布はスキップ）");
  }

  // 4) プッシュ通知（冪等）
  try {
    const r = await notify(deps, ANNOUNCE_ID);
    result.notified = r;
    log(r && r.skipped === "duplicate" ? "・プッシュ通知はすでに送信済み" : `✓ プッシュ通知：${(r && r.tokens) || 0} 台中 ${(r && r.sent) || 0} 台に送信`);
  } catch (error) {
    log("⚠ プッシュ通知に失敗（お知らせは投稿済み）：" + String(error?.message || error).slice(0, 100));
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (sa.project_id !== EXPECTED_PROJECT_ID) { console.error("サービスアカウントのプロジェクトが違います"); process.exit(1); }
  const deps = createDefaultDeps({ FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID: EXPECTED_PROJECT_ID });
  run({ deps })
    .then((r) => { console.log("完了", JSON.stringify(r)); process.exit(0); })
    .catch((e) => { console.error("エラー：" + String(e?.message || e).slice(0, 300)); process.exit(1); });
}
