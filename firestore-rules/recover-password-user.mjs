/* =========================================================
   一回限りの作業：パスワード未設定のゲストアカウントを、元の uid のまま
   「ユーザー名とパスワードでログイン」できる状態に戻す

   node recover-password-user.mjs check   … 読み取りだけ（何も変更しない）
   node recover-password-user.mjs apply   … 確認がすべて通ったときだけ、Authentication の
                                             そのユーザーに内部用メールアドレスと仮パスワードを設定する

   ・uid・メールアドレス・仮パスワードはログに出さない（::add-mask:: で伏せる）
   ・Firestore には一切書き込まない（前後の内容のハッシュが一致することを確かめる）
   ・Authentication のユーザーを作ったり消したりしない（存在しなければ何もせずに止まる）

   環境変数：FIREBASE_SERVICE_ACCOUNT、TARGET_NAME、（apply のみ）TEMP_PASSWORD
========================================================= */

import crypto from "crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp, DocumentReference, GeoPoint } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "yuuchat-be666";
/* script.js の firebaseConfig.apiKey（公開されているウェブ用のキー） */
const WEB_API_KEY = "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw";

const mode = process.argv[2];
const targetName = process.env.TARGET_NAME || "";

function mask(value) {
  if (value) console.log(`::add-mask::${value}`);
}

function canonical(value) {
  if (value instanceof Timestamp) return { $ts: value.toMillis() };
  if (value instanceof DocumentReference) return { $ref: value.path };
  if (value instanceof GeoPoint) return { $geo: [value.latitude, value.longitude] };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

/* このアカウントに関係する Firestore のデータをまとめて読み、ハッシュにする（読み取りのみ） */
async function snapshotFirestore(db, uid) {
  const userRef = db.doc(`users/${targetName}`);
  const userSnap = await userRef.get();
  const subcollections = await userRef.listCollections();
  const sub = {};
  for (const col of subcollections) {
    const docs = await col.get();
    sub[col.id] = docs.docs.map((d) => [d.id, d.data()]).sort((a, b) => a[0].localeCompare(b[0]));
  }
  const byUid = async (collection, field) => {
    const result = await db.collection(collection).where(field, "==", uid).get();
    return result.docs.map((d) => [d.id, d.data()]).sort((a, b) => a[0].localeCompare(b[0]));
  };
  const parts = {
    user: userSnap.exists ? userSnap.data() : null,
    userSubcollections: sub,
    raceBets: await byUid("raceBets", "uid"),
    groupsOwned: await byUid("groups", "ownerUid"),
    fcmTokens: await byUid("fcmTokens", "uid")
  };
  return {
    parts,
    counts: {
      raceBets: parts.raceBets.length,
      groupsOwned: parts.groupsOwned.length,
      fcmTokens: parts.fcmTokens.length,
      userSubcollections: Object.fromEntries(Object.entries(sub).map(([k, v]) => [k, v.length]))
    },
    hash: hash(parts)
  };
}

async function inspect(db, auth) {
  const report = { ok: false, reasons: [] };
  const userSnap = await db.doc(`users/${targetName}`).get();
  report.userDocExists = userSnap.exists;
  if (!userSnap.exists) {
    report.reasons.push(`users/${targetName} が見つかりません`);
    return report;
  }
  const data = userSnap.data();
  const uid = typeof data.uid === "string" ? data.uid : "";
  mask(uid);
  report.uid = uid;
  report.userDocFields = Object.keys(data).sort();
  report.userDocName = data.name === targetName;
  report.uidPresent = Boolean(uid);
  if (!uid) {
    report.reasons.push("users ドキュメントに uid がありません");
    return report;
  }

  const sameUid = await db.collection("users").where("uid", "==", uid).get();
  report.usersDocsWithThisUid = sameUid.size;

  const email = `u-${uid}@yuuchat.local`;
  mask(email);
  report.email = email;

  let authUser = null;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  report.authUserExists = Boolean(authUser);
  if (!authUser) {
    report.reasons.push("Authentication にこの uid のユーザーがありません（削除されている）");
    return report;
  }
  report.authUidMatches = authUser.uid === uid;
  report.authProviders = authUser.providerData.map((p) => p.providerId);
  report.authIsAnonymousOnly = authUser.providerData.length === 0;
  report.authHasEmail = Boolean(authUser.email);
  report.authEmailIsInternal = sameEmail(authUser.email, email);
  report.authDisabled = authUser.disabled;
  report.authCreated = authUser.metadata.creationTime;
  report.authLastSignIn = authUser.metadata.lastSignInTime;

  let emailOwner = null;
  try {
    emailOwner = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  report.internalEmailUsedByOtherUser = Boolean(emailOwner && emailOwner.uid !== uid);

  if (authUser.disabled) report.reasons.push("Authentication のユーザーが無効化されています");
  if (report.authProviders.includes("password")) report.reasons.push("すでにパスワードが設定されています");
  if (authUser.email && !sameEmail(authUser.email, email)) report.reasons.push("別のメールアドレスが設定されています");
  if (report.internalEmailUsedByOtherUser) report.reasons.push("内部用メールアドレスが別のユーザーに使われています");
  if (report.usersDocsWithThisUid !== 1) report.reasons.push(`この uid の users ドキュメントが ${report.usersDocsWithThisUid} 件あります`);
  if (!report.userDocName) report.reasons.push("users ドキュメントの name が一致しません");

  report.ok = report.reasons.length === 0;
  return report;
}

/* Authentication はメールアドレスを小文字にして保存するので、大文字小文字を区別せずに比べる */
function sameEmail(a, b) {
  return Boolean(a) && Boolean(b) && a.toLowerCase() === b.toLowerCase();
}

function printReport(title, report) {
  const shown = { ...report };
  delete shown.uid;
  delete shown.email;
  console.log(`--- ${title} ---`);
  console.log(JSON.stringify(shown, null, 2));
}

/* アプリの「ユーザー名とパスワードでログイン」と同じ手順：内部用メールアドレス＋パスワードでログインできるか */
async function tryPasswordSignIn(email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false })
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, localId: body.localId || "", error: body.error?.message || "" };
}

async function main() {
  if (mode !== "check" && mode !== "apply") throw new Error("check か apply を指定してください");
  if (!targetName) throw new Error("TARGET_NAME がありません");

  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (credentials.project_id !== EXPECTED_PROJECT_ID) throw new Error("サービスアカウントのプロジェクトが違います");
  initializeApp({ credential: cert(credentials) });
  const db = getFirestore();
  const auth = getAuth();

  const report = await inspect(db, auth);
  printReport("確認（読み取りのみ）", report);

  if (!report.uid) process.exit(1);
  const before = await snapshotFirestore(db, report.uid);
  console.log(`Firestore（このアカウント関係）: ${JSON.stringify(before.counts)} ハッシュ ${before.hash.slice(0, 16)}`);

  if (mode === "check") {
    console.log(report.ok ? "判定: 元の uid のまま復旧できます（apply で実行可能）" : `判定: このままでは復旧しません（${report.reasons.join(" / ")}）`);
    return;
  }

  /* ===== apply ===== */
  const password = process.env.TEMP_PASSWORD || "";
  mask(password);
  if (!report.ok) throw new Error(`確認が通らないため、何も変更せずに止めました（${report.reasons.join(" / ")}）`);
  if (password.length < 12) throw new Error("仮パスワードが登録されていないか、短すぎます（12文字以上）");

  /* Authentication のユーザーは作り直さず、メールアドレスとパスワードを追加するだけ（uid は変わらない） */
  await auth.updateUser(report.uid, { email: report.email, password });
  console.log("Authentication: 内部用メールアドレスと仮パスワードを設定しました");

  const after = await auth.getUser(report.uid);
  const check = {
    uidKept: after.uid === report.uid,
    internalEmailSet: sameEmail(after.email, report.email),
    passwordProviderLinked: after.providerData.some((p) => p.providerId === "password"),
    disabled: after.disabled
  };

  /* アプリと同じ流れ：users/{名前} の uid → 内部用メールアドレスでパスワードログイン */
  const userDocAgain = await db.doc(`users/${targetName}`).get();
  const emailFromName = `u-${userDocAgain.data()?.uid || ""}@yuuchat.local`;
  const signIn = await tryPasswordSignIn(emailFromName, password);
  check.passwordSignInOk = signIn.ok;
  check.passwordSignInSameUid = signIn.localId === report.uid;
  if (!signIn.ok) check.passwordSignInError = signIn.error;

  const afterFs = await snapshotFirestore(db, report.uid);
  check.firestoreUnchanged = afterFs.hash === before.hash;
  console.log(`Firestore（このアカウント関係・作業後）: ${JSON.stringify(afterFs.counts)} ハッシュ ${afterFs.hash.slice(0, 16)}`);

  console.log("--- 作業後の確認 ---");
  console.log(JSON.stringify(check, null, 2));
  const allOk = check.uidKept && check.internalEmailSet && check.passwordProviderLinked && !check.disabled
    && check.passwordSignInOk && check.passwordSignInSameUid && check.firestoreUnchanged;
  if (!allOk) throw new Error("作業後の確認に通らない項目があります");
  console.log("判定: 復旧完了（ユーザー名＋仮パスワードでログインできます）");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
