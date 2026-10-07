/* =========================================================
   ゲームルームの整理（一時的な運用スクリプト。GitHub Actions から実行）
   ・mode "inventory"（既定）：読み取りだけ。削除対象の件数と、全コレクションの件数を表示する
   ・mode "delete"：request.json に書いた cutoff（この時刻までに作られたルーム）と
     expected（確認済みの件数）に一致するときだけ削除する
   対象は gameRooms・gameRoomOwners・gameInvites の3つだけ。それ以外のコレクションは読み取り（件数）だけ。
   リポジトリは公開なので、ログには件数などの集計だけを出す（ユーザー名・ルームの中身は出さない）
========================================================= */

import fs from "fs";
import { createRequire } from "module";
const require = createRequire(new URL("../../derby-runner/package.json", import.meta.url));
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const TARGETS = ["gameRooms", "gameRoomOwners", "gameInvites"];
const request = JSON.parse(fs.readFileSync(new URL("./request.json", import.meta.url), "utf8"));
const mode = request.mode === "delete" ? "delete" : "inventory";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountJson) initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
else if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-yuuchat" }); /* テスト（Emulator）だけ */
else throw new Error("FIREBASE_SERVICE_ACCOUNT が設定されていません");
const db = getFirestore();

const out = [];
const print = (line = "") => { out.push(line); console.log(line); };
const jst = (date) => (date ? new Date(date.getTime() + 9 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + " JST" : "-");
const tally = (items, key) => items.reduce((m, x) => { const k = key(x) ?? "(なし)"; m[k] = (m[k] || 0) + 1; return m; }, {});
const fmt = (obj) => Object.entries(obj).sort().map(([k, v]) => `${k}: ${v}`).join(" / ") || "-";

async function countAllCollections() {
  const counts = {};
  for (const col of await db.listCollections()) counts[col.id] = (await col.count().get()).data().count;
  return counts;
}

/* ルーム関連の3つを読み、削除対象を決める（cutoff より後に作られたルームと、それを指す鍵・招待は残す） */
async function plan(cutoff) {
  const [roomsSnap, ownersSnap, invitesSnap] = await Promise.all(TARGETS.map((c) => db.collection(c).get()));
  const rooms = roomsSnap.docs;
  const deleteRooms = rooms.filter((d) => !cutoff || d.createTime.toMillis() <= cutoff.toMillis());
  const deleteRoomIds = new Set(deleteRooms.map((d) => d.id));
  const keptRoomIds = new Set(rooms.filter((d) => !deleteRoomIds.has(d.id)).map((d) => d.id));
  const pointsToKeptRoom = (d) => keptRoomIds.has(d.get("roomId"));
  return {
    rooms, owners: ownersSnap.docs, invites: invitesSnap.docs,
    deleteRooms,
    deleteOwners: ownersSnap.docs.filter((d) => !pointsToKeptRoom(d)),
    deleteInvites: invitesSnap.docs.filter((d) => !pointsToKeptRoom(d))
  };
}

async function describe(p) {
  const now = Date.now();
  const age = (d) => { const t = (d.get("updatedAt") || d.get("createdAt") || d.createTime).toDate().getTime(); const h = (now - t) / 3600000; return h < 1 ? "1時間以内" : h < 24 ? "1〜24時間" : h < 24 * 7 ? "1〜7日" : "7日より前"; };
  const created = p.rooms.map((d) => d.createTime.toDate().getTime());
  print(`### gameRooms（ゲームルーム）: ${p.rooms.length} 件`);
  print(`- ゲームの種類: ${fmt(tally(p.rooms, (d) => d.get("gameType")))}`);
  print(`- 状態: ${fmt(tally(p.rooms, (d) => d.get("status")))}`);
  print(`- 種類×状態: ${fmt(tally(p.rooms, (d) => `${d.get("gameType")}/${d.get("status")}`))}`);
  print(`- 参加人数: ${fmt(tally(p.rooms, (d) => `${(d.get("members") || []).length}人`))}`);
  print(`- 最後の更新: ${fmt(tally(p.rooms, age))}`);
  print(`- 作成日時: 最古 ${created.length ? jst(new Date(Math.min(...created))) : "-"} 〜 最新 ${created.length ? jst(new Date(Math.max(...created))) : "-"}`);
  print(`- 作成者の人数: ${new Set(p.rooms.map((d) => d.get("ownerUid"))).size} 人`);
  let withSub = 0; const subNames = new Set();
  for (const d of p.rooms) { const subs = await d.ref.listCollections(); if (subs.length) { withSub++; subs.forEach((s) => subNames.add(s.id)); } }
  print(`- サブコレクションのあるルーム: ${withSub} 件${subNames.size ? `（${[...subNames].join(", ")}）` : ""}`);
  const roomIds = new Set(p.rooms.map((d) => d.id));
  print(`### gameRoomOwners（1人1ゲーム1ルームの制限用）: ${p.owners.length} 件`);
  print(`- ゲームの種類: ${fmt(tally(p.owners, (d) => d.get("gameType")))}`);
  print(`- 指しているルームが存在する: ${p.owners.filter((d) => roomIds.has(d.get("roomId"))).length} 件 / 存在しない: ${p.owners.filter((d) => !roomIds.has(d.get("roomId"))).length} 件`);
  print(`### gameInvites（ゲームの招待）: ${p.invites.length} 件`);
  print(`- 状態: ${fmt(tally(p.invites, (d) => d.get("status")))}`);
  print(`- 招待先のルームが存在する: ${p.invites.filter((d) => roomIds.has(d.get("roomId"))).length} 件 / 存在しない: ${p.invites.filter((d) => !roomIds.has(d.get("roomId"))).length} 件`);
}

async function main() {
  print(`## ゲームルームの整理（mode: ${mode}）`);
  print(`実行時刻: ${jst(new Date())}`);
  const before = await countAllCollections();
  print(`### 全コレクションの件数（実行前）`);
  Object.entries(before).sort().forEach(([k, v]) => print(`- ${k}: ${v}`));
  const others = Object.keys(before).filter((c) => !TARGETS.includes(c) && /room|game|daifugo|othello|shogi|invite/i.test(c));
  print(`- ルーム関連と思われる他のコレクション: ${others.length ? others.join(", ") : "なし"}`);

  if (mode === "inventory") {
    const cutoff = Timestamp.now();
    const p = await plan(cutoff);
    await describe(p);
    print(`### 削除する場合の対象（cutoff = ${cutoff.toDate().toISOString()} までに作られたルーム）`);
    print(`- gameRooms: ${p.deleteRooms.length} 件（全件）`);
    print(`- gameRoomOwners: ${p.deleteOwners.length} 件（削除するルーム・存在しないルームを指すもの）`);
    print(`- gameInvites: ${p.deleteInvites.length} 件（削除するルーム・存在しないルームを指すもの）`);
    print(`CONFIRM_TEMPLATE {"mode":"delete","cutoff":"${cutoff.toDate().toISOString()}","expected":{"gameRooms":${p.deleteRooms.length},"gameRoomOwners":${p.deleteOwners.length},"gameInvites":${p.deleteInvites.length}}}`);
    return;
  }

  /* ---- 削除 ---- */
  const cutoff = Timestamp.fromDate(new Date(request.cutoff));
  if (Number.isNaN(cutoff.toMillis())) throw new Error("cutoff が正しくありません");
  const expected = request.expected || {};
  const p = await plan(cutoff);
  const actual = { gameRooms: p.deleteRooms.length, gameRoomOwners: p.deleteOwners.length, gameInvites: p.deleteInvites.length };
  print(`### 削除対象（cutoff = ${cutoff.toDate().toISOString()}）`);
  print(`- 確認済みの件数: ${fmt(expected)}`);
  print(`- 今回の件数: ${fmt(actual)}`);
  /* cutoff より前に作られたルームは増えない。確認済みの件数より多ければ、何かがおかしいので削除しない */
  for (const c of TARGETS) {
    if (typeof expected[c] !== "number" || actual[c] > expected[c]) throw new Error(`件数が確認済みの値を超えています（${c}: ${actual[c]} > ${expected[c]}）。削除を中止しました`);
  }

  const writer = db.bulkWriter();
  let failed = 0;
  writer.onWriteError((err) => { failed++; return err.failedAttempts < 3; });
  for (const d of p.deleteRooms) {
    const subs = await d.ref.listCollections();
    if (subs.length) await db.recursiveDelete(d.ref, writer); else writer.delete(d.ref);
  }
  for (const d of [...p.deleteOwners, ...p.deleteInvites]) writer.delete(d.ref);
  await writer.close();
  print(`- 削除: gameRooms ${actual.gameRooms} / gameRoomOwners ${actual.gameRoomOwners} / gameInvites ${actual.gameInvites}（失敗 ${failed}）`);

  const after = await countAllCollections();
  const rest = await plan(null);
  const restRoomIds = new Set(rest.rooms.map((d) => d.id));
  print(`### 削除後`);
  print(`- gameRooms の残り: ${rest.rooms.length} 件（cutoff より後に作られたもの: ${rest.rooms.filter((d) => d.createTime.toMillis() > cutoff.toMillis()).length} 件）`);
  print(`- gameRoomOwners の残り: ${rest.owners.length} 件（存在しないルームを指すもの: ${rest.owners.filter((d) => !restRoomIds.has(d.get("roomId"))).length} 件）`);
  print(`- gameInvites の残り: ${rest.invites.length} 件（存在しないルームを指すもの: ${rest.invites.filter((d) => !restRoomIds.has(d.get("roomId"))).length} 件）`);
  print(`### 全コレクションの件数（実行前 → 実行後）`);
  [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().forEach((c) => {
    const mark = TARGETS.includes(c) ? "（削除対象）" : before[c] === after[c] ? "" : "（利用による変化）";
    print(`- ${c}: ${before[c] ?? 0} → ${after[c] ?? 0}${mark}`);
  });
  if (failed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  print(`エラー: ${error.message || error}`);
  process.exitCode = 1;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join("\n") + "\n");
}
