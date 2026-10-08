/* =========================================================
   公開後の確認（本番の Worker に、ログインなしの要求だけを送る。データは何も変わらない）
   ・CORS：アプリのサイトからの事前確認（OPTIONS）に 204 と Access-Control-Allow-Origin を返す
   ・/notify：ログインなし（ID トークンなし）は 401
   ・/admin：ログインなし（ID トークンなし）は 401
   反映に少し時間がかかることがあるので、最大 SMOKE_TIMEOUT_MS（既定 90 秒）までやり直す

   環境変数：WORKER_URL（例 https://yuuchat-notify.xxx.workers.dev）、APP_ORIGIN、GITHUB_STEP_SUMMARY
========================================================= */

import fs from "fs";

const base = String(process.env.WORKER_URL || "").replace(/\/+$/, "");
const origin = process.env.APP_ORIGIN || "";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 90000);
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS || 5000);

export async function runChecks(fetchImpl = fetch) {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, detail: String(error.message || error).slice(0, 200) }); }
  };
  const expect = (cond, message) => { if (!cond) throw new Error(message); };

  await check("CORS（OPTIONS /notify）", async () => {
    const r = await fetchImpl(`${base}/notify`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" } });
    expect(r.status === 204, `HTTP ${r.status}`);
    expect(r.headers.get("access-control-allow-origin") === origin, `Access-Control-Allow-Origin: ${r.headers.get("access-control-allow-origin")}`);
  });
  for (const pathName of ["/notify", "/admin"]) {
    await check(`${pathName}：ログインなしは 401`, async () => {
      const r = await fetchImpl(`${base}${pathName}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
      const body = await r.json().catch(() => ({}));
      expect(r.status === 401, `HTTP ${r.status}`);
      expect(body.error === "unauthenticated", `error: ${body.error}`);
    });
  }
  return results;
}

async function main() {
  if (!base.startsWith("https://") || !origin) throw new Error("WORKER_URL / APP_ORIGIN がありません");
  const started = Date.now();
  let results;
  for (let attempt = 1; ; attempt++) {
    results = await runChecks();
    if (results.every((r) => r.ok)) break;
    if (Date.now() - started + intervalMs > timeoutMs) break;
    console.log(`まだ通らない項目があるので、やり直します（${attempt} 回目）：${results.filter((r) => !r.ok).map((r) => r.name).join("、")}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  results.forEach((r) => console.log(`${r.ok ? "OK  " : "NG  "} ${r.name}${r.ok ? "" : `（${r.detail}）`}`));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}`).join("\n") + "\n");
  if (!results.every((r) => r.ok)) throw new Error("公開後の確認に通らない項目があります");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`エラー：${error.message}`);
    process.exit(1);
  });
}
