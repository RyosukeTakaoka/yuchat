/* =========================================================
   ゆうChat 通知サーバー（Cloudflare Workers）

   アプリでメッセージを送ったあと、送信者の端末がここに
     POST /notify   Authorization: Bearer <Firebase の ID トークン>
                    { "messageId": "<messages のドキュメントID>" }
   を送る。Worker は
     1. ID トークンを検証して送信者の uid を確かめる（なりすまし防止）
     2. messages/{messageId} を読み、送信者本人のメッセージか確かめる
     3. 受信者を決める（友達チャット：friends の相手／グループ：送信者以外のメンバー）
     4. notificationLogs/{messageId} を「まだ無いときだけ」作る（同じメッセージの二重送信防止）
     5. 受信者の全端末（fcmTokens）へ FCM で送る。無効になったトークンは削除する
   を行う。送信者本人の端末には送らない。

   外部ライブラリを使わない1ファイルなので、Cloudflare の管理画面にそのまま貼り付けて使える。

   設定（Cloudflare の Worker → Settings → Variables and Secrets）：
     FIREBASE_SERVICE_ACCOUNT  （Secret）Firebase のサービスアカウントの鍵 JSON
     FIREBASE_PROJECT_ID       （Text）  yuuchat-be666
     ALLOWED_ORIGINS           （Text）  https://yuchin0809.github.io
========================================================= */

const DEFAULT_PROJECT_ID = "yuuchat-be666";
const DEFAULT_ALLOWED_ORIGINS = "https://yuchin0809.github.io";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const OAUTH_SCOPES = "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging";

/* 送信から時間がたったメッセージの通知は送らない */
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;
const FIRESTORE_IN_LIMIT = 30;
const NOTIFICATION_TTL_SECONDS = 24 * 60 * 60;

/* =========================================================
   入口
========================================================= */

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

export async function handleRequest(request, env = {}, deps = createDefaultDeps(env)) {
  const cors = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  try {
    /* 1. 送信者の確認 */
    const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!idToken) return jsonResponse({ error: "unauthenticated" }, 401, cors);

    let uid;
    try {
      uid = await deps.verifyIdToken(idToken);
    } catch (error) {
      console.warn("invalid id token", String(error.message || error));
      return jsonResponse({ error: "invalid_token" }, 401, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonResponse({ error: "invalid_json" }, 400, cors);
    }
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) return jsonResponse({ error: "invalid_message_id" }, 400, cors);

    const result = await notifyForMessage(deps, uid, messageId);
    return jsonResponse(result, result.status || 200, cors);
  } catch (error) {
    /* 詳しい内容は Cloudflare のログにだけ残し、呼び出し元には返さない */
    console.error("notify error", error);
    return jsonResponse({ error: "internal_error" }, 500, cors);
  }
}

/* =========================================================
   通知の本体
========================================================= */

export async function notifyForMessage(deps, uid, messageId) {
  const fs = deps.firestore;

  /* 2. メッセージを読み、送信者本人のものか確かめる */
  const message = await fs.get(`messages/${messageId}`);
  if (!message) return { status: 404, error: "message_not_found" };
  if (message.senderUid !== uid) return { status: 403, error: "not_sender" };
  if (message.deleted) return { skipped: "deleted" };

  const createdAt = message.createdAt ? Date.parse(message.createdAt) : NaN;
  if (!Number.isFinite(createdAt) || deps.now() - createdAt > MAX_MESSAGE_AGE_MS) return { skipped: "too_old" };

  /* 3. 受信者を決める（送信者本人は必ず除く） */
  const target = await resolveRecipients(fs, message, uid);
  if (!target) return { status: 403, error: "not_allowed" };
  const recipientUids = [...new Set(target.recipientUids)].filter((id) => id && id !== uid);
  if (recipientUids.length === 0) return { skipped: "no_recipients" };

  /* 4. 同じメッセージの通知は1回だけ（すでに記録があれば送らない） */
  const claimed = await fs.createIfAbsent(`notificationLogs/${messageId}`, {
    messageId,
    senderUid: uid,
    chatType: target.chatType,
    recipientCount: recipientUids.length,
    createdAt: new Date(deps.now())
  });
  if (!claimed) return { skipped: "duplicate" };

  /* 5. 受信者の全端末へ送る */
  const tokens = await getTokensForUids(fs, recipientUids);
  const data = buildNotificationData(messageId, message, target);

  let sent = 0, failed = 0;
  const removed = [];
  await Promise.all(tokens.map(async (token) => {
    const outcome = await deps.sendFcm(token, data);
    if (outcome.ok) { sent++; return; }
    failed++;
    if (outcome.invalidToken) {
      removed.push(token);
      await fs.delete(`fcmTokens/${token}`).catch(() => {});
    }
  }));

  await fs.update(`notificationLogs/${messageId}`, { tokenCount: tokens.length, sent, failed, removedTokens: removed.length })
    .catch((error) => console.warn("log update failed", error));

  return { sent, failed, removed: removed.length, recipients: recipientUids.length };
}

/* 友達チャット：friends ドキュメントに送信者の uid が含まれる場合だけ、もう一方へ
   グループ：送信者がメンバーで、その名前が本当に送信者のものである場合だけ、送信者以外のメンバーへ */
export async function resolveRecipients(fs, message, uid) {
  if (message.type === "friend") {
    const ids = [
      message.friendshipId,
      message.sender && message.receiver ? `${message.sender}_${message.receiver}` : null,
      message.sender && message.receiver ? `${message.receiver}_${message.sender}` : null
    ].filter(Boolean);

    for (const id of [...new Set(ids)]) {
      if (!/^[^/]{1,1500}$/.test(id)) continue;
      const friendship = await fs.get(`friends/${id}`);
      if (!friendship) continue;

      let recipientUid = null;
      if (friendship.user1Uid === uid) recipientUid = friendship.user2Uid;
      else if (friendship.user2Uid === uid) recipientUid = friendship.user1Uid;
      else return null;

      return { chatType: "friend", friendshipId: id, recipientUids: recipientUid ? [recipientUid] : [] };
    }
    return null;
  }

  if (message.type === "group" && message.groupId && /^[^/]{1,1500}$/.test(message.groupId)) {
    const group = await fs.get(`groups/${message.groupId}`);
    if (!group) return null;

    const members = Array.isArray(group.members) ? group.members : [];
    if (!message.sender || !members.includes(message.sender)) return null;

    const senderUser = await fs.get(`users/${message.sender}`);
    if (!senderUser || senderUser.uid !== uid) return null;

    const others = members.filter((name) => name && name !== message.sender && !name.includes("/"));
    const users = await fs.batchGet(others.map((name) => `users/${name}`));
    return {
      chatType: "group",
      groupId: message.groupId,
      groupName: group.name || "グループ",
      recipientUids: users.filter(Boolean).map((u) => u.uid).filter(Boolean)
    };
  }

  return null;
}

export function buildNotificationData(messageId, message, target) {
  const sender = truncate(message.sender || "友達", 30);

  if (target.chatType === "group") {
    return {
      kind: "message",
      messageId,
      chatType: "group",
      groupId: target.groupId,
      title: "ゆうChat",
      body: `${truncate(target.groupName, 30)}グループに新しいメッセージがあります`,
      link: `./?open=chat&group=${encodeURIComponent(target.groupId)}`,
      tag: `message-${messageId}`
    };
  }

  return {
    kind: "message",
    messageId,
    chatType: "friend",
    friendshipId: target.friendshipId,
    title: "ゆうChat",
    body: `${sender}さんからメッセージが届きました`,
    link: `./?open=chat&friendship=${encodeURIComponent(target.friendshipId)}`,
    tag: `message-${messageId}`
  };
}

async function getTokensForUids(fs, uids) {
  const tokens = [];
  for (let i = 0; i < uids.length; i += FIRESTORE_IN_LIMIT) {
    const docs = await fs.queryIn("fcmTokens", "uid", uids.slice(i, i + FIRESTORE_IN_LIMIT));
    docs.forEach((d) => tokens.push(d.id));
  }
  return [...new Set(tokens)];
}

function truncate(text, max) {
  const chars = [...String(text || "")];
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : chars.join("");
}

/* =========================================================
   HTTP まわり
========================================================= */

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function jsonResponse(data, status, cors) {
  const { status: _ignored, ...body } = data || {};
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(cors || {}) }
  });
}

/* =========================================================
   本番用の依存（Google の認証・Firestore REST・FCM HTTP v1）
========================================================= */

export function createDefaultDeps(env, fetchImpl = (...args) => fetch(...args)) {
  const projectId = env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const firestoreBase = env.FIRESTORE_BASE_URL || "https://firestore.googleapis.com/v1";
  const fcmBase = env.FCM_BASE_URL || "https://fcm.googleapis.com/v1";
  const getAccessToken = env.ACCESS_TOKEN_OVERRIDE
    ? async () => env.ACCESS_TOKEN_OVERRIDE
    : () => getServiceAccountAccessToken(env.FIREBASE_SERVICE_ACCOUNT, fetchImpl);

  return {
    now: () => Date.now(),
    verifyIdToken: (token) => verifyFirebaseIdToken(token, projectId, fetchImpl),
    firestore: createFirestoreClient({ base: firestoreBase, projectId, getAccessToken, fetchImpl }),
    sendFcm: (token, data) => sendFcmMessage({ base: fcmBase, projectId, getAccessToken, fetchImpl }, token, data)
  };
}

/* ----- Firebase の ID トークンの検証 ----- */

let cachedJwks = null;

async function getGoogleJwks(fetchImpl) {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const response = await fetchImpl(GOOGLE_JWKS_URL);
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  const json = await response.json();
  const maxAge = Number((response.headers.get("Cache-Control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  cachedJwks = { keys: json.keys || [], expiresAt: Date.now() + maxAge * 1000 };
  return cachedJwks.keys;
}

export function resetJwksCacheForTest() {
  cachedJwks = null;
}

export async function verifyFirebaseIdToken(token, projectId, fetchImpl, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");

  const header = JSON.parse(base64UrlDecodeToString(parts[0]));
  const payload = JSON.parse(base64UrlDecodeToString(parts[1]));
  if (header.alg !== "RS256" || !header.kid) throw new Error("bad header");

  const jwk = (await getGoogleJwks(fetchImpl)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key");

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, base64UrlDecode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("bad signature");

  const skew = 300;
  if (payload.aud !== projectId) throw new Error("bad audience");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad issuer");
  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) throw new Error("expired");
  if (typeof payload.iat !== "number" || payload.iat > nowSeconds + skew) throw new Error("issued in the future");
  if (typeof payload.auth_time === "number" && payload.auth_time > nowSeconds + skew) throw new Error("bad auth_time");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("bad subject");
  return payload.sub;
}

/* ----- サービスアカウントで Google のアクセストークンを取得 ----- */

let cachedAccessToken = null;

async function getServiceAccountAccessToken(serviceAccountJson, fetchImpl) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) return cachedAccessToken.token;
  if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");

  const sa = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = `${base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64UrlEncodeString(JSON.stringify({
    iss: sa.client_email, scope: OAUTH_SCOPES, aud: tokenUri, iat: now, exp: now + 3600
  }))}`;

  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;

  const response = await fetchImpl(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${assertion}`
  });
  if (!response.ok) throw new Error(`oauth ${response.status} ${await response.text()}`);
  const json = await response.json();
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
  return cachedAccessToken.token;
}

/* ----- Firestore REST ----- */

function createFirestoreClient({ base, projectId, getAccessToken, fetchImpl }) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const docUrl = (path) => `${base}/${root}/${path.split("/").map(encodeURIComponent).join("/")}`;

  const call = async (url, init = {}) => {
    const token = await getAccessToken();
    return fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  };

  return {
    async get(path) {
      const response = await call(docUrl(path));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`firestore get ${path} ${response.status} ${await response.text()}`);
      return decodeDocument(await response.json());
    },

    async batchGet(paths) {
      if (paths.length === 0) return [];
      const response = await call(`${base}/${root}:batchGet`, {
        method: "POST",
        body: JSON.stringify({ documents: paths.map((p) => `${root}/${p}`) })
      });
      if (!response.ok) throw new Error(`firestore batchGet ${response.status} ${await response.text()}`);
      const results = await response.json();
      const byName = new Map(results.filter((r) => r.found).map((r) => [r.found.name, decodeDocument(r.found)]));
      return paths.map((p) => byName.get(`projects/${projectId}/databases/(default)/documents/${p}`) || null);
    },

    async createIfAbsent(path, data) {
      const [collection, id] = path.split("/");
      const response = await call(`${base}/${root}/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify({ fields: encodeFields(data) })
      });
      if (response.status === 409) return false;
      if (!response.ok) throw new Error(`firestore create ${path} ${response.status} ${await response.text()}`);
      return true;
    },

    async update(path, data) {
      const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const response = await call(`${docUrl(path)}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields: encodeFields(data) }) });
      if (!response.ok) throw new Error(`firestore update ${path} ${response.status} ${await response.text()}`);
    },

    async delete(path) {
      const response = await call(docUrl(path), { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(`firestore delete ${path} ${response.status}`);
    },

    async queryIn(collectionId, field, values) {
      const response = await call(`${base}/${root}:runQuery`, {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: { fieldFilter: { field: { fieldPath: field }, op: "IN", value: { arrayValue: { values: values.map((v) => ({ stringValue: v })) } } } }
          }
        })
      });
      if (!response.ok) throw new Error(`firestore query ${response.status} ${await response.text()}`);
      return (await response.json()).filter((r) => r.document).map((r) => ({ id: r.document.name.split("/").pop(), ...decodeDocument(r.document) }));
    }
  };
}

function decodeValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([k, v]) => { out[k] = decodeValue(v); });
  return out;
}

function decodeDocument(document) {
  return decodeFields(document.fields || {});
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

function encodeFields(data) {
  const out = {};
  Object.entries(data).forEach(([k, v]) => { out[k] = encodeValue(v); });
  return out;
}

/* ----- FCM HTTP v1 ----- */

async function sendFcmMessage({ base, projectId, getAccessToken, fetchImpl }, token, data) {
  const accessToken = await getAccessToken();
  const response = await fetchImpl(`${base}/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        data,
        webpush: { headers: { Urgency: "high", TTL: String(NOTIFICATION_TTL_SECONDS) } }
      }
    })
  });
  if (response.ok) return { ok: true };

  const text = await response.text();
  /* もう使えないトークン（登録解除・不正）は削除する */
  const invalidToken = response.status === 404 || /UNREGISTERED|registration token|Requested entity was not found/i.test(text);
  return { ok: false, status: response.status, invalidToken, detail: text.slice(0, 300) };
}

/* ----- base64url / PEM ----- */

function base64UrlDecode(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlDecodeToString(input) {
  return new TextDecoder().decode(base64UrlDecode(input));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(text) {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function pemToArrayBuffer(pem) {
  const base64 = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}
