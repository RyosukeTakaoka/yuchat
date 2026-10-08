/* 通知サーバーの自動公開の仕組み（.github/notify-worker/*.mjs）のテスト
   Cloudflare の API と本番の Worker は、ローカルの偽サーバーで置き換える（本物には接続しない）
   実行：node --test ".github/notify-worker/test/*.test.mjs" */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeCode, codeHash, diffSummary, fetchDeployedScript } from "../cloudflare.mjs";
import { handleRequest } from "../../../notify-worker/worker.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.resolve(here, "..");
const TOKEN = "test-token-should-never-be-printed";
const ACCOUNT = "test-account-id-0123";

/* ----- 偽の Cloudflare API ----- */
function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

function cloudflareApi(state) {
  return (req, res) => {
    state.requests.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(403, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] })); return; }
    if (req.url !== `/accounts/${ACCOUNT}/workers/scripts/yuuchat-notify/content/v2`) { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, errors: [{ code: 10007, message: "workers.api.error.script_not_found" }] })); return; }
    if (state.multipart) {
      const boundary = "----test";
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n${state.code}\r\n--${boundary}--\r\n`;
      res.writeHead(200, { "Content-Type": `multipart/form-data; boundary=${boundary}`, "cf-entrypoint": "worker.js" });
      res.end(body);
      return;
    }
    res.writeHead(200, { "Content-Type": "application/javascript", "cf-entrypoint": "worker.js" });
    res.end(state.code);
  };
}

function run(script, args, env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(scripts, script), ...args], { env: { PATH: process.env.PATH, ...env } }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, out: `${stdout}${stderr}` });
    });
  });
}

function knownDir(versions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "known-"));
  fs.writeFileSync(path.join(dir, "order.txt"), versions.map(([c]) => c).join("\n") + "\n");
  versions.forEach(([c, code]) => fs.writeFileSync(path.join(dir, `${c}.js`), code));
  return dir;
}

function readOutputs(file) {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => l.split("=")));
}

const V1 = "export default {\n  async fetch() { return new Response('v1'); }\n};\n";
const V2 = "export default {\n  async fetch() { return new Response('v2'); }\n};\n";

/* ===== 比べ方 ===== */

test("比べるとき、改行コード・行末の空白・末尾の改行の違いは無視する（中身の違いは無視しない）", () => {
  assert.equal(codeHash(V1), codeHash(V1.replace(/\n/g, "\r\n")));
  assert.equal(codeHash(V1), codeHash(V1.replace(/;\n/g, ";   \n") + "\n\n\n"));
  assert.equal(codeHash(V1), codeHash(`﻿${V1}`));
  assert.notEqual(codeHash(V1), codeHash(V2));
  assert.notEqual(codeHash(V1), codeHash(V1.replace("  async", "    async")));
  assert.equal(normalizeCode("a\r\nb  \n\n"), "a\nb\n");
  assert.deepEqual(diffSummary(V1, V2), { linesA: 4, linesB: 4, differentLines: 1, firstDifferentLine: 2 });
});

test("公開中のコードを読む：そのままの形・複数モジュール（multipart）の形のどちらも読める", async () => {
  const state = { requests: [], code: V1 };
  const { server, base } = await startServer(cloudflareApi(state));
  process.env.CLOUDFLARE_API_BASE = base;
  try {
    const { fetchDeployedScript: fetchWithBase } = await import(`../cloudflare.mjs?base=${encodeURIComponent(base)}`);
    assert.equal((await fetchWithBase({ token: TOKEN, accountId: ACCOUNT, scriptName: "yuuchat-notify" })).code, V1);
    state.multipart = true;
    assert.equal(normalizeCode((await fetchWithBase({ token: TOKEN, accountId: ACCOUNT, scriptName: "yuuchat-notify" })).code), normalizeCode(V1));
    assert.ok(state.requests.every((r) => r.method === "GET"), "読み取り（GET）だけ");
  } finally {
    server.close();
    delete process.env.CLOUDFLARE_API_BASE;
  }
});

test("公開中のコードを読む：鍵が無ければ通信せずに失敗する", async () => {
  await assert.rejects(fetchDeployedScript({ token: "", accountId: ACCOUNT, scriptName: "x", fetchImpl: () => { throw new Error("通信してはいけない"); } }), /ありません/);
});

/* ===== 公開前・公開後の比較（compare-deployed.mjs） ===== */

async function withApi(state, fn) {
  const { server, base } = await startServer(cloudflareApi(state));
  try { return await fn(base); } finally { server.close(); }
}

function envFor(base, current, known, extra = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "out-"));
  const currentFile = path.join(tmp, "worker.js");
  fs.writeFileSync(currentFile, current);
  const output = path.join(tmp, "output");
  fs.writeFileSync(output, "");
  return {
    output,
    env: { CLOUDFLARE_API_BASE: base, CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, SCRIPT_NAME: "yuuchat-notify", CURRENT_FILE: currentFile, KNOWN_DIR: known ? knownDir(known) : "", GITHUB_OUTPUT: output, ...extra }
  };
}

test("公開前：公開中のコードがリポジトリの古い版と一致 → 成功（一致した版を記録・いまの版とは違う）", async () => {
  await withApi({ requests: [], code: V1.replace(/\n/g, "\r\n") }, async (base) => {
    const { env, output } = envFor(base, V2, [["c2", V2], ["c1", V1]]);
    const r = await run("compare-deployed.mjs", ["before"], env);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(readOutputs(output), { up_to_date: "false", matched_commit: "c1" });
    assert.ok(!r.out.includes(TOKEN) && !r.out.includes(ACCOUNT), "鍵・Account ID をログに出さない");
  });
});

test("公開前：公開中のコードがいまの版と同じ → up_to_date=true", async () => {
  await withApi({ requests: [], code: V2 }, async (base) => {
    const { env, output } = envFor(base, V2, [["c2", V2], ["c1", V1]]);
    const r = await run("compare-deployed.mjs", ["before"], env);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(readOutputs(output), { up_to_date: "true", matched_commit: "c2" });
  });
});

test("公開前：公開中のコードがどの版とも一致しない（管理画面で直接変更）→ 失敗して公開しない", async () => {
  await withApi({ requests: [], code: V1.replace("v1", "管理画面で変更") }, async (base) => {
    const { env, output } = envFor(base, V2, [["c2", V2], ["c1", V1]]);
    const r = await run("compare-deployed.mjs", ["before"], env);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /どの版.*とも一致しません/);
    assert.equal(readOutputs(output).matched_commit, undefined);
    assert.ok(!r.out.includes("管理画面で変更"), "コードの中身はログに出さない");
  });
});

test("公開前：API トークンが違う・権限が無い → 失敗（トークンはログに出さない）", async () => {
  await withApi({ requests: [], code: V1 }, async (base) => {
    const { env } = envFor(base, V1, [["c1", V1]], { CLOUDFLARE_API_TOKEN: "wrong-token-xyz" });
    const r = await run("compare-deployed.mjs", ["before"], env);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /HTTP 403/);
    assert.ok(!r.out.includes("wrong-token-xyz") && !r.out.includes(ACCOUNT));
  });
});

test("公開後：公開中のコードがいまの worker.js と一致すれば成功、違えば失敗", async () => {
  await withApi({ requests: [], code: V2 }, async (base) => {
    assert.equal((await run("compare-deployed.mjs", ["after"], envFor(base, V2).env)).code, 0);
    const r = await run("compare-deployed.mjs", ["after"], envFor(base, V1).env);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /一致しません/);
  });
});

/* ===== 公開後の確認（smoke.mjs） ===== */

const ORIGIN = "https://yuchin0809.github.io";

function realWorkerServer() {
  /* 本物の worker.js（Firestore などは使わない経路だけを確かめる） */
  const deps = { now: () => Date.now(), verifyIdToken: async () => { throw new Error("no"); }, firestore: {}, sendFcm: async () => ({ ok: true }) };
  return async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(`https://worker.test${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await handleRequest(request, { ALLOWED_ORIGINS: ORIGIN }, deps);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

test("公開後の確認：いまの worker.js なら CORS・/notify と /admin のログインなし 401 がすべて通る", async () => {
  const { server, base } = await startServer(realWorkerServer());
  try {
    process.env.WORKER_URL = base; process.env.APP_ORIGIN = ORIGIN;
    const { runChecks } = await import(`../smoke.mjs?v=${Date.now()}`);
    const results = await runChecks();
    assert.deepEqual(results.map((x) => [x.name, x.ok]), [["CORS（OPTIONS /notify）", true], ["/notify：ログインなしは 401", true], ["/admin：ログインなしは 401", true]]);
  } finally {
    server.close();
    delete process.env.WORKER_URL; delete process.env.APP_ORIGIN;
  }
});

test("公開後の確認：URL が https でなければ、確認せずに失敗する", async () => {
  const r = await run("smoke.mjs", [], { WORKER_URL: "http://127.0.0.1:9", APP_ORIGIN: ORIGIN });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /WORKER_URL/);
});

test("公開後の確認：壊れた Worker（500 を返す）なら失敗として報告する", async () => {
  const { server, base } = await startServer((req, res) => { res.writeHead(500); res.end("boom"); });
  try {
    process.env.WORKER_URL = base; process.env.APP_ORIGIN = ORIGIN;
    const { runChecks } = await import(`../smoke.mjs?v=broken-${Date.now()}`);
    const results = await runChecks();
    assert.ok(results.every((x) => !x.ok));
  } finally {
    server.close();
    delete process.env.WORKER_URL; delete process.env.APP_ORIGIN;
  }
});
