/* =========================================================
   公開中の Worker のコードと、リポジトリの worker.js を比べる（読み取りだけ。何も変更しない）

   node compare-deployed.mjs before   … 公開の前：公開中のコードが、リポジトリの worker.js の
                                         「いずれかの版（main の履歴）」と一致するか
                                         （管理画面で直接書き換えられたコードを上書きしないため。一致しなければ失敗）
   node compare-deployed.mjs after    … 公開の後：公開中のコードが、いまの worker.js と一致するか

   環境変数：CLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID（Secrets）、SCRIPT_NAME、CURRENT_FILE、
            KNOWN_DIR（before のみ。履歴の worker.js を「コミット.js」で置いたフォルダ）、GITHUB_OUTPUT・GITHUB_STEP_SUMMARY
========================================================= */

import fs from "fs";
import path from "path";
import { fetchDeployedScript, codeHash, diffSummary, normalizeCode } from "./cloudflare.mjs";

const mode = process.argv[2];
const output = (key, value) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); };
const summary = (text) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`); };

async function main() {
  if (mode !== "before" && mode !== "after") throw new Error("before か after を指定してください");
  const current = fs.readFileSync(process.env.CURRENT_FILE, "utf8");
  const deployed = await fetchDeployedScript({
    token: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    scriptName: process.env.SCRIPT_NAME
  });
  const deployedHash = codeHash(deployed.code);
  const currentHash = codeHash(current);
  const upToDate = deployedHash === currentHash;
  console.log(`公開中のコード：${deployedHash.slice(0, 12)}（${normalizeCode(deployed.code).split("\n").length} 行）`);
  console.log(`リポジトリの worker.js：${currentHash.slice(0, 12)}`);
  output("up_to_date", String(upToDate));

  if (mode === "after") {
    if (!upToDate) {
      console.log(`違い：${JSON.stringify(diffSummary(deployed.code, current))}`);
      throw new Error("公開後のコードが、リポジトリの worker.js と一致しません");
    }
    console.log("公開後のコードは、リポジトリの worker.js と一致しています");
    summary("- 公開後のコード：リポジトリの worker.js と一致");
    return;
  }

  /* before：履歴のどの版と一致するか（新しい順に探す） */
  const dir = process.env.KNOWN_DIR;
  const order = fs.readFileSync(path.join(dir, "order.txt"), "utf8").split("\n").filter(Boolean);
  const matched = order.find((commit) => codeHash(fs.readFileSync(path.join(dir, `${commit}.js`), "utf8")) === deployedHash);
  if (!matched) {
    console.log(`いまの worker.js との違い：${JSON.stringify(diffSummary(deployed.code, current))}`);
    summary("- ⚠ 公開中のコードが、リポジトリのどの版とも一致しません（管理画面で直接変更された可能性）。公開を止めました");
    throw new Error(`公開中のコードが、リポジトリの worker.js のどの版（${order.length} 個）とも一致しません。管理画面で直接変更された可能性があるため、公開しません`);
  }
  output("matched_commit", matched);
  console.log(`公開中のコードは、リポジトリの ${matched.slice(0, 7)} の worker.js と一致しています${upToDate ? "（いまの版と同じ）" : ""}`);
  summary(`- 公開前の確認：公開中のコードは ${matched.slice(0, 7)} の worker.js と一致${upToDate ? "（いまの版と同じ）" : ""}`);
}

main().catch((error) => {
  console.error(`エラー：${error.message}`);
  process.exit(1);
});
