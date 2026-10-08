/* =========================================================
   main にマージされたプルリクエストの「📢 お知らせ文」を、アプリの 📢 お知らせ（announcements）に自動で載せる
   （.github/workflows/announce-merged-pr.yml から実行。main のコードだけが動き、PR の本文はデータとして読むだけ）

   1. どの PR か：push のときは、その push のコミットを merge_commit_sha に持つ「main へマージ済み」の PR
                 手動実行のときは、指定した番号の PR（main へマージ済みであること）
   2. PR の本文から「## 📢 お知らせ文」の「### タイトル」「### 本文」を取り出す（無い・空なら何もしない）
   3. 秘密の値（鍵・トークン・パスワードなど）らしいものが含まれていたら、載せずに止める
   4. announcements/pr-{番号} を「まだ無いときだけ」作る（同じ PR で何回実行しても1件だけ）
   5. 通知を ON にした端末へ「📢 ゆうChatアップデート」のプッシュ通知を送る（通知サーバーと同じ処理。同じお知らせは1回だけ）
      通知に失敗しても、お知らせはそのまま（警告だけ出す）

   環境変数：FIREBASE_SERVICE_ACCOUNT（Secrets）、GITHUB_TOKEN、GITHUB_REPOSITORY、GITHUB_SHA、GITHUB_EVENT_NAME、
            PR_NUMBER（手動実行のとき）、GITHUB_STEP_SUMMARY
   鍵・トークンの値はログに出さない
========================================================= */

import fs from "fs";
import { createDefaultDeps, notifyNewAnnouncement } from "../../notify-worker/worker.js";

export const TITLE_MAX = 50;
export const BODY_MAX = 500;
export const AUTO_CREATED_BY_UID = "github-actions";
export const AUTO_CREATED_BY_NAME = "ゆうChat自動更新";
const EXPECTED_PROJECT_ID = "yuuchat-be666";
const BASE_BRANCH = "main";

/* ----- PR の本文から、お知らせ文を取り出す ----- */

export function parseAnnouncement(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const start = lines.findIndex((line) => /^##\s*📢\s*お知らせ文\s*$/.test(line.trim()));
  if (start < 0) return { reason: "no_section" };
  /* 欄の終わり：次の大きな見出し（# / ##）・区切り線（---）・PR の末尾に付く「🤖 Generated with …」 */
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i]) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i]) || /^\s*🤖\s*Generated with/i.test(lines[i])) { end = i; break; }
  }
  const section = lines.slice(start + 1, end);

  const sub = (name) => {
    const from = section.findIndex((line) => new RegExp(`^###\\s*${name}\\s*$`).test(line.trim()));
    if (from < 0) return "";
    let to = section.length;
    for (let i = from + 1; i < section.length; i++) {
      if (/^###\s/.test(section[i])) { to = i; break; }
    }
    return section.slice(from + 1, to).join("\n");
  };

  const title = sub("タイトル").replace(/\s+/g, " ").trim();
  const text = sub("本文").split("\n").map((line) => line.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!title || !text) return { reason: "empty" };
  if (/^[（(]?なし[）)]?$/.test(title)) return { reason: "opted_out" };
  return { title: truncate(title, TITLE_MAX), body: truncate(text, BODY_MAX), truncated: title.length > TITLE_MAX || text.length > BODY_MAX };
}

/* アプリ・Rules と同じく、文字数は JavaScript の length（UTF-16）で数える。絵文字などの途中では切らない */
export function truncate(text, max) {
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 1);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/* ----- 秘密の値らしいもの（見つかったら載せない） ----- */

const SECRET_PATTERNS = [
  ["秘密鍵", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["サービスアカウントの鍵", /"(private_key|private_key_id|client_secret)"\s*:/],
  ["Google の API キー", /AIza[0-9A-Za-z_-]{30,}/],
  ["GitHub のトークン", /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["API トークン", /\b(sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,})/],
  ["パスワード・鍵の値", /(password|passwd|パスワード|secret|シークレット|token|トークン|api[ _-]?key|apiキー)\s*[:：=]\s*\S{4,}/i],
  ["長いランダムな文字列", /[A-Za-z0-9+/_-]{40,}/]
];

export function findSecret(text) {
  const hit = SECRET_PATTERNS.find(([, re]) => re.test(String(text || "")));
  return hit ? hit[0] : null;
}

/* ----- GitHub：どの PR か ----- */

async function github(path, token, fetchImpl) {
  const response = await fetchImpl(`${process.env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}（${path.split("?")[0]}）`);
  return response.json();
}

export async function findMergedPullRequest({ repo, sha, eventName, prNumber, token, fetchImpl = fetch }) {
  if (eventName === "workflow_dispatch") {
    if (!/^[1-9][0-9]{0,6}$/.test(String(prNumber || ""))) return { reason: "invalid_pr_number" };
    const pr = await github(`/repos/${repo}/pulls/${prNumber}`, token, fetchImpl);
    if (!pr.merged_at) return { reason: "not_merged", number: pr.number };
    if (pr.base?.ref !== BASE_BRANCH) return { reason: "not_main", number: pr.number };
    return { pr };
  }
  const pulls = await github(`/repos/${repo}/commits/${sha}/pulls`, token, fetchImpl);
  const pr = (Array.isArray(pulls) ? pulls : []).find((p) => p.merged_at && p.base?.ref === BASE_BRANCH && p.merge_commit_sha === sha);
  if (!pr) return { reason: "no_merged_pr" };
  return { pr };
}

/* ----- 本体 ----- */

export async function run({ env = process.env, fetchImpl = fetch, firestore = null, sendFcm = null, log = console.log } = {}) {
  const summary = (text) => { if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`); };
  const found = await findMergedPullRequest({
    repo: env.GITHUB_REPOSITORY, sha: env.GITHUB_SHA, eventName: env.GITHUB_EVENT_NAME, prNumber: env.PR_NUMBER, token: env.GITHUB_TOKEN, fetchImpl
  });
  if (!found.pr) {
    const message = {
      no_merged_pr: "この push は、main へマージされた PR のものではないので、お知らせは作りません",
      not_merged: `PR #${found.number} はマージされていないので、お知らせは作りません`,
      not_main: `PR #${found.number} は main へのマージではないので、お知らせは作りません`,
      invalid_pr_number: "PR の番号が正しくありません"
    }[found.reason];
    log(message); summary(`- ${message}`);
    return { posted: false, reason: found.reason };
  }

  const pr = found.pr;
  const parsed = parseAnnouncement(pr.body);
  if (!parsed.title) {
    const message = `PR #${pr.number} に「📢 お知らせ文」が無い（または空・なし）ので、お知らせは作りません`;
    log(message); summary(`- ${message}`);
    return { posted: false, reason: parsed.reason, number: pr.number };
  }
  const secret = findSecret(`${parsed.title}\n${parsed.body}`);
  if (secret) {
    /* 中身はログに出さない */
    const message = `PR #${pr.number} のお知らせ文に「${secret}」らしいものが含まれているため、お知らせは作りません。PR の本文を確認してください`;
    log(`::warning::${message}`); summary(`- ⚠ ${message}`);
    return { posted: false, reason: "secret", number: pr.number };
  }

  let deps;
  if (firestore) {
    deps = { firestore, sendFcm: sendFcm || (async () => ({ ok: true })), now: () => Date.now() };
  } else {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "{}");
    if (sa.project_id !== EXPECTED_PROJECT_ID) throw new Error("サービスアカウントのプロジェクトが違います");
    deps = createDefaultDeps({ FIREBASE_SERVICE_ACCOUNT: env.FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID: EXPECTED_PROJECT_ID });
  }
  const fsClient = deps.firestore;

  const now = new Date();
  const id = `pr-${pr.number}`;
  const created = await fsClient.createIfAbsent(`announcements/${id}`, {
    title: parsed.title,
    body: parsed.body,
    createdAt: now,
    updatedAt: now,
    createdByUid: AUTO_CREATED_BY_UID,
    createdByName: AUTO_CREATED_BY_NAME
  });
  const message = created
    ? `PR #${pr.number} のお知らせを作りました（announcements/${id}・タイトル「${parsed.title}」・本文 ${parsed.body.length} 文字${parsed.truncated ? "・長いので途中まで" : ""}）`
    : `PR #${pr.number} のお知らせはすでにあるので、作りませんでした（announcements/${id}）`;
  log(message); summary(`- ${message}`);

  /* プッシュ通知（すでに作ってあったお知らせでも呼ぶ。送った記録があれば送らないので二重にならない） */
  let notified = null;
  try {
    const result = await notifyNewAnnouncement(deps, id);
    notified = result;
    const note = result.skipped === "duplicate"
      ? "このお知らせのプッシュ通知はすでに送ってあります"
      : `プッシュ通知：${result.tokens ?? 0} 台中 ${result.sent ?? 0} 台に送信${result.failed ? `（失敗 ${result.failed} 台）` : ""}`;
    log(note); summary(`- ${note}`);
  } catch (error) {
    const note = `プッシュ通知を送れませんでした（お知らせは作成済み）：${String(error?.message || error).split(" ")[0].slice(0, 80)}`;
    log(`::warning::${note}`); summary(`- ⚠ ${note}`);
  }
  return { posted: created, reason: created ? "posted" : "duplicate", number: pr.number, id, notified };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(`エラー：${String(error?.message || error).slice(0, 300)}`);
    process.exit(1);
  });
}
