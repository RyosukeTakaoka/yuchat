/* =========================================================
   一回限りの確認：サービスアカウント（FIREBASE_SERVICE_ACCOUNT）が、👤 ユーザー管理で使う
   Firebase Authentication の管理用 API を呼べるか（本番のユーザーは一切変更しない）

   ・IAM：testIamPermissions で、必要な権限を持っているかだけを問い合わせる
   ・Identity Toolkit：通知サーバー（notify-worker/worker.js）と同じコード・同じ OAuth スコープで呼ぶ
       一覧取得（1件だけ）・存在確認は読み取り
       パスワード設定・停止・解除・セッション無効化・削除は「存在しない uid」に対して呼び、
       権限があれば USER_NOT_FOUND、無ければ PERMISSION_DENIED になることで判定する（実在のユーザーは変わらない）
   ・鍵・パスワード・uid・メールアドレスはログに出さない（鍵の識別には、ハッシュの先頭だけを出す）
========================================================= */

import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import { createDefaultDeps } from "../notify-worker/worker.js";

const EXPECTED_PROJECT_ID = "yuuchat-be666";
const PERMISSIONS = [
  "firebaseauth.users.get",
  "firebaseauth.users.update",
  "firebaseauth.users.delete",
  "firebaseauth.users.create",
  "datastore.entities.get",
  "datastore.entities.list",
  "datastore.entities.create",
  "datastore.entities.update",
  "datastore.entities.delete"
];

const sha = (text) => crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 12);

async function main() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const sa = JSON.parse(json || "{}");
  if (sa.project_id !== EXPECTED_PROJECT_ID) throw new Error("サービスアカウントのプロジェクトが違います");

  const report = {};
  /* 鍵そのものは出さない。同じ鍵かどうかを見分けるための指紋だけ */
  report.serviceAccountKind = /^firebase-adminsdk-/.test(String(sa.client_email)) ? "firebase-adminsdk（Firebase 標準の管理用）" : "その他";
  report.clientEmailSha256 = sha(sa.client_email);
  report.privateKeyIdHead = String(sa.private_key_id || "").slice(0, 8);
  report.wholeKeyJsonSha256 = sha(JSON.stringify({ client_email: sa.client_email, private_key_id: sa.private_key_id }));

  /* ---- IAM：必要な権限を持っているか ---- */
  try {
    const auth = new GoogleAuth({ credentials: sa, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const res = await client.request({
      url: `https://cloudresourcemanager.googleapis.com/v1/projects/${EXPECTED_PROJECT_ID}:testIamPermissions`,
      method: "POST",
      data: { permissions: PERMISSIONS }
    });
    const granted = new Set(res.data.permissions || []);
    report.iam = Object.fromEntries(PERMISSIONS.map((p) => [p, granted.has(p)]));
  } catch (error) {
    report.iam = `確認できませんでした（${error?.response?.status || ""} ${String(error?.response?.data?.error?.status || error?.message || "").slice(0, 80)}）`;
  }

  /* ---- Identity Toolkit：通知サーバーと同じコード・同じスコープで呼ぶ ---- */
  const deps = createDefaultDeps({ FIREBASE_SERVICE_ACCOUNT: json, FIREBASE_PROJECT_ID: EXPECTED_PROJECT_ID });
  const probeUid = `permission-probe-${crypto.randomBytes(8).toString("hex")}`;
  const outcome = async (fn) => {
    try { await fn(); return "OK"; } catch (error) { return error?.authCode || `ERROR ${String(error?.message || "").slice(0, 60)}`; }
  };

  report.identityToolkit = {};
  report.identityToolkit["一覧取得（listUsers）"] = await outcome(async () => {
    const users = await deps.authAdmin.listAll();
    report.identityToolkit["一覧の件数"] = users.length;
  });
  let probeExists = null;
  report.identityToolkit["存在確認（lookup・存在しない uid）"] = await outcome(async () => { probeExists = Boolean(await deps.authAdmin.lookup(probeUid)); });
  if (probeExists !== false) throw new Error("確認用の uid が存在する、または存在確認ができないため、書き込みの確認はしません");

  report.identityToolkit["パスワード設定・再設定（存在しない uid）"] = await outcome(() => deps.authAdmin.update(probeUid, { email: `u-${probeUid}@yuuchat.local`, password: crypto.randomBytes(18).toString("base64url") }));
  report.identityToolkit["停止（disableUser: true・存在しない uid）"] = await outcome(() => deps.authAdmin.update(probeUid, { disableUser: true }));
  report.identityToolkit["解除（disableUser: false・存在しない uid）"] = await outcome(() => deps.authAdmin.update(probeUid, { disableUser: false }));
  report.identityToolkit["セッション無効化（validSince・存在しない uid）"] = await outcome(() => deps.authAdmin.update(probeUid, { validSince: String(Math.floor(Date.now() / 1000)) }));
  /* worker.js の delete は USER_NOT_FOUND を成功として扱うので、権限が無ければ PERMISSION_DENIED で失敗する */
  report.identityToolkit["削除（存在しない uid）"] = await outcome(() => deps.authAdmin.delete(probeUid));
  report.identityToolkit["確認後も確認用の uid は存在しない（何も作られていない）"] = String(!(await deps.authAdmin.lookup(probeUid)));

  console.log(JSON.stringify(report, null, 2));
  console.log("判定の見方：書き込みの確認は USER_NOT_FOUND（削除は OK）なら権限あり。PERMISSION_DENIED / INSUFFICIENT_PERMISSION なら権限なし");
}

main().catch((error) => {
  console.error(`エラー: ${String(error?.message || error).slice(0, 200)}`);
  process.exit(1);
});
