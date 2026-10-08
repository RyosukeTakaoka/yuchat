/* =========================================================
   通知サーバー（Cloudflare Worker）の自動公開で使う共通の処理
   ・Cloudflare の API から、いま公開中の Worker のコードを読む（読み取りだけ）
   ・コードを比べるときは、改行コード・行末の空白・末尾の改行の違いだけは無視する
     （管理画面に貼り付けたときに付くことがあるため）
   ・API トークン・Account ID はログに出さない（エラーにも入れない）
========================================================= */

import crypto from "crypto";

export const CLOUDFLARE_API_BASE = process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4";

export function normalizeCode(text) {
  return String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "") + "\n";
}

export function codeHash(text) {
  return crypto.createHash("sha256").update(normalizeCode(text)).digest("hex");
}

/* 違う行の数と、最初に違う行の番号（中身は出さない） */
export function diffSummary(a, b) {
  const x = normalizeCode(a).split("\n"), y = normalizeCode(b).split("\n");
  let first = -1, count = 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) { count++; if (first < 0) first = i + 1; }
  }
  return { linesA: x.length, linesB: y.length, differentLines: count, firstDifferentLine: first };
}

/* 公開中の Worker のコード（メインのモジュール）を読む */
export async function fetchDeployedScript({ token, accountId, scriptName, fetchImpl = fetch }) {
  if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID がありません");
  const url = `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(scriptName)}/content/v2`;
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    let detail = "";
    try {
      const json = await response.json();
      detail = (json.errors || []).map((e) => `${e.code} ${String(e.message || "").slice(0, 120)}`).join(" / ");
    } catch (error) { /* 本文が JSON でなければ、状態コードだけ */ }
    throw new Error(`公開中のコードを読めませんでした（HTTP ${response.status}${detail ? `：${detail}` : ""}）`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!/multipart\/form-data/i.test(contentType)) return { code: await response.text(), entry: response.headers.get("cf-entrypoint") || "" };

  /* モジュールが複数ある形で返ってきたときは、メインのモジュールを選ぶ */
  const form = await response.formData();
  const entry = response.headers.get("cf-entrypoint") || "";
  const files = [...form.entries()].filter(([, value]) => typeof value !== "string");
  const picked = files.find(([name, value]) => name === entry || value.name === entry)
    || files.find(([name, value]) => name === "worker.js" || value.name === "worker.js")
    || (files.length === 1 ? files[0] : null);
  if (!picked) throw new Error(`公開中のコードからメインのモジュールを見つけられませんでした（${files.length} 個）`);
  return { code: await picked[1].text(), entry: entry || picked[0] };
}
