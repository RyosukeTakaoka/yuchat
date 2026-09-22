/* =========================================================
   ゆうChat script.js  完全書き直し版
   ・構文エラー修正
   ・重複実装の統合（ゲーム部屋 / 大富豪の二重実装など）
   ・存在しない変数・関数参照の修正
   ・HTMLのid・data属性との整合を確認済み
========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc,
  updateDoc, deleteDoc, query, where, onSnapshot, orderBy,
  serverTimestamp, writeBatch, runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  getMessaging, getToken, onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

/* =========================================================
   Firebase設定
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw",
  authDomain: "yuuchat-be666.firebaseapp.com",
  projectId: "yuuchat-be666",
  storageBucket: "yuuchat-be666.firebasestorage.app",
  messagingSenderId: "89509274877",
  appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};

const VAPID_PUBLIC_KEY =
  "BNKlLucsJnYok43m4muAEkcQq8cOcNrUKFyNYkCeo2jKhm1RwJVAU6tC7p3PjoaidOU08Hh7oEeRz43S8X73Ppw";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

/* =========================================================
   アプリ状態
========================================================= */

let currentUser = null;
let username = null;
let pendingRecovery = false;

let friendsData = [];
let groupsData = [];

let selectedChat = null;
let selectedChatType = null;
let selectedFriendshipId = null;

let replyingMessage = null;
let pendingImageData = null;

let unsubscribeFriends = null;
let unsubscribeGroups = null;
let unsubscribeMessages = null;

let notificationsInitialized = false;

/* ゲーム関連の状態 */
let currentGameType = "daifugo";
let selectedGameRoomId = null;
let unsubscribeGameRooms = null;
let unsubscribeCurrentGame = null;
let selectedDaifugoCards = [];
let selectedShogiPiece = null;
let currentShogiPlayer = "sente";

/* ゆうダービー関連の状態 */
let myCoins = 0;
let unsubscribeMyCoins = null;
let unsubscribeTodayRace = null;
let unsubscribeWinBets = null;
let unsubscribeMyBetHistory = null;
let raceCountdownTimer = null;
let currentWinPool = {};
let bettingLocked = false;
let todayRaceResult = null;
let todayRaceGenerationAttempted = false;
let lastCheckedRaceId = null;

/* =========================================================
   HTML要素取得（index.htmlのidと一致させています）
========================================================= */

const loginScreen = document.getElementById("loginScreen");
const nameScreen = document.getElementById("nameScreen");
const appElement = document.getElementById("app");

const googleLoginButton = document.getElementById("googleLoginButton");
const guestLoginButton = document.getElementById("guestLoginButton");
const existingLoginButton = document.getElementById("existingLoginButton");
const loginError = document.getElementById("loginError");

const nameInput = document.getElementById("nameInput");
const startChatButton = document.getElementById("startChatButton");
const nameError = document.getElementById("nameError");

const recoverScreen = document.getElementById("recoverScreen");
const recoverStepText = document.getElementById("recoverStepText");
const recoverAuthStep = document.getElementById("recoverAuthStep");
const recoverGoogleButton = document.getElementById("recoverGoogleButton");
const recoverGuestButton = document.getElementById("recoverGuestButton");
const recoverNameStep = document.getElementById("recoverNameStep");
const recoverUsernameInput = document.getElementById("recoverUsernameInput");
const recoverConfirmButton = document.getElementById("recoverConfirmButton");
const recoverNewAccountButton = document.getElementById("recoverNewAccountButton");
const recoverError = document.getElementById("recoverError");
const recoverBackButton = document.getElementById("recoverBackButton");

const myName = document.getElementById("myName");
const statusElement = document.getElementById("status");

const friendsList = document.getElementById("friendsList");
const groupsList = document.getElementById("groupsList");

const addFriendButton = document.getElementById("addFriendButton");
const createGroupButton = document.getElementById("createGroupButton");
const logoutButton = document.getElementById("logoutButton");

const chatHeader = document.getElementById("chatHeader");
const messagesElement = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const replyBar = document.getElementById("replyBar");
const replyText = document.getElementById("replyText");
const cancelReplyButton = document.getElementById("cancelReplyButton");

const profileImageInput = document.getElementById("profileImageInput");
const myProfileImage = document.getElementById("myProfileImage");
const profileImagePlaceholder = document.getElementById("profileImagePlaceholder");
const changeNameButton = document.getElementById("changeNameButton");

const imageButton = document.getElementById("imageButton");
const imageInput = document.getElementById("imageInput");

const chatView = document.getElementById("chatView");
const derbyView = document.getElementById("derbyView");
const gamesView = document.getElementById("gamesView");
const mypageView = document.getElementById("mypageView");

const derbyCountdown = document.getElementById("derbyCountdown");
const raceTrack = document.getElementById("raceTrack");
const raceInfo = document.getElementById("raceInfo");
const oddsList = document.getElementById("oddsList");
const betType = document.getElementById("betType");
const betHorses = document.getElementById("betHorses");
const betAmount = document.getElementById("betAmount");
const betButton = document.getElementById("betButton");
const horseList = document.getElementById("horseList");

const gameRoomsEl = document.getElementById("gameRooms");
const gameAreaEl = document.getElementById("gameArea");
const createGameRoomButton = document.getElementById("createGameRoom");

const myCoinLarge = document.getElementById("myCoinLarge");
const myBetCount = document.getElementById("myBetCount");
const myHitCount = document.getElementById("myHitCount");
const myProfit = document.getElementById("myProfit");
const rankingEl = document.getElementById("ranking");
const historyEl = document.getElementById("history");
const coinBalanceEl = document.getElementById("coinBalance");

/* =========================================================
   共通関数
========================================================= */

function showError(element, text) {
  if (element) element.textContent = text || "";
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function createFriendshipId(userA, userB) {
  return [userA, userB].sort((a, b) => a.localeCompare(b)).join("_");
}

/* =========================================================
   ログイン
========================================================= */

googleLoginButton?.addEventListener("click", async () => {
  try {
    showError(loginError, "");
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Googleログインエラー:", error);
    showError(loginError, "ログインに失敗しました。");
  }
});

guestLoginButton?.addEventListener("click", async () => {
  try {
    showError(loginError, "");
    await signInAnonymously(auth);
  } catch (error) {
    console.error("ゲストログインエラー:", error);
    showError(loginError, "ゲストログインに失敗しました。");
  }
});

/* =========================================================
   ログイン（既存アカウントを探す）
   ・パスワードは使わず、Firebase Authの uid が一致する場合のみ
     そのユーザー名のアカウントを復元できる仕組み
   ・他人のユーザー名を入力しても uid が一致しなければ復元できない
========================================================= */

function showRecoverAuthStep() {
  loginScreen?.classList.add("hidden");
  nameScreen?.classList.add("hidden");
  recoverScreen?.classList.remove("hidden");
  recoverAuthStep?.classList.remove("hidden");
  recoverNameStep?.classList.add("hidden");
  if (recoverStepText) recoverStepText.textContent = "まずはログイン方法を選んでください";
  showError(recoverError, "");
  if (recoverUsernameInput) recoverUsernameInput.value = "";
}

function showRecoverNameStepIfReady() {
  if (pendingRecovery && currentUser) {
    recoverAuthStep?.classList.add("hidden");
    recoverNameStep?.classList.remove("hidden");
    if (recoverStepText) recoverStepText.textContent = "以前使っていた名前を入力してください";
  }
}

existingLoginButton?.addEventListener("click", () => {
  pendingRecovery = true;
  showRecoverAuthStep();
});

recoverGoogleButton?.addEventListener("click", async () => {
  try {
    showError(recoverError, "");
    pendingRecovery = true;
    await signInWithPopup(auth, new GoogleAuthProvider());
    showRecoverNameStepIfReady();
  } catch (error) {
    console.error("Googleログインエラー:", error);
    showError(recoverError, "ログインに失敗しました。");
  }
});

recoverGuestButton?.addEventListener("click", async () => {
  try {
    showError(recoverError, "");
    pendingRecovery = true;
    await signInAnonymously(auth);
    showRecoverNameStepIfReady();
  } catch (error) {
    console.error("ゲストログインエラー:", error);
    showError(recoverError, "ゲストログインに失敗しました。");
  }
});

recoverConfirmButton?.addEventListener("click", async () => {
  const name = recoverUsernameInput?.value.trim();
  showError(recoverError, "");

  if (!name) return showError(recoverError, "名前を入力してください。");
  if (!currentUser) return showError(recoverError, "ログインが完了していません。");

  try {
    recoverConfirmButton.disabled = true;
    const userDoc = await getDoc(doc(db, "users", name));

    if (!userDoc.exists()) {
      showError(recoverError, "そのアカウントは見つかりませんでした。");
      return;
    }

    if (userDoc.data().uid !== currentUser.uid) {
      showError(recoverError, "このアカウントの持ち主ではないため、ログインできません。");
      return;
    }

    username = name;
    localStorage.setItem("yuuchat_username", username);
    pendingRecovery = false;
    await saveUserProfile();
    showApp();
  } catch (error) {
    console.error("アカウント確認エラー:", error);
    showError(recoverError, "確認中にエラーが発生しました。");
  } finally {
    recoverConfirmButton.disabled = false;
  }
});

recoverNewAccountButton?.addEventListener("click", () => {
  pendingRecovery = false;
  recoverScreen?.classList.add("hidden");
  if (currentUser) {
    showNameScreen();
  } else {
    showRecoverAuthStep();
  }
});

recoverBackButton?.addEventListener("click", async () => {
  pendingRecovery = false;
  recoverScreen?.classList.add("hidden");

  if (currentUser && !username) {
    try { await signOut(auth); } catch (error) { console.error("サインアウトエラー:", error); }
  } else {
    loginScreen?.classList.remove("hidden");
  }
});

/* =========================================================
   Firebase認証状態
========================================================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    username = null;
    pendingRecovery = false;
    loginScreen?.classList.remove("hidden");
    nameScreen?.classList.add("hidden");
    recoverScreen?.classList.add("hidden");
    appElement?.classList.add("hidden");
    return;
  }

  currentUser = user;

  if (pendingRecovery) {
    showRecoverNameStepIfReady();
    return;
  }

  const savedName = localStorage.getItem("yuuchat_username");
  let suggestedName = savedName || user.displayName || null;

  if (!suggestedName) {
    showNameScreen();
    return;
  }

  try {
    const userRef = doc(db, "users", suggestedName);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists() || !userDoc.data().uid || userDoc.data().uid === user.uid) {
      username = suggestedName;
      localStorage.setItem("yuuchat_username", username);
      await saveUserProfile();
      showApp();
    } else {
      showNameScreen();
    }
  } catch (error) {
    console.error("ユーザー確認エラー:", error);
    showNameScreen();
  }
});

/* =========================================================
   名前画面
========================================================= */

function showNameScreen() {
  loginScreen?.classList.add("hidden");
  nameScreen?.classList.remove("hidden");
  appElement?.classList.add("hidden");
  if (nameInput) nameInput.value = localStorage.getItem("yuuchat_username") || "";
}

startChatButton?.addEventListener("click", async () => {
  const name = nameInput?.value.trim();
  showError(nameError, "");

  if (!name) return showError(nameError, "名前を入力してください。");
  if (name.length > 20) return showError(nameError, "名前は20文字以内にしてください。");
  if (!/^[ぁ-んァ-ヶ一-龠a-zA-Z0-9 _\-]+$/.test(name)) {
    return showError(nameError, "使用できない文字が含まれています。");
  }

  try {
    startChatButton.disabled = true;
    const userRef = doc(db, "users", name);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists() && userDoc.data().uid !== currentUser?.uid) {
      showError(nameError, "その名前はすでに使われています。");
      return;
    }

    username = name;
    localStorage.setItem("yuuchat_username", username);
    await saveUserProfile();
    showApp();
  } catch (error) {
    console.error("名前設定エラー:", error);
    showError(nameError, "名前の設定に失敗しました。");
  } finally {
    startChatButton.disabled = false;
  }
});

/* =========================================================
   ユーザープロフィール
========================================================= */

async function saveUserProfile() {
  if (!currentUser || !username) return;

  const userRef = doc(db, "users", username);
  const existing = await getDoc(userRef);
  const oldData = existing.exists() ? existing.data() : {};
  const profileImage = localStorage.getItem("yuuchat_profile_image") || "";

  await setDoc(userRef, {
    uid: currentUser.uid,
    name: username,
    photoURL: currentUser.photoURL || "",
    profileImage,
    online: true,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: oldData.createdAt || serverTimestamp()
  }, { merge: true });
}

function showApp() {
  loginScreen?.classList.add("hidden");
  nameScreen?.classList.add("hidden");
  appElement?.classList.remove("hidden");
  if (myName) myName.textContent = username || "ユーザー";
  loadProfileImage();
  startApp();
}

/* =========================================================
   アプリ開始
========================================================= */

async function startApp() {
  if (!currentUser || !username) return;

  try {
    await updateOnlineStatus(true);
    listenFriends();
    listenGroups();
    initializeNotifications();
    listenMyCoins();
    listenMyBetHistory();
    try { initializeSafeRace(); } catch (e) { console.error("レース初期化エラー:", e); }
  } catch (error) {
    console.error("アプリ起動エラー:", error);
  }
}

/* =========================================================
   オンライン状態
========================================================= */

async function updateOnlineStatus(isOnline) {
  if (!currentUser || !username) return;

  try {
    await updateDoc(doc(db, "users", username), {
      online: isOnline,
      lastSeen: serverTimestamp()
    });
    await syncOnlineStatusToFriendships(isOnline);
  } catch (error) {
    console.error("オンライン状態更新エラー:", error);
  }
}

/* 友達ドキュメント側のオンライン表示も更新する（友達一覧の表示に使われるため） */
async function syncOnlineStatusToFriendships(isOnline) {
  if (!username) return;

  try {
    const snapshot = await getDocs(collection(db, "friends"));
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((item) => {
      const data = item.data();
      if (data.user1 === username) {
        batch.update(item.ref, { user1Online: isOnline });
        count++;
      }
      if (data.user2 === username) {
        batch.update(item.ref, { user2Online: isOnline });
        count++;
      }
    });

    if (count > 0) await batch.commit();
  } catch (error) {
    console.error("友達オンライン状態同期エラー:", error);
  }
}

window.addEventListener("beforeunload", () => {
  if (currentUser && username) updateOnlineStatus(false);
});

setInterval(() => {
  if (currentUser && username) updateOnlineStatus(true);
}, 20000);

/* =========================================================
   プロフィール画像
========================================================= */

profileImageInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("画像は5MB以下にしてください。");
    profileImageInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const dataURL = reader.result;
    try {
      localStorage.setItem("yuuchat_profile_image", dataURL);
      loadProfileImage();
      await saveUserProfile();
      await updateProfileImageEverywhere(dataURL);
    } catch (error) {
      console.error("プロフィール画像更新エラー:", error);
      alert("プロフィール画像の更新に失敗しました。");
    }
  };
  reader.onerror = () => alert("画像の読み込みに失敗しました。");
  reader.readAsDataURL(file);
});

function loadProfileImage() {
  const savedImage = localStorage.getItem("yuuchat_profile_image");

  if (savedImage && myProfileImage) {
    myProfileImage.src = savedImage;
    myProfileImage.classList.remove("hidden");
    profileImagePlaceholder?.classList.add("hidden");
  } else {
    myProfileImage?.classList.add("hidden");
    profileImagePlaceholder?.classList.remove("hidden");
  }
}

async function updateProfileImageEverywhere(image) {
  if (!username) return;

  try {
    const snapshot = await getDocs(collection(db, "friends"));
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((item) => {
      const data = item.data();
      if (data.user1 === username) { batch.update(item.ref, { user1Photo: image }); count++; }
      if (data.user2 === username) { batch.update(item.ref, { user2Photo: image }); count++; }
    });

    if (count > 0) await batch.commit();
  } catch (error) {
    console.error("プロフィール画像同期エラー:", error);
  }
}

/* =========================================================
   名前変更
========================================================= */

changeNameButton?.addEventListener("click", async () => {
  if (!currentUser || !username) return;

  const newName = prompt("新しい名前を入力してください。", username);
  if (newName === null) return;

  const trimmed = newName.trim();
  if (!trimmed) return alert("名前を入力してください。");
  if (trimmed === username) return;
  if (trimmed.length > 20) return alert("名前は20文字以内にしてください。");

  try {
    const newUserRef = doc(db, "users", trimmed);
    const existing = await getDoc(newUserRef);

    if (existing.exists() && existing.data().uid !== currentUser.uid) {
      alert("その名前はすでに使われています。");
      return;
    }

    const oldName = username;

    await setDoc(newUserRef, {
      uid: currentUser.uid,
      name: trimmed,
      photoURL: currentUser.photoURL || "",
      profileImage: localStorage.getItem("yuuchat_profile_image") || "",
      online: true,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp()
    });

    username = trimmed;
    localStorage.setItem("yuuchat_username", username);

    await migrateUsername(oldName, username);

    try {
      await deleteDoc(doc(db, "users", oldName));
    } catch (error) {
      console.warn("旧ユーザーデータ削除失敗:", error);
    }

    if (myName) myName.textContent = username;
    alert("名前を変更しました。");

    listenFriends();
    listenGroups();
    if (selectedChat) listenSelectedChatMessages();
  } catch (error) {
    console.error("名前変更エラー:", error);
    alert("名前の変更に失敗しました。");
  }
});

/* =========================================================
   名前変更時のデータ移行
========================================================= */

async function migrateUsername(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;

  try {
    /* 友達 */
    const friendsSnapshot = await getDocs(collection(db, "friends"));
    const friendBatch = writeBatch(db);
    let friendChanged = false;

    friendsSnapshot.forEach((friendDoc) => {
      const data = friendDoc.data();
      const updateData = {};
      if (data.user1 === oldName) updateData.user1 = newName;
      if (data.user2 === oldName) updateData.user2 = newName;
      if (data.requestedBy === oldName) updateData.requestedBy = newName;
      if (data.acceptedBy === oldName) updateData.acceptedBy = newName;

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = serverTimestamp();
        friendBatch.update(friendDoc.ref, updateData);
        friendChanged = true;
      }
    });
    if (friendChanged) await friendBatch.commit();

    /* グループ */
    const groupsSnapshot = await getDocs(collection(db, "groups"));
    const groupBatch = writeBatch(db);
    let groupChanged = false;

    groupsSnapshot.forEach((groupDoc) => {
      const data = groupDoc.data();
      const members = Array.isArray(data.members) ? [...data.members] : [];
      const newMembers = members.map((m) => (m === oldName ? newName : m));
      const updateData = {};

      if (JSON.stringify(members) !== JSON.stringify(newMembers)) updateData.members = newMembers;
      if (data.owner === oldName) updateData.owner = newName;

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = serverTimestamp();
        groupBatch.update(groupDoc.ref, updateData);
        groupChanged = true;
      }
    });
    if (groupChanged) await groupBatch.commit();

    /* メッセージ */
    const messagesSnapshot = await getDocs(collection(db, "messages"));
    const messageBatch = writeBatch(db);
    let messageChanged = false;

    messagesSnapshot.forEach((messageDoc) => {
      const data = messageDoc.data();
      const updateData = {};
      if (data.sender === oldName) updateData.sender = newName;
      if (data.receiver === oldName) updateData.receiver = newName;

      if (Object.keys(updateData).length > 0) {
        messageBatch.update(messageDoc.ref, updateData);
        messageChanged = true;
      }
    });
    if (messageChanged) await messageBatch.commit();
  } catch (error) {
    console.error("名前変更データ移行エラー:", error);
    throw error;
  }
}

/* =========================================================
   友達一覧
========================================================= */

function listenFriends() {
  if (!username) return;
  if (unsubscribeFriends) { unsubscribeFriends(); unsubscribeFriends = null; }

  unsubscribeFriends = onSnapshot(
    query(collection(db, "friends")),
    (snapshot) => {
      const friends = [];
      snapshot.forEach((item) => {
        const data = item.data();
        if (data.user1 === username) {
          friends.push({
            id: item.id, friend: data.user2, friendshipId: item.id,
            online: data.user2Online || false, photo: data.user2Photo || ""
          });
        }
        if (data.user2 === username) {
          friends.push({
            id: item.id, friend: data.user1, friendshipId: item.id,
            online: data.user1Online || false, photo: data.user1Photo || ""
          });
        }
      });
      friendsData = friends;
      renderFriends();
    },
    (error) => console.error("友達監視エラー:", error)
  );
}

function renderFriends() {
  if (!friendsList) return;
  friendsList.innerHTML = "";

  if (friendsData.length === 0) {
    friendsList.innerHTML = `<div class="empty-state">友達がいません</div>`;
    return;
  }

  friendsData.forEach((friend) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "friend-item";
    if (selectedChatType === "friend" && selectedChat === friend.friend) {
      item.classList.add("active");
    }

    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    if (friend.photo) {
      avatar.style.backgroundImage = `url("${friend.photo}")`;
    } else {
      avatar.textContent = friend.friend?.charAt(0)?.toUpperCase() || "?";
    }

    const info = document.createElement("div");
    info.className = "friend-info";

    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = friend.friend;

    const status = document.createElement("div");
    status.className = `friend-status ${friend.online ? "online" : "offline"}`;
    status.textContent = friend.online ? "オンライン" : "オフライン";

    info.append(name, status);
    item.append(avatar, info);

    item.addEventListener("click", () => selectFriendChat(friend));
    item.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      if (confirm(`${friend.friend}を友達から削除しますか？`)) await deleteFriend(friend);
    });

    friendsList.appendChild(item);
  });

  /* 選択中の友達チャットのヘッダーも最新のオンライン状態に更新 */
  if (selectedChatType === "friend" && selectedChat) {
    const current = friendsData.find((f) => f.friend === selectedChat);
    if (current) renderChatHeaderForFriend(current);
  }
}

addFriendButton?.addEventListener("click", async () => {
  const friendName = prompt("追加したい友達の名前を入力してください。");
  if (friendName === null) return;

  const trimmed = friendName.trim();
  if (!trimmed) return alert("名前を入力してください。");
  if (trimmed === username) return alert("自分自身は追加できません。");

  try {
    const userDoc = await getDoc(doc(db, "users", trimmed));
    if (!userDoc.exists()) return alert("そのユーザーは見つかりません。");

    const userData = userDoc.data();
    const friendshipId = createFriendshipId(username, trimmed);
    const friendshipRef = doc(db, "friends", friendshipId);
    const existing = await getDoc(friendshipRef);
    if (existing.exists()) return alert("すでに友達です。");

    const myImage = localStorage.getItem("yuuchat_profile_image") || "";
    const isUser1 = username < trimmed;

    await setDoc(friendshipRef, {
      user1: isUser1 ? username : trimmed,
      user2: isUser1 ? trimmed : username,
      user1Uid: isUser1 ? currentUser.uid : userData.uid,
      user2Uid: isUser1 ? userData.uid : currentUser.uid,
      user1Online: isUser1 ? true : (userData.online || false),
      user2Online: isUser1 ? (userData.online || false) : true,
      user1Photo: isUser1 ? myImage : (userData.profileImage || ""),
      user2Photo: isUser1 ? (userData.profileImage || "") : myImage,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert(`${trimmed}を友達に追加しました。`);
  } catch (error) {
    console.error("友達追加エラー:", error);
    alert("友達追加に失敗しました。");
  }
});

async function deleteFriend(friend) {
  if (!friend?.friendshipId) return;
  try {
    await deleteDoc(doc(db, "friends", friend.friendshipId));
    if (selectedChat === friend.friend) resetChat();
  } catch (error) {
    console.error("友達削除エラー:", error);
    alert("友達の削除に失敗しました。");
  }
}

/* =========================================================
   グループ
========================================================= */

function listenGroups() {
  if (!username) return;
  if (unsubscribeGroups) { unsubscribeGroups(); unsubscribeGroups = null; }

  unsubscribeGroups = onSnapshot(
    query(collection(db, "groups"), where("members", "array-contains", username)),
    (snapshot) => {
      groupsData = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderGroups();
    },
    (error) => console.error("グループ監視エラー:", error)
  );
}

function renderGroups() {
  if (!groupsList) return;
  groupsList.innerHTML = "";

  if (groupsData.length === 0) {
    groupsList.innerHTML = `<div class="empty-state">グループがありません</div>`;
    return;
  }

  groupsData.forEach((group) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "group-item";
    if (selectedChatType === "group" && selectedChat === group.id) item.classList.add("active");

    const avatar = document.createElement("div");
    avatar.className = "group-avatar";
    avatar.textContent = "👥";

    const info = document.createElement("div");
    info.className = "group-info";

    const name = document.createElement("div");
    name.className = "group-name";
    name.textContent = group.name || "グループ";

    const members = document.createElement("div");
    members.className = "group-members";
    const memberCount = Array.isArray(group.members) ? group.members.length : 0;
    members.textContent = `${memberCount}人`;

    info.append(name, members);
    item.append(avatar, info);
    item.addEventListener("click", () => selectGroupChat(group));
    groupsList.appendChild(item);
  });

  if (selectedChatType === "group" && selectedChat) {
    const current = groupsData.find((g) => g.id === selectedChat);
    if (current) renderChatHeaderForGroup(current);
  }
}

createGroupButton?.addEventListener("click", async () => {
  const groupName = prompt("グループ名を入力してください。");
  if (groupName === null) return;

  const trimmed = groupName.trim();
  if (!trimmed) return alert("グループ名を入力してください。");
  if (trimmed.length > 30) return alert("グループ名は30文字以内にしてください。");

  try {
    const groupRef = await addDoc(collection(db, "groups"), {
      name: trimmed,
      owner: username,
      members: [username],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert(`${trimmed}を作成しました。`);
    selectGroupChat({ id: groupRef.id, name: trimmed, owner: username, members: [username] });
  } catch (error) {
    console.error("グループ作成エラー:", error);
    alert("グループの作成に失敗しました。");
  }
});

/* =========================================================
   アバター表示（友達一覧・チャットヘッダー・メッセージで共通利用）
========================================================= */

function buildAvatarElement(photo, fallbackText, extraClass) {
  const el = document.createElement("div");
  el.className = extraClass ? `avatar-circle ${extraClass}` : "avatar-circle";
  if (photo) {
    el.style.backgroundImage = `url("${photo}")`;
  } else {
    el.textContent = (fallbackText || "?").trim().charAt(0).toUpperCase() || "?";
  }
  return el;
}

/* =========================================================
   チャットヘッダー（アバター＋名前＋状態）
========================================================= */

function renderChatHeaderForFriend(friend) {
  if (!chatHeader || !friend) return;
  chatHeader.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "chat-header-profile";

  const avatar = buildAvatarElement(friend.photo, friend.friend, "avatar-circle--md");

  const info = document.createElement("div");
  info.className = "chat-header-info";

  const name = document.createElement("div");
  name.className = "chat-header-name";
  name.textContent = friend.friend;

  const status = document.createElement("div");
  status.className = `chat-header-status ${friend.online ? "online" : "offline"}`;
  status.textContent = friend.online ? "オンライン" : "オフライン";

  info.append(name, status);
  wrap.append(avatar, info);
  chatHeader.appendChild(wrap);
}

function renderChatHeaderForGroup(group) {
  if (!chatHeader || !group) return;
  chatHeader.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "chat-header-profile";

  const avatar = document.createElement("div");
  avatar.className = "avatar-circle avatar-circle--md avatar-circle--group";
  avatar.textContent = "👥";

  const info = document.createElement("div");
  info.className = "chat-header-info";

  const name = document.createElement("div");
  name.className = "chat-header-name";
  name.textContent = group.name || "グループ";

  const count = Array.isArray(group.members) ? group.members.length : 0;
  const status = document.createElement("div");
  status.className = "chat-header-status";
  status.textContent = `メンバー ${count}人`;

  info.append(name, status);
  wrap.append(avatar, info);
  chatHeader.appendChild(wrap);
}

/* =========================================================
   チャット選択
========================================================= */

function selectFriendChat(friend) {
  if (!friend) return;
  selectedChatType = "friend";
  selectedChat = friend.friend;
  selectedFriendshipId = friend.friendshipId;
  replyingMessage = null;
  updateReplyBar();
  renderChatHeaderForFriend(friend);
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  renderFriends();
  renderGroups();
  listenSelectedChatMessages();
}

function selectGroupChat(group) {
  if (!group) return;
  selectedChatType = "group";
  selectedChat = group.id;
  selectedFriendshipId = null;
  replyingMessage = null;
  updateReplyBar();
  renderChatHeaderForGroup(group);
  if (messageInput) messageInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  renderFriends();
  renderGroups();
  listenSelectedChatMessages();
}

function resetChat() {
  selectedChat = null;
  selectedChatType = null;
  selectedFriendshipId = null;
  replyingMessage = null;

  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
  if (chatHeader) chatHeader.textContent = "相手を選択してください";
  if (messageInput) messageInput.disabled = true;
  if (sendButton) sendButton.disabled = true;
  if (messagesElement) {
    messagesElement.innerHTML = `<div class="empty-state">チャットを選択してください</div>`;
  }

  updateReplyBar();
  renderFriends();
  renderGroups();
}

/* =========================================================
   メッセージ監視・表示
========================================================= */

function isMessageForSelectedChat(message) {
  if (!message || !selectedChat) return false;

  if (selectedChatType === "group") {
    return message.type === "group" && message.groupId === selectedChat;
  }

  if (selectedChatType === "friend") {
    const sender = message.sender;
    const receiver = message.receiver;
    if (selectedFriendshipId && message.friendshipId) {
      return message.friendshipId === selectedFriendshipId;
    }
    return (
      (sender === username && receiver === selectedChat) ||
      (sender === selectedChat && receiver === username)
    );
  }

  return false;
}

function listenSelectedChatMessages() {
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
  if (!username || !selectedChat) return;

  if (messagesElement) messagesElement.innerHTML = `<div class="loading">読み込み中...</div>`;

  unsubscribeMessages = onSnapshot(
    query(collection(db, "messages"), orderBy("createdAt", "asc")),
    (snapshot) => {
      const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderSelectedMessages(messages);
      markMessagesAsRead(messages);
    },
    (error) => {
      console.error("チャット読み込みエラー:", error);
      if (messagesElement) {
        messagesElement.innerHTML = `<div class="empty-state">メッセージの読み込みに失敗しました</div>`;
      }
    }
  );
}

function renderSelectedMessages(allMessages) {
  if (!messagesElement) return;

  const messages = allMessages.filter(isMessageForSelectedChat);
  messagesElement.innerHTML = "";

  if (messages.length === 0) {
    messagesElement.innerHTML = `<div class="empty-state">まだメッセージがありません</div>`;
    return;
  }

  messages.forEach((message, index) => {
    const row = renderMessage(message);
    if (index === messages.length - 1) row.classList.add("new");
    messagesElement.appendChild(row);
  });

  requestAnimationFrame(() => { messagesElement.scrollTop = messagesElement.scrollHeight; });
}

function renderMessage(message) {
  const row = document.createElement("div");
  row.className = "message-row";

  const senderName = message.sender || "";
  const isMine = senderName === username;
  row.classList.add(isMine ? "mine" : "other");

  /* 相手のメッセージにはアバターを表示（自分のメッセージは表示しない） */
  if (!isMine) {
    const avatar = buildAvatarElement(message.senderPhoto, senderName, "avatar-circle--sm");
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (message.deleted) {
    const deleted = document.createElement("div");
    deleted.className = "deleted-message";
    deleted.textContent = "このメッセージは送信を取り消しました";
    bubble.appendChild(deleted);
  } else {
    if (selectedChatType === "group" && senderName && senderName !== username) {
      const sender = document.createElement("div");
      sender.className = "message-user";
      sender.textContent = senderName;
      bubble.appendChild(sender);
    }

    if (message.replyTo) {
      const reply = document.createElement("div");
      reply.className = "reply-preview";
      reply.textContent = message.replyTo.text || "返信";
      bubble.appendChild(reply);
    }

    if (message.image) {
      const image = document.createElement("img");
      image.className = "message-image";
      image.src = message.image;
      image.alt = "送信された画像";
      image.loading = "lazy";
      image.addEventListener("click", () => {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(
            `<title>画像</title><img src="${message.image}" style="max-width:100%;max-height:100vh;display:block;margin:auto;">`
          );
        }
      });
      bubble.appendChild(image);
    }

    if (message.text) {
      const text = document.createElement("div");
      text.className = "message-text";
      text.textContent = message.text;
      bubble.appendChild(text);
    }

    if (message.reactions) renderReactions(bubble, message);
  }

  const meta = document.createElement("div");
  meta.className = "message-time";
  meta.textContent = formatMessageTime(message.createdAt);
  bubble.appendChild(meta);

  if (!message.deleted) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "返信";
    replyButton.addEventListener("click", () => setReplyMessage(message));

    const reactionButton = document.createElement("button");
    reactionButton.type = "button";
    reactionButton.textContent = "😊";
    reactionButton.addEventListener("click", () => addReaction(message));

    actions.append(replyButton, reactionButton);

    if (isMine) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "取消";
      deleteButton.addEventListener("click", () => unsendMessage(message.id));
      actions.appendChild(deleteButton);
    }

    bubble.appendChild(actions);
  }

  row.appendChild(bubble);
  return row;
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  try {
    let date;
    if (typeof timestamp.toDate === "function") date = timestamp.toDate();
    else if (timestamp instanceof Date) date = timestamp;
    else date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return "";
  }
}

/* =========================================================
   返信
========================================================= */

function setReplyMessage(message) {
  if (!message) return;
  replyingMessage = { id: message.id, text: message.text || (message.image ? "画像" : "") };
  updateReplyBar();
  messageInput?.focus();
}

function updateReplyBar() {
  if (!replyBar) return;
  if (!replyingMessage) {
    replyBar.classList.add("hidden");
    if (replyText) replyText.textContent = "";
    return;
  }
  replyBar.classList.remove("hidden");
  if (replyText) replyText.textContent = `「${replyingMessage.text || "メッセージ"}」に返信`;
}

cancelReplyButton?.addEventListener("click", () => {
  replyingMessage = null;
  updateReplyBar();
});

/* =========================================================
   リアクション
========================================================= */

function renderReactions(bubble, message) {
  const entries = Object.entries(message.reactions || {});
  if (entries.length === 0) return;

  const container = document.createElement("div");
  container.className = "message-reactions";

  entries.forEach(([emoji, users]) => {
    if (!Array.isArray(users) || users.length === 0) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reaction";
    button.textContent = `${emoji} ${users.length}`;
    button.addEventListener("click", () => toggleReaction(message, emoji));
    container.appendChild(button);
  });

  if (container.children.length > 0) bubble.appendChild(container);
}

async function addReaction(message) {
  if (!message?.id) return;
  const emoji = prompt("リアクションを入力してください\n\n😊 😂 👍 ❤️ 😮 😢 🎉");
  if (!emoji) return;
  const selectedEmoji = emoji.trim();
  if (!selectedEmoji) return;
  await toggleReaction(message, selectedEmoji);
}

async function toggleReaction(message, emoji) {
  if (!currentUser || !message?.id || !emoji) return;

  try {
    const messageRef = doc(db, "messages", message.id);
    const snapshot = await getDoc(messageRef);
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const reactions = { ...(data.reactions || {}) };
    const users = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    const index = users.indexOf(username);

    if (index >= 0) users.splice(index, 1);
    else users.push(username);

    if (users.length === 0) delete reactions[emoji];
    else reactions[emoji] = users;

    await updateDoc(messageRef, { reactions });
  } catch (error) {
    console.error("リアクションエラー:", error);
  }
}

/* =========================================================
   送信取り消し
========================================================= */

async function unsendMessage(messageId) {
  if (!currentUser || !messageId) return;
  if (!confirm("このメッセージの送信を取り消しますか？")) return;

  try {
    const messageRef = doc(db, "messages", messageId);
    const snapshot = await getDoc(messageRef);
    if (!snapshot.exists()) return;

    if (snapshot.data().sender !== username) {
      alert("自分が送信したメッセージだけ取り消せます。");
      return;
    }

    await updateDoc(messageRef, { deleted: true, deletedAt: serverTimestamp() });
  } catch (error) {
    console.error("送信取り消しエラー:", error);
    alert("送信取り消しに失敗しました。");
  }
}

/* =========================================================
   メッセージ送信
========================================================= */

sendButton?.addEventListener("click", sendMessage);

messageInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  if (!currentUser || !username) return;
  if (!selectedChat || !selectedChatType) {
    alert("友達またはグループを選択してください。");
    return;
  }

  const text = messageInput?.value?.trim() || "";
  const image = pendingImageData || null;
  if (!text && !image) return;

  try {
    const messageData = {
      sender: username,
      senderUid: currentUser.uid,
      senderPhoto: localStorage.getItem("yuuchat_profile_image") || "",
      text,
      image,
      type: selectedChatType,
      createdAt: serverTimestamp(),
      deleted: false,
      readBy: [username]
    };

    if (selectedChatType === "friend") {
      messageData.receiver = selectedChat;
      messageData.friendshipId = selectedFriendshipId || createFriendshipId(username, selectedChat);
    }

    if (selectedChatType === "group") {
      messageData.groupId = selectedChat;
    }

    if (replyingMessage) {
      messageData.replyTo = { id: replyingMessage.id, text: replyingMessage.text || "" };
    }

    await addDoc(collection(db, "messages"), messageData);

    if (messageInput) messageInput.value = "";
    pendingImageData = null;
    if (imageInput) imageInput.value = "";
    if (messageInput) messageInput.placeholder = "メッセージを入力";
    replyingMessage = null;
    updateReplyBar();
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    alert("メッセージを送信できませんでした。");
  }
}

/* =========================================================
   画像送信
========================================================= */

imageButton?.addEventListener("click", () => imageInput?.click());

imageInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("画像は5MB以下にしてください。");
    imageInput.value = "";
    return;
  }

  try {
    pendingImageData = await readFileAsDataURL(file);
    if (messageInput) messageInput.placeholder = "画像を選択しました。送信できます";
  } catch (error) {
    console.error("画像読み込みエラー:", error);
    pendingImageData = null;
  }
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   既読処理
========================================================= */

async function markMessagesAsRead(messages) {
  if (!currentUser || !username) return;

  const unread = messages.filter((message) => {
    if (!isMessageForSelectedChat(message)) return false;
    if (message.sender === username) return false;
    const readBy = Array.isArray(message.readBy) ? message.readBy : [];
    return !readBy.includes(username);
  });

  if (unread.length === 0) return;

  try {
    const batch = writeBatch(db);
    unread.forEach((message) => {
      const readBy = Array.isArray(message.readBy) ? [...message.readBy] : [];
      if (!readBy.includes(username)) {
        readBy.push(username);
        batch.update(doc(db, "messages", message.id), { readBy });
      }
    });
    await batch.commit();
  } catch (error) {
    console.error("既読更新エラー:", error);
  }
}

/* =========================================================
   通知
========================================================= */

async function initializeNotifications() {
  if (notificationsInitialized || !currentUser) return;
  notificationsInitialized = true;

  try {
    if (typeof Notification === "undefined") return;

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    if (Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const messaging = getMessaging(firebaseApp);

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) await saveNotificationToken(token);

    onMessage(messaging, (payload) => {
      console.log("通知を受信:", payload);
      showInAppNotification(payload);
    });
  } catch (error) {
    console.error("通知初期化エラー:", error);
  }
}

async function saveNotificationToken(token) {
  if (!currentUser || !username || !token) return;
  try {
    await setDoc(doc(db, "users", username), {
      notificationToken: token,
      notificationUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("通知トークン保存エラー:", error);
  }
}

function showInAppNotification(payload) {
  const notification = document.createElement("div");
  notification.className = "notification";

  const title = payload?.notification?.title || payload?.data?.title || "ゆうChat";
  const body = payload?.notification?.body || payload?.data?.body || "新しい通知があります。";

  const titleElement = document.createElement("div");
  titleElement.className = "notification-title";
  titleElement.textContent = title;

  const bodyElement = document.createElement("div");
  bodyElement.className = "notification-body";
  bodyElement.textContent = body;

  notification.append(titleElement, bodyElement);
  document.body.appendChild(notification);

  requestAnimationFrame(() => notification.classList.add("show"));

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/* =========================================================
   タブ切り替え
========================================================= */

const tabButtons = document.querySelectorAll(".tabs button[data-view]");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view) switchView(view);
  });
});

function switchView(view) {
  const views = { chat: chatView, derby: derbyView, games: gamesView, mypage: mypageView };

  Object.entries(views).forEach(([name, element]) => {
    if (!element) return;
    element.classList.toggle("active", name === view);
    element.classList.toggle("hidden", name !== view);
  });

  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (view === "mypage") loadMyPage();
  if (view === "derby") renderRaceInfo();
  if (view === "games") loadGameRooms();
}

/* =========================================================
   ログアウト
========================================================= */

logoutButton?.addEventListener("click", async () => {
  if (!confirm("ログアウトしますか？")) return;

  try {
    if (unsubscribeFriends) { unsubscribeFriends(); unsubscribeFriends = null; }
    if (unsubscribeGroups) { unsubscribeGroups(); unsubscribeGroups = null; }
    if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
    if (unsubscribeGameRooms) { unsubscribeGameRooms(); unsubscribeGameRooms = null; }
    if (unsubscribeCurrentGame) { unsubscribeCurrentGame(); unsubscribeCurrentGame = null; }
    if (unsubscribeMyCoins) { unsubscribeMyCoins(); unsubscribeMyCoins = null; }
    if (unsubscribeTodayRace) { unsubscribeTodayRace(); unsubscribeTodayRace = null; }
    if (unsubscribeWinBets) { unsubscribeWinBets(); unsubscribeWinBets = null; }
    if (unsubscribeMyBetHistory) { unsubscribeMyBetHistory(); unsubscribeMyBetHistory = null; }
    if (raceCountdownTimer) { clearInterval(raceCountdownTimer); raceCountdownTimer = null; }
    lastCheckedRaceId = null;
    todayRaceResult = null;
    todayRaceGenerationAttempted = false;
    currentWinPool = {};
    myCoins = 0;

    await updateOnlineStatus(false);
    await signOut(auth);
  } catch (error) {
    console.error("ログアウトエラー:", error);
    alert("ログアウトに失敗しました。");
  }
});

/* =========================================================
   マイページ
========================================================= */

async function loadMyPage() {
  if (!currentUser) return;
  if (myName) myName.textContent = username || "ゲスト";
  if (statusElement) statusElement.textContent = "🟢 オンライン";

  await loadMyPageStats();
  await loadCoinRanking();
}

async function loadMyPageStats() {
  if (!currentUser || !username) return;

  try {
    const snapshot = await getDocs(query(collection(db, "raceBets"), where("uid", "==", currentUser.uid)));
    let betCount = 0;
    let hitCount = 0;
    let profit = 0;

    snapshot.forEach((item) => {
      const bet = item.data();
      betCount++;
      if (bet.settled) {
        if (bet.win) hitCount++;
        profit += (bet.payout || 0) - Number(bet.amount || 0);
      }
    });

    if (myBetCount) myBetCount.textContent = betCount;
    if (myHitCount) myHitCount.textContent = hitCount;
    if (myProfit) myProfit.textContent = (profit >= 0 ? "+" : "") + profit;
  } catch (error) {
    console.error("マイページ統計エラー:", error);
  }
}

/* 「🏆 ユーコインランキング」の見出しに合わせ、実際のゆうcoin残高ランキングを表示 */
async function loadCoinRanking() {
  if (!rankingEl) return;
  rankingEl.innerHTML = `<div class="loading">ランキングを読み込み中...</div>`;

  try {
    const snapshot = await getDocs(query(collection(db, "users"), orderBy("coins", "desc")));
    const list = snapshot.docs
      .map((item) => ({ name: item.id, coins: item.data().coins }))
      .filter((u) => typeof u.coins === "number")
      .slice(0, 20);

    rankingEl.innerHTML = "";

    if (list.length === 0) {
      rankingEl.innerHTML = `<div class="empty-state">まだランキングデータがありません</div>`;
      return;
    }

    list.forEach((user, index) => {
      const item = document.createElement("div");
      item.className = "ranking-item";
      item.innerHTML = `
        <div class="ranking-number">${index + 1}</div>
        <div class="ranking-info">
          <div class="ranking-name">${escapeHTML(user.name)}</div>
          <div class="ranking-score">🪙 ${user.coins}</div>
        </div>`;
      rankingEl.appendChild(item);
    });
  } catch (error) {
    console.error("ランキング取得エラー:", error);
    rankingEl.innerHTML = `<div class="empty-state">ランキングを取得できませんでした</div>`;
  }
}

/* =========================================================
   ゆうダービー：ゆうcoin・オッズ・投票・精算
========================================================= */

const YUU_START_COINS = 1000;
const RACE_TAKEOUT_RATE = 0.8;
const RACE_HOUR = 15;
const RACE_MINUTE = 2;
const RACE_CLOSE_MINUTES_BEFORE = 10;

const SAFE_RACE_HORSES = [
  { number: 1, name: "ユウウキ", character: "気まぐれな逃げ馬", power: 6 },
  { number: 2, name: "ユウセイ", character: "堅実な先行馬", power: 7 },
  { number: 3, name: "ユウヤン", character: "末脚が鋭い差し馬", power: 8 },
  { number: 4, name: "ユウチュウ", character: "スタミナ自慢の追込馬", power: 5 },
  { number: 5, name: "ユウガ", character: "重賞実績もある実力馬", power: 9 },
  { number: 6, name: "ユウバエ", character: "新人ながら期待の一頭", power: 4 },
  { number: 7, name: "ユウキカイ", character: "安定感抜群のベテラン", power: 6 },
  { number: 8, name: "ユウマグレ", character: "一発があるクセ馬", power: 3 },
  { number: 9, name: "ユウジン", character: "人気先行のスター候補", power: 7 },
  { number: 10, name: "ユウシャ", character: "底力のある大物", power: 8 }
];

const BET_TYPE_NAMES = { win: "単勝", place: "複勝", quinella: "馬連", trio: "三連複", trifecta: "三連単" };
const BET_TYPE_COUNT = { win: 1, place: 1, quinella: 2, trio: 3, trifecta: 3 };

function getBetTypeName(type) { return BET_TYPE_NAMES[type] || type; }
function getHorseName(number) { return SAFE_RACE_HORSES.find((h) => h.number === number)?.name || `${number}番`; }

function getTodayRaceId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRaceScheduleForToday() {
  const now = new Date();
  const raceTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RACE_HOUR, RACE_MINUTE, 0, 0);
  const closeTime = new Date(raceTime.getTime() - RACE_CLOSE_MINUTES_BEFORE * 60000);
  return { raceTime, closeTime };
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ----- ゆうcoin残高 ----- */

function updateCoinDisplays(coins) {
  myCoins = coins;
  if (coinBalanceEl) coinBalanceEl.textContent = String(coins);
  if (myCoinLarge) myCoinLarge.textContent = String(coins);
}

async function grantStartingCoinsIfNeeded() {
  if (!username) return;
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", username);
      const snap = await transaction.get(userRef);
      if (!snap.exists()) return;
      if (typeof snap.data().coins === "number") return;
      transaction.update(userRef, { coins: YUU_START_COINS });
    });
  } catch (error) {
    console.error("ゆうcoin初期付与エラー:", error);
  }
}

function listenMyCoins() {
  if (unsubscribeMyCoins) { unsubscribeMyCoins(); unsubscribeMyCoins = null; }
  if (!username) return;

  unsubscribeMyCoins = onSnapshot(
    doc(db, "users", username),
    async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (typeof data.coins !== "number") {
        await grantStartingCoinsIfNeeded();
        return;
      }
      updateCoinDisplays(data.coins);
    },
    (error) => console.error("コイン監視エラー:", error)
  );
}

/* ----- オッズ（賭けられている金額から計算） ----- */

function computeWinOdds(horseNumber) {
  const total = Object.values(currentWinPool).reduce((a, b) => a + b, 0);
  const onHorse = currentWinPool[horseNumber] || 0;
  if (total <= 0 || onHorse <= 0) return null;
  return Math.max(1.1, (total * RACE_TAKEOUT_RATE) / onHorse);
}

function listenWinBets(raceId) {
  if (unsubscribeWinBets) { unsubscribeWinBets(); unsubscribeWinBets = null; }

  unsubscribeWinBets = onSnapshot(
    query(collection(db, "raceBets"), where("raceId", "==", raceId), where("type", "==", "win")),
    (snapshot) => {
      const pool = {};
      snapshot.forEach((item) => {
        const bet = item.data();
        const horse = bet.horses?.[0];
        if (!horse) return;
        pool[horse] = (pool[horse] || 0) + Number(bet.amount || 0);
      });
      currentWinPool = pool;
      renderOdds();
    },
    (error) => console.error("オッズ監視エラー:", error)
  );
}

function renderOdds() {
  if (oddsList) {
    oddsList.innerHTML = "";
    SAFE_RACE_HORSES.forEach((horse) => {
      const odds = computeWinOdds(horse.number);
      const item = document.createElement("div");
      item.className = "odds-item";
      item.innerHTML = `<strong>${horse.number} ${escapeHTML(horse.name)}</strong><span>${odds ? odds.toFixed(1) + "倍" : "---"}</span>`;
      oddsList.appendChild(item);
    });
  }
  renderHorseList();
}

function renderHorseList() {
  if (!horseList) return;

  const withPopularity = SAFE_RACE_HORSES
    .map((h) => ({ ...h, pool: currentWinPool[h.number] || 0 }))
    .sort((a, b) => b.pool - a.pool);

  horseList.innerHTML = "";
  withPopularity.forEach((horse, index) => {
    const odds = computeWinOdds(horse.number);
    const item = document.createElement("div");
    item.className = "horse-card";
    item.innerHTML = `
      <strong>${horse.number}番　${escapeHTML(horse.name)}</strong>
      <span>${escapeHTML(horse.character)}</span>
      <div style="margin-top:6px; font-size:11px; color:#777;">
        人気 ${horse.pool > 0 ? index + 1 : "-"}位　オッズ ${odds ? odds.toFixed(1) + "倍" : "未定"}
      </div>`;
    horseList.appendChild(item);
  });
}

/* ----- 投票フォームの有効/無効 ----- */

function updateBetFormEnabled() {
  const canBet = Boolean(currentUser && username) && !bettingLocked;
  if (betType) betType.disabled = !canBet;
  if (betHorses) betHorses.disabled = !canBet;
  if (betAmount) betAmount.disabled = !canBet;
  if (betButton) {
    betButton.disabled = !canBet;
    betButton.textContent = bettingLocked ? "🔒 本日の投票は締め切りました" : "🪙 投票する";
  }
}

function parseBetHorses(text, type) {
  const need = BET_TYPE_COUNT[type] || 1;
  const nums = (text || "")
    .split(/[,、\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= SAFE_RACE_HORSES.length);

  const ordered = [];
  nums.forEach((n) => { if (!ordered.includes(n)) ordered.push(n); });

  if (ordered.length !== need) return null;
  return type === "trifecta" ? ordered : [...ordered].sort((a, b) => a - b);
}

betButton?.addEventListener("click", async () => {
  if (!currentUser || !username) return alert("ログインしてください。");
  if (bettingLocked) return alert("本日の投票は締め切りました。");

  const type = betType?.value || "win";
  const amount = Number(betAmount?.value || 0);
  const horses = parseBetHorses(betHorses?.value, type);

  if (!horses) {
    return alert(`${getBetTypeName(type)}は馬番号を${BET_TYPE_COUNT[type]}個、カンマ区切りで入力してください。`);
  }
  if (!Number.isInteger(amount) || amount < 10) {
    return alert("投票額は10ゆうcoin以上で入力してください。");
  }
  if (amount > myCoins) {
    return alert("ゆうcoinが足りません。");
  }

  try {
    betButton.disabled = true;
    const raceId = getTodayRaceId();

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", username);
      const userSnap = await transaction.get(userRef);
      const coins = userSnap.exists() ? Number(userSnap.data().coins || 0) : 0;
      if (coins < amount) throw new Error("NOT_ENOUGH_COINS");

      transaction.update(userRef, { coins: coins - amount });

      const betRef = doc(collection(db, "raceBets"));
      transaction.set(betRef, {
        raceId, uid: currentUser.uid, username, type, horses, amount,
        settled: false, win: null, payout: null, createdAt: serverTimestamp()
      });
    });

    alert("投票しました！");
    if (betHorses) betHorses.value = "";
  } catch (error) {
    console.error("投票エラー:", error);
    if (error.message === "NOT_ENOUGH_COINS") alert("ゆうcoinが足りません。");
    else alert("投票に失敗しました。");
  } finally {
    updateBetFormEnabled();
  }
});

/* ----- 結果判定・払い戻し（パリミュチュエル方式） ----- */

function evaluateBetWin(bet, resultOrder) {
  const top1 = resultOrder[0], top2 = resultOrder[1], top3 = resultOrder[2];
  const top3set = [top1, top2, top3];
  const horses = bet.horses || [];

  if (bet.type === "win") return horses[0] === top1;
  if (bet.type === "place") return top3set.includes(horses[0]);

  if (bet.type === "quinella") {
    if (horses.length !== 2) return false;
    const a = [...horses].sort((x, y) => x - y);
    const b = [top1, top2].sort((x, y) => x - y);
    return a[0] === b[0] && a[1] === b[1];
  }

  if (bet.type === "trio") {
    if (horses.length !== 3) return false;
    const a = [...horses].sort((x, y) => x - y);
    const b = [...top3set].sort((x, y) => x - y);
    return a.every((n, i) => n === b[i]);
  }

  if (bet.type === "trifecta") {
    return horses.length === 3 && horses[0] === top1 && horses[1] === top2 && horses[2] === top3;
  }

  return false;
}

async function computePoolPayout(raceId, bet, resultOrder) {
  const snap = await getDocs(query(collection(db, "raceBets"), where("raceId", "==", raceId), where("type", "==", bet.type)));

  let totalPool = 0;
  let totalWinningStake = 0;

  snap.forEach((d) => {
    const data = d.data();
    const amount = Number(data.amount || 0);
    totalPool += amount;
    if (evaluateBetWin(data, resultOrder)) totalWinningStake += amount;
  });

  if (totalWinningStake <= 0) return 0;
  return Math.floor((Number(bet.amount || 0) / totalWinningStake) * totalPool * RACE_TAKEOUT_RATE);
}

function showRaceHitAnimation(bet, payout) {
  const el = document.createElement("div");
  el.className = "notification";
  const title = document.createElement("div");
  title.className = "notification-title";
  title.textContent = "🎯 的中！";
  const body = document.createElement("div");
  body.className = "notification-body";
  body.textContent = `${getBetTypeName(bet.type)}　+${payout} ゆうcoin`;
  el.append(title, body);
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

async function settleMyBets(raceId, resultOrder) {
  if (!currentUser || !username) return;

  try {
    const mySnap = await getDocs(query(
      collection(db, "raceBets"),
      where("raceId", "==", raceId),
      where("uid", "==", currentUser.uid),
      where("settled", "==", false)
    ));
    if (mySnap.empty) return;

    for (const betDoc of mySnap.docs) {
      const bet = betDoc.data();
      const isWin = evaluateBetWin(bet, resultOrder);
      const payout = isWin ? await computePoolPayout(raceId, bet, resultOrder) : 0;

      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, "raceBets", betDoc.id);
        const freshBet = await transaction.get(betRef);
        if (!freshBet.exists() || freshBet.data().settled) return;

        transaction.update(betRef, { settled: true, win: isWin, payout });

        if (payout > 0) {
          const userRef = doc(db, "users", username);
          const userSnap = await transaction.get(userRef);
          const coins = userSnap.exists() ? Number(userSnap.data().coins || 0) : 0;
          transaction.update(userRef, { coins: coins + payout });
        }
      });

      if (isWin && payout > 0) showRaceHitAnimation(bet, payout);
    }

    loadMyPageStats();
  } catch (error) {
    console.error("ベット精算エラー:", error);
  }
}

/* ----- 投票履歴（マイページ） ----- */

function listenMyBetHistory() {
  if (unsubscribeMyBetHistory) { unsubscribeMyBetHistory(); unsubscribeMyBetHistory = null; }
  if (!currentUser || !historyEl) return;

  unsubscribeMyBetHistory = onSnapshot(
    query(collection(db, "raceBets"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc")),
    (snap) => renderBetHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => console.error("投票履歴監視エラー:", error)
  );
}

function renderBetHistory(bets) {
  if (!historyEl) return;
  historyEl.innerHTML = "";

  if (bets.length === 0) {
    historyEl.innerHTML = `<div class="empty-state">まだ投票履歴がありません</div>`;
    return;
  }

  bets.slice(0, 30).forEach((bet) => {
    const separator = bet.type === "trifecta" ? "→" : "・";
    const horsesText = (bet.horses || []).join(separator);

    let resultText = "結果待ち";
    if (bet.settled) resultText = bet.win ? `的中！ +${bet.payout || 0}coin` : "不的中";

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div><strong>${escapeHTML(getBetTypeName(bet.type))}</strong>　${escapeHTML(horsesText)}番　${bet.amount}coin</div>
      <div style="font-size:11px; color:#888; margin-top:3px;">${escapeHTML(bet.raceId)}　${escapeHTML(resultText)}</div>`;
    historyEl.appendChild(item);
  });
}

/* ----- レース結果の抽選（発走時刻になった最初のクライアントが実行） ----- */

function generateWeightedRaceOrder() {
  const withKey = SAFE_RACE_HORSES.map((h) => {
    const effectivePower = Math.max(0.1, h.power * (0.4 + Math.random() * 1.3));
    const key = Math.pow(Math.random(), 1 / effectivePower);
    return { number: h.number, key };
  });
  withKey.sort((a, b) => b.key - a.key);
  return withKey.map((h) => h.number);
}

async function tryGenerateRaceResult(raceId) {
  const raceRef = doc(db, "races", raceId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(raceRef);
      if (snap.exists()) return;

      transaction.set(raceRef, {
        raceId,
        resultOrder: generateWeightedRaceOrder(),
        status: "finished",
        generatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("レース抽選エラー:", error);
  }
}

/* ----- 本日のレース監視・カウントダウン ----- */

function listenTodayRace(raceId) {
  if (unsubscribeTodayRace) { unsubscribeTodayRace(); unsubscribeTodayRace = null; }

  unsubscribeTodayRace = onSnapshot(
    doc(db, "races", raceId),
    (snap) => {
      if (snap.exists() && snap.data().status === "finished") {
        todayRaceResult = snap.data();
        settleMyBets(raceId, todayRaceResult.resultOrder);
      } else {
        todayRaceResult = null;
      }
      renderRaceInfo();
    },
    (error) => console.error("本日のレース監視エラー:", error)
  );
}

function renderRaceInfo() {
  if (!raceInfo) return;

  const { raceTime, closeTime } = getRaceScheduleForToday();
  const now = new Date();
  const timeText = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  let statusLine;
  if (now < closeTime) statusLine = `投票受付中（締切 ${timeText(closeTime)}）`;
  else if (now < raceTime) statusLine = "投票は締め切りました。まもなく発走です。";
  else if (todayRaceResult) statusLine = "本日のレースは終了しました。";
  else statusLine = "集計中です…";

  raceInfo.innerHTML = `
    <div><strong>本日のレース</strong>（発走 ${timeText(raceTime)}）</div>
    <div>${escapeHTML(statusLine)}</div>
    ${todayRaceResult ? `
      <div style="margin-top:8px;">
        <strong>結果</strong>　
        1着：${escapeHTML(getHorseName(todayRaceResult.resultOrder[0]))}　
        2着：${escapeHTML(getHorseName(todayRaceResult.resultOrder[1]))}　
        3着：${escapeHTML(getHorseName(todayRaceResult.resultOrder[2]))}
      </div>` : ""}`;
}

function refreshDerbySubscriptionsIfNeeded() {
  const raceId = getTodayRaceId();
  if (raceId === lastCheckedRaceId) return;

  lastCheckedRaceId = raceId;
  todayRaceResult = null;
  todayRaceGenerationAttempted = false;

  listenTodayRace(raceId);
  listenWinBets(raceId);
}

function tickDerbyCountdown() {
  refreshDerbySubscriptionsIfNeeded();

  const raceId = getTodayRaceId();
  const { raceTime, closeTime } = getRaceScheduleForToday();
  const now = new Date();

  const wasLocked = bettingLocked;
  bettingLocked = now >= closeTime;
  if (wasLocked !== bettingLocked) updateBetFormEnabled();

  if (derbyCountdown) {
    if (now < raceTime) derbyCountdown.textContent = formatCountdown(raceTime - now);
    else derbyCountdown.textContent = todayRaceResult ? "本日終了" : "集計中";
  }

  if (now >= raceTime && !todayRaceGenerationAttempted) {
    todayRaceGenerationAttempted = true;
    tryGenerateRaceResult(raceId);
  }
}

function initializeSafeRace() {
  updateBetFormEnabled();
  tickDerbyCountdown();
  if (raceCountdownTimer) clearInterval(raceCountdownTimer);
  raceCountdownTimer = setInterval(tickDerbyCountdown, 1000);
}

/* =========================================================
   ゲーム部屋 共通
========================================================= */

function getGameTypeName(type) {
  if (type === "daifugo") return "大富豪";
  if (type === "othello") return "オセロ";
  if (type === "shogi") return "将棋";
  return "ゲーム";
}

function getMaxGamePlayers(type) {
  if (type === "daifugo") return 4;
  return 2;
}

const gameTypeButtons = document.querySelectorAll(".game-type");

gameTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.game;
    if (!type) return;
    gameTypeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentGameType = type;
  });
});

function loadGameRooms() {
  if (!gameRoomsEl) return;
  if (unsubscribeGameRooms) { unsubscribeGameRooms(); unsubscribeGameRooms = null; }

  unsubscribeGameRooms = onSnapshot(
    query(collection(db, "gameRooms"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const rooms = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderGameRooms(rooms);
    },
    (error) => {
      console.error("ゲーム部屋監視エラー:", error);
      gameRoomsEl.innerHTML = `<div class="empty-state">ゲーム部屋を読み込めませんでした</div>`;
    }
  );
}

function renderGameRooms(rooms) {
  if (!gameRoomsEl) return;
  gameRoomsEl.innerHTML = "";

  if (!rooms || rooms.length === 0) {
    gameRoomsEl.innerHTML = `<div class="empty-state">参加できるゲームルームはありません</div>`;
    return;
  }

  rooms.forEach((room) => {
    const members = Array.isArray(room.members) ? room.members : [];
    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `
      <div class="room-title">${escapeHTML(getGameTypeName(room.gameType))}</div>
      <div class="room-owner">作成者：${escapeHTML(room.owner || "不明")}</div>
      <div class="room-members">参加者 ${members.length}/${getMaxGamePlayers(room.gameType)}人</div>
      <div class="room-status">${room.status === "playing" ? "プレイ中" : "参加者募集中"}</div>`;

    const joinButton = document.createElement("button");
    joinButton.type = "button";
    joinButton.className = "primary-button";
    joinButton.textContent = members.includes(username) ? "開く" : (room.status === "playing" ? "観戦" : "参加");
    joinButton.addEventListener("click", () => joinGameRoom(room));

    card.appendChild(joinButton);
    gameRoomsEl.appendChild(card);
  });
}

createGameRoomButton?.addEventListener("click", async () => {
  if (!currentUser || !username) return alert("ログインしてください。");

  const type = currentGameType || "daifugo";
  try {
    createGameRoomButton.disabled = true;

    const roomRef = await addDoc(collection(db, "gameRooms"), {
      gameType: type,
      owner: username,
      ownerUid: currentUser.uid,
      members: [username],
      memberUids: [currentUser.uid],
      maxPlayers: getMaxGamePlayers(type),
      status: "waiting",
      gameState: createInitialGameState(type),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    joinGameRoom({ id: roomRef.id, gameType: type, members: [username], memberUids: [currentUser.uid] });
  } catch (error) {
    console.error("ゲームルーム作成エラー:", error);
    alert(`ゲームルームを作成できませんでした。（${getGameTypeName(type)} / ${error.code || error.message || "不明なエラー"}）`);
  } finally {
    createGameRoomButton.disabled = false;
  }
});

function createInitialGameState(type) {
  if (type === "othello") {
    return { board: createInitialOthelloBoard(), currentPlayer: "black", started: false, winner: null };
  }
  if (type === "shogi") {
    return ensureShogiState({ board: createInitialShogiBoard(), currentPlayer: "sente", winner: null });
  }
  if (type === "daifugo") {
    return applyDaifugoRules({
      phase: "waiting", players: [], hands: {}, currentPlayerUid: null,
      lastPlayedCards: [], lastPlayerUid: null, passedPlayers: [],
      revolution: false, elevenBack: false, lockSuit: null, winner: null
    });
  }
  return {};
}

async function joinGameRoom(room) {
  if (!currentUser || !username || !room?.id) return;

  try {
    const roomRef = doc(db, "gameRooms", room.id);
    const snapshot = await getDoc(roomRef);
    if (!snapshot.exists()) return alert("このルームは存在しません。");

    const data = snapshot.data();
    const members = Array.isArray(data.members) ? [...data.members] : [];
    const memberUids = Array.isArray(data.memberUids) ? [...data.memberUids] : [];
    const maxPlayers = getMaxGamePlayers(data.gameType);

    if (!members.includes(username)) {
      if (data.status === "playing") return alert("このゲームはすでに開始されています。");
      if (members.length >= maxPlayers) return alert("このルームは満員です。");

      members.push(username);
      memberUids.push(currentUser.uid);

      await updateDoc(roomRef, { members, memberUids, updatedAt: serverTimestamp() });
    }

    openGameArea(room.id, data.gameType || room.gameType);
    listenSelectedGame(room.id);
  } catch (error) {
    console.error("ゲームルーム参加エラー:", error);
    alert("ゲームルームに参加できませんでした。");
  }
}

function openGameArea(roomId, gameType) {
  selectedGameRoomId = roomId;
  if (!gameAreaEl) return;

  gameAreaEl.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <strong>${escapeHTML(getGameTypeName(gameType))}</strong>
        <button type="button" id="leaveGameRoomButton">ルームを閉じる</button>
      </div>
      <div id="currentGameStatus" class="game-status">読み込み中...</div>
      <div id="currentGameBoard" class="game-board"></div>
    </div>`;

  document.getElementById("leaveGameRoomButton")?.addEventListener("click", () => leaveGameRoom(roomId));
}

function listenSelectedGame(roomId) {
  if (unsubscribeCurrentGame) { unsubscribeCurrentGame(); unsubscribeCurrentGame = null; }

  unsubscribeCurrentGame = onSnapshot(
    doc(db, "gameRooms", roomId),
    (snapshot) => {
      if (!snapshot.exists()) { closeGameArea(); return; }
      renderCurrentGame({ id: snapshot.id, ...snapshot.data() });
    },
    (error) => console.error("現在のゲーム監視エラー:", error)
  );
}

async function leaveGameRoom(roomId) {
  if (!currentUser || !roomId) return;

  try {
    const roomRef = doc(db, "gameRooms", roomId);
    const snapshot = await getDoc(roomRef);
    if (!snapshot.exists()) { closeGameArea(); return; }

    const data = snapshot.data();
    const members = (data.members || []).filter((name) => name !== username);
    const memberUids = (data.memberUids || []).filter((uid) => uid !== currentUser.uid);

    if (members.length === 0) {
      await deleteDoc(roomRef);
    } else {
      await updateDoc(roomRef, { members, memberUids, status: "waiting", updatedAt: serverTimestamp() });
    }

    closeGameArea();
  } catch (error) {
    console.error("ゲームルーム退出エラー:", error);
  }
}

function closeGameArea() {
  if (unsubscribeCurrentGame) { unsubscribeCurrentGame(); unsubscribeCurrentGame = null; }
  selectedGameRoomId = null;
  selectedShogiPiece = null;
  selectedDaifugoCards = [];

  if (gameAreaEl) {
    gameAreaEl.innerHTML = `<div class="empty-state">ゲームを選択してください</div>`;
  }
}

/* =========================================================
   現在のゲームを描画（種類ごとに振り分けるだけ）
========================================================= */

function renderCurrentGame(room) {
  const statusEl = document.getElementById("currentGameStatus");
  const boardEl = document.getElementById("currentGameBoard");
  if (!boardEl) return;

  if (statusEl) {
    const members = Array.isArray(room.members) ? room.members : [];
    statusEl.textContent = `参加者 ${members.length}/${getMaxGamePlayers(room.gameType)}人`;
  }

  if (room.gameType === "othello") return renderOthelloBoard(boardEl, room);
  if (room.gameType === "shogi") return renderShogiBoard(boardEl, room);
  if (room.gameType === "daifugo") return renderDaifugoGame(boardEl, room);

  boardEl.innerHTML = `<div class="empty-state">ゲームを準備中です</div>`;
}

/* =========================================================
   オセロ
========================================================= */

function createInitialOthelloBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = "white"; board[3][4] = "black";
  board[4][3] = "black"; board[4][4] = "white";
  return board;
}

function getOthelloPlayerColor(room) {
  if (!currentUser || !room) return null;
  const members = Array.isArray(room.members) ? room.members : [];
  const index = members.indexOf(username);
  if (index === 0) return "black";
  if (index === 1) return "white";
  return null;
}

function getOthelloFlips(board, row, col, color) {
  const opponent = color === "black" ? "white" : "black";
  const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const result = [];

  directions.forEach(([dr, dc]) => {
    const line = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const value = board[r][c];
      if (value === opponent) {
        line.push([r, c]);
      } else {
        if (value === color && line.length > 0) result.push(...line);
        break;
      }
      r += dr; c += dc;
    }
  });

  return result;
}

function getOthelloValidMoves(board, color) {
  const moves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col]) continue;
      if (getOthelloFlips(board, row, col, color).length > 0) moves.push({ row, col });
    }
  }
  return moves;
}

function getOthelloWinner(board) {
  let black = 0, white = 0;
  board.forEach((row) => row.forEach((cell) => {
    if (cell === "black") black++;
    if (cell === "white") white++;
  }));

  const full = board.every((row) => row.every((cell) => cell !== null));
  const blackMoves = getOthelloValidMoves(board, "black");
  const whiteMoves = getOthelloValidMoves(board, "white");

  if (!full && (blackMoves.length > 0 || whiteMoves.length > 0)) return null;
  if (black > white) return "black";
  if (white > black) return "white";
  return "draw";
}

function getOthelloResultText(winner) {
  if (winner === "black") return "黒の勝ち！";
  if (winner === "white") return "白の勝ち！";
  if (winner === "draw") return "引き分け";
  return "";
}

function renderOthelloBoard(container, room) {
  if (!container) return;

  const state = room.gameState || createInitialGameState("othello");
  const board = Array.isArray(state.board) ? state.board : createInitialOthelloBoard();

  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "othello-wrapper";

  const info = document.createElement("div");
  info.className = "game-info";
  if (state.winner) {
    info.textContent = getOthelloResultText(state.winner);
  } else {
    info.textContent = (state.currentPlayer || "black") === "black" ? "黒の番" : "白の番";
  }
  wrapper.appendChild(info);

  const boardElement = document.createElement("div");
  boardElement.className = "othello-board";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "othello-cell";

      const value = board[row]?.[col] || null;
      if (value) {
        const stone = document.createElement("span");
        stone.className = `othello-stone ${value}`;
        cell.appendChild(stone);
      }

      cell.addEventListener("click", () => playOthelloMove(room, row, col));
      boardElement.appendChild(cell);
    }
  }

  wrapper.appendChild(boardElement);
  container.appendChild(wrapper);
}

async function playOthelloMove(room, row, col) {
  if (!currentUser || !username || !room?.id) return;

  const roomRef = doc(db, "gameRooms", room.id);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("ルームが存在しません");

      const latest = snapshot.data();
      const state = latest.gameState;
      if (!state?.board) throw new Error("ゲーム状態がありません");
      if (state.winner) throw new Error("すでに終了しています");

      const members = Array.isArray(latest.members) ? latest.members : [];
      if (members.length < 2) throw new Error("2人そろってから開始できます");

      const playerColor = getOthelloPlayerColor(latest);
      if (!playerColor) throw new Error("参加者ではありません");
      if (state.currentPlayer !== playerColor) throw new Error("あなたの番ではありません");

      const board = state.board;
      if (board[row][col]) throw new Error("そこには置けません");

      const flips = getOthelloFlips(board, row, col, playerColor);
      if (flips.length === 0) throw new Error("そこには置けません");

      const newBoard = board.map((line) => [...line]);
      newBoard[row][col] = playerColor;
      flips.forEach(([r, c]) => { newBoard[r][c] = playerColor; });

      let nextPlayer = playerColor === "black" ? "white" : "black";

      /* 次の人が置けない場合はさらに手番を回す */
      if (getOthelloValidMoves(newBoard, nextPlayer).length === 0) {
        if (getOthelloValidMoves(newBoard, playerColor).length > 0) {
          nextPlayer = playerColor;
        }
      }

      const winner = getOthelloWinner(newBoard);

      transaction.update(roomRef, {
        gameState: { ...state, board: newBoard, currentPlayer: nextPlayer, started: true, winner },
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("オセロ更新エラー:", error);
    if (error.message && error.message !== "ルームが存在しません") alert(error.message);
  }
}

/* =========================================================
   将棋
========================================================= */

function createInitialShogiBoard() {
  return [
    ["香","桂","銀","金","王","金","銀","桂","香"],
    [null,"飛",null,null,null,null,null,"角",null],
    ["歩","歩","歩","歩","歩","歩","歩","歩","歩"],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    ["歩","歩","歩","歩","歩","歩","歩","歩","歩"],
    [null,"角",null,null,null,null,null,"飛",null],
    ["香","桂","銀","金","玉","金","銀","桂","香"]
  ];
}

function ensureShogiState(state) {
  if (!state) return state;
  if (!Array.isArray(state.board)) state.board = createInitialShogiBoard();
  if (!state.captured) state.captured = { sente: [], gote: [] };
  if (!state.currentPlayer) state.currentPlayer = "sente";
  if (typeof state.winner === "undefined") state.winner = null;
  return state;
}

function getShogiPlayer(room) {
  if (!currentUser || !room) return null;
  const members = Array.isArray(room.members) ? room.members : [];
  const index = members.indexOf(username);
  if (index === 0) return "sente";
  if (index === 1) return "gote";
  return null;
}

function isPieceOwnedByPlayer(piece, row, player) {
  if (!piece) return false;
  const upper = row < 4, lower = row > 4;
  if (player === "sente") return !upper;
  if (player === "gote") return !lower;
  return false;
}

function isClearShogiPath(board, fromRow, fromCol, toRow, toCol) {
  const rowStep = Math.sign(toRow - fromRow);
  const colStep = Math.sign(toCol - fromCol);
  let row = fromRow + rowStep, col = fromCol + colStep;

  while (row !== toRow || col !== toCol) {
    if (board[row]?.[col]) return false;
    row += rowStep; col += colStep;
  }
  return true;
}

function isValidShogiMove(board, fromRow, fromCol, toRow, toCol, piece, player) {
  if (fromRow === toRow && fromCol === toCol) return false;
  if (toRow < 0 || toRow >= 9 || toCol < 0 || toCol >= 9) return false;

  const destination = board[toRow]?.[toCol] || null;
  if (destination && isPieceOwnedByPlayer(destination, toRow, player)) return false;

  const direction = player === "sente" ? -1 : 1;
  const dr = toRow - fromRow, dc = toCol - fromCol;
  const base = getUnpromotedShogiPiece(piece);

  switch (base) {
    case "歩": return dc === 0 && dr === direction;
    case "香":
      if (dc !== 0 || Math.sign(dr) !== direction) return false;
      return isClearShogiPath(board, fromRow, fromCol, toRow, toCol);
    case "桂": return Math.abs(dc) === 1 && dr === direction * 2;
    case "銀":
      return (dc === 0 && dr === direction) || (Math.abs(dc) === 1 && Math.abs(dr) === 1);
    case "金":
      return (dc === 0 && dr === direction) || (Math.abs(dc) === 1 && dr === 0) || (Math.abs(dc) === 1 && dr === -direction);
    case "王": case "玉":
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    case "飛":
      if (dr !== 0 && dc !== 0) return false;
      return isClearShogiPath(board, fromRow, fromCol, toRow, toCol);
    case "角":
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return isClearShogiPath(board, fromRow, fromCol, toRow, toCol);
    default: return false;
  }
}

const SHOGI_PROMOTED = { "歩":"と","香":"成香","桂":"成桂","銀":"成銀","角":"馬","飛":"龍" };
const SHOGI_UNPROMOTED = { "と":"歩","成香":"香","成桂":"桂","成銀":"銀","馬":"角","龍":"飛" };

function getUnpromotedShogiPiece(piece) { return SHOGI_UNPROMOTED[piece] || piece; }
function canPromoteShogiPiece(piece) { return Boolean(SHOGI_PROMOTED[piece]); }
function isInShogiPromotionZone(row, player) {
  if (player === "sente") return row <= 2;
  if (player === "gote") return row >= 6;
  return false;
}
function canPromoteOnShogiMove(piece, fromRow, toRow, player) {
  if (!canPromoteShogiPiece(piece)) return false;
  return isInShogiPromotionZone(fromRow, player) || isInShogiPromotionZone(toRow, player);
}
function mustPromoteShogiPiece(piece, toRow, player) {
  if ((piece === "歩" || piece === "香")) {
    if (player === "sente" && toRow === 0) return true;
    if (player === "gote" && toRow === 8) return true;
  }
  if (piece === "桂") {
    if (player === "sente" && toRow <= 1) return true;
    if (player === "gote" && toRow >= 7) return true;
  }
  return false;
}

function findShogiKing(board, player) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]?.[col];
      if ((piece === "王" || piece === "玉") && isPieceOwnedByPlayer(piece, row, player)) {
        return { row, col };
      }
    }
  }
  return null;
}

function isShogiInCheck(board, player) {
  const king = findShogiKing(board, player);
  if (!king) return true;
  const opponent = player === "sente" ? "gote" : "sente";

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]?.[col];
      if (!piece || !isPieceOwnedByPlayer(piece, row, opponent)) continue;
      if (isValidShogiMove(board, row, col, king.row, king.col, piece, opponent)) return true;
    }
  }
  return false;
}

function simulateShogiMove(board, fromRow, fromCol, toRow, toCol) {
  const newBoard = board.map((row) => [...row]);
  newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
  newBoard[fromRow][fromCol] = null;
  return newBoard;
}

function renderShogiBoard(container, room) {
  if (!container) return;

  const state = ensureShogiState(room.gameState || createInitialGameState("shogi"));
  const board = state.board;

  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "shogi-wrapper";

  const info = document.createElement("div");
  info.className = "game-info";
  if (state.winner) {
    info.textContent = state.winner === "sente" ? "☗ 先手の勝ち" : "☖ 後手の勝ち";
  } else {
    info.textContent = (state.currentPlayer || "sente") === "sente" ? "☗ 先手の番" : "☖ 後手の番";
    if (isShogiInCheck(board, state.currentPlayer)) info.textContent += "　⚠️ 王手";
  }
  wrapper.appendChild(info);

  const boardElement = document.createElement("div");
  boardElement.className = "shogi-board";

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "shogi-cell";

      const piece = board[row]?.[col] || null;
      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = "shogi-piece";
        pieceElement.textContent = piece;

        const player = getShogiPlayer(room);
        if (player && !isPieceOwnedByPlayer(piece, row, player)) {
          pieceElement.classList.add("opponent");
        }
        cell.appendChild(pieceElement);
      }

      if (selectedShogiPiece && selectedShogiPiece.row === row && selectedShogiPiece.col === col) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", () => handleShogiCellClick(room, row, col));
      boardElement.appendChild(cell);
    }
  }
  wrapper.appendChild(boardElement);

  /* 持ち駒 */
  ["gote", "sente"].forEach((player) => {
    const pieces = state.captured?.[player] || [];
    const box = document.createElement("div");
    box.className = "shogi-captured";
    box.innerHTML = `<div>${player === "sente" ? "☗" : "☖"} 持ち駒：${pieces.length ? pieces.map(escapeHTML).join(" ") : "なし"}</div>`;
    wrapper.appendChild(box);
  });

  container.appendChild(wrapper);
}

async function handleShogiCellClick(room, row, col) {
  if (!room?.gameState || room.gameState.winner) return;

  const player = getShogiPlayer(room);
  if (!player) return alert("このゲームの参加者ではありません。");
  currentShogiPlayer = player;

  const board = room.gameState.board;
  const piece = board[row]?.[col] || null;
  if (room.gameState.currentPlayer !== player) return;

  if (!selectedShogiPiece) {
    if (!piece || !isPieceOwnedByPlayer(piece, row, player)) return;
    selectedShogiPiece = { row, col };
    renderCurrentGame(room);
    return;
  }

  if (selectedShogiPiece.row === row && selectedShogiPiece.col === col) {
    selectedShogiPiece = null;
    renderCurrentGame(room);
    return;
  }

  if (piece && isPieceOwnedByPlayer(piece, row, player)) {
    selectedShogiPiece = { row, col };
    renderCurrentGame(room);
    return;
  }

  const from = selectedShogiPiece;
  const movingPiece = board[from.row]?.[from.col];
  if (!movingPiece) { selectedShogiPiece = null; renderCurrentGame(room); return; }

  if (!isValidShogiMove(board, from.row, from.col, row, col, movingPiece, player)) return;

  if (isShogiMoveLeavingKingInCheck(board, from.row, from.col, row, col, player)) {
    alert("その手は自分の玉が王手になるため指せません。");
    return;
  }

  let shouldPromote = mustPromoteShogiPiece(getUnpromotedShogiPiece(movingPiece), row, player);
  if (!shouldPromote && canPromoteOnShogiMove(getUnpromotedShogiPiece(movingPiece), from.row, row, player)) {
    shouldPromote = confirm("この駒を成りますか？");
  }

  await executeShogiMove(room, from, { row, col }, movingPiece, player, shouldPromote);
}

function isShogiMoveLeavingKingInCheck(board, fromRow, fromCol, toRow, toCol, player) {
  const simulated = simulateShogiMove(board, fromRow, fromCol, toRow, toCol);
  return isShogiInCheck(simulated, player);
}

async function executeShogiMove(room, from, to, piece, player, shouldPromote) {
  const roomRef = doc(db, "gameRooms", room.id);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("ルームが存在しません");

      const latest = snapshot.data();
      const state = ensureShogiState(latest.gameState);
      if (state.currentPlayer !== player) throw new Error("現在の手番ではありません");

      const board = state.board.map((line) => [...line]);
      const latestPiece = board[from.row]?.[from.col];
      if (!latestPiece) throw new Error("駒がありません");

      const destination = board[to.row]?.[to.col] || null;
      if (destination && isPieceOwnedByPlayer(destination, to.row, player)) {
        throw new Error("自分の駒があるマスです");
      }
      if (!isValidShogiMove(board, from.row, from.col, to.row, to.col, latestPiece, player)) {
        throw new Error("不正な手です");
      }

      const captured = state.captured || { sente: [], gote: [] };
      if (destination) {
        const base = getUnpromotedShogiPiece(destination);
        captured[player] = [...(captured[player] || []), base];
      }

      let placedPiece = latestPiece;
      if (shouldPromote) placedPiece = SHOGI_PROMOTED[getUnpromotedShogiPiece(latestPiece)] || latestPiece;

      board[to.row][to.col] = placedPiece;
      board[from.row][from.col] = null;

      const nextPlayer = player === "sente" ? "gote" : "sente";
      let winner = null;
      if (destination === "王" || destination === "玉") winner = player;

      transaction.update(roomRef, {
        gameState: { ...state, board, captured, currentPlayer: nextPlayer, winner },
        updatedAt: serverTimestamp()
      });
    });

    selectedShogiPiece = null;
  } catch (error) {
    console.error("将棋の手エラー:", error);
    if (error.message !== "ルームが存在しません") alert(error.message || "駒を動かせませんでした。");
  }
}

/* =========================================================
   大富豪
========================================================= */

const DAIHUGO_SUITS = ["♠", "♥", "♦", "♣"];
const DAIHUGO_RANK_LABELS = { 3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A",15:"2" };

function applyDaifugoRules(state) {
  if (!state) return state;
  if (typeof state.revolution !== "boolean") state.revolution = false;
  if (typeof state.elevenBack !== "boolean") state.elevenBack = false;
  if (!("lockSuit" in state)) state.lockSuit = null;
  if (!Array.isArray(state.passedPlayers)) state.passedPlayers = [];
  return state;
}

function createDaifugoDeck() {
  const deck = [];
  DAIHUGO_SUITS.forEach((suit) => {
    Object.keys(DAIHUGO_RANK_LABELS).forEach((rank) => {
      deck.push({ id: `${suit}-${rank}-${Math.random().toString(36).slice(2)}`, suit, value: Number(rank), label: DAIHUGO_RANK_LABELS[rank], isJoker: false });
    });
  });
  deck.push({ id: `joker1-${Math.random().toString(36).slice(2)}`, suit: "🃏", value: 16, label: "Joker", isJoker: true });
  deck.push({ id: `joker2-${Math.random().toString(36).slice(2)}`, suit: "🃏", value: 16, label: "Joker", isJoker: true });
  return deck;
}

function shuffleDaifugoDeck(deck) {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dealDaifugoCards(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => hands[index % playerCount].push(card));
  hands.forEach((hand) => hand.sort((a, b) => a.value - b.value));
  return hands;
}

async function startDaifugoGame(roomId) {
  if (!currentUser) return;

  try {
    const roomRef = doc(db, "gameRooms", roomId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("ROOM_NOT_FOUND");

      const room = snapshot.data();
      if (room.ownerUid !== currentUser.uid) throw new Error("NOT_HOST");
      if (room.gameState?.phase === "playing") throw new Error("ALREADY_STARTED");

      const memberUids = Array.isArray(room.memberUids) ? room.memberUids : [];
      const memberNames = Array.isArray(room.members) ? room.members : [];
      if (memberUids.length < 2) throw new Error("NOT_ENOUGH_PLAYERS");

      const deck = shuffleDaifugoDeck(createDaifugoDeck());
      const hands = dealDaifugoCards(deck, memberUids.length);
      const handsByUid = {};
      memberUids.forEach((uid, index) => { handsByUid[uid] = hands[index]; });

      const players = memberUids.map((uid, index) => ({
        uid, name: memberNames[index] || "プレイヤー", finished: false, rank: null
      }));

      const gameState = applyDaifugoRules({
        phase: "playing", players, hands: handsByUid,
        currentPlayerUid: memberUids[0], lastPlayedCards: [], lastPlayerUid: null,
        passedPlayers: [], revolution: false, elevenBack: false, lockSuit: null, winner: null
      });

      transaction.update(roomRef, { status: "playing", gameState, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("大富豪開始エラー:", error);
    if (error.message === "NOT_HOST") alert("部屋を作った人だけが開始できます。");
    else if (error.message === "NOT_ENOUGH_PLAYERS") alert("2人以上参加してから開始してください。");
    else alert("大富豪を開始できませんでした。");
  }
}

function getMyDaifugoHand(room) {
  const hands = room?.gameState?.hands || {};
  return currentUser && Array.isArray(hands[currentUser.uid]) ? hands[currentUser.uid] : [];
}

function toggleDaifugoCard(cardId) {
  const index = selectedDaifugoCards.indexOf(cardId);
  if (index >= 0) selectedDaifugoCards.splice(index, 1);
  else selectedDaifugoCards.push(cardId);
}

function areSameDaifugoValue(cards) {
  if (!cards.length) return false;
  const normal = cards.filter((c) => !c.isJoker);
  if (normal.length === 0) return true;
  return normal.every((c) => c.value === normal[0].value);
}

function isDaifugoValidSequence(cards) {
  if (cards.length < 3) return false;
  const normal = cards.filter((c) => !c.isJoker);
  if (normal.length !== cards.length) return false;

  const suit = normal[0].suit;
  if (!normal.every((c) => c.suit === suit)) return false;

  const sorted = [...normal].sort((a, b) => a.value - b.value);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].value !== sorted[i - 1].value + 1) return false;
  }
  return true;
}

function getDaifugoCombinationType(cards) {
  if (!cards.length) return null;
  if (cards.length === 1) return "single";
  if (areSameDaifugoValue(cards)) return "group";
  if (isDaifugoValidSequence(cards)) return "sequence";
  return null;
}

function getDaifugoCardPower(card, revolution) {
  if (!card) return 0;
  if (card.isJoker) return revolution ? 1 : 100;
  if (!revolution) return card.value;
  const table = { 3:15,4:14,5:13,6:12,7:11,8:10,9:9,10:8,11:7,12:6,13:5,14:4,15:3 };
  return table[card.value] || card.value;
}

function getDaifugoPlayPower(cards, revolution) {
  if (!cards.length) return 0;
  return Math.max(...cards.map((c) => getDaifugoCardPower(c, revolution)));
}

function canUseDaifugoSuitLock(selected, game) {
  if (!game?.lockSuit) return true;
  const normal = selected.filter((c) => !c.isJoker);
  if (!normal.length) return true;
  return normal.every((c) => c.suit === game.lockSuit);
}

function isDaifugoEightCut(cards) {
  return cards.some((c) => !c.isJoker && c.value === 8);
}

function canPlayDaifugoSelection(selectedCards, game) {
  if (!selectedCards.length || !game) return false;
  if (!canUseDaifugoSuitLock(selectedCards, game)) return false;

  const type = getDaifugoCombinationType(selectedCards);
  if (!type) return false;

  const lastPlayed = Array.isArray(game.lastPlayedCards) ? game.lastPlayedCards : [];
  if (lastPlayed.length === 0) return true;
  if (selectedCards.length !== lastPlayed.length) return false;
  if (isDaifugoEightCut(selectedCards)) return true;

  const selectedPower = getDaifugoPlayPower(selectedCards, Boolean(game.revolution));
  const lastPower = getDaifugoPlayPower(lastPlayed, Boolean(game.revolution));
  return selectedPower > lastPower;
}

function updateDaifugoLock(game, selectedCards, previousCards) {
  const prevNormal = (previousCards || []).filter((c) => !c.isJoker);
  const selNormal = selectedCards.filter((c) => !c.isJoker);

  if (!prevNormal.length || !selNormal.length) { game.lockSuit = null; return; }

  const prevSuit = prevNormal[0].suit;
  const selSuit = selNormal[0].suit;

  if (prevSuit === selSuit && selNormal.every((c) => c.suit === selSuit)) {
    game.lockSuit = selSuit;
  } else {
    game.lockSuit = null;
  }
}

function clearDaifugoTable(game) {
  game.lastPlayedCards = [];
  game.lastPlayerUid = null;
  game.passedPlayers = [];
  game.lockSuit = null;
}

function findNextDaifugoPlayer(room, game, fromUid) {
  const memberUids = Array.isArray(room.memberUids) ? room.memberUids : [];
  const players = game.players || [];
  const fromIndex = memberUids.indexOf(fromUid);

  for (let i = 1; i <= memberUids.length; i++) {
    const idx = (fromIndex + i) % memberUids.length;
    const uid = memberUids[idx];
    const player = players.find((p) => p.uid === uid);
    if (player && !player.finished) return uid;
  }
  return fromUid;
}

function getDaifugoRuleStatus(game) {
  const status = [];
  if (game.revolution) status.push("🔄 革命");
  if (game.elevenBack) status.push("↩️ 11バック");
  if (game.lockSuit) status.push(`🔒 ${game.lockSuit}縛り`);
  return status.length ? status.join("　") : "通常状態";
}

function buildDaifugoCardElement(card, isSelected, interactive) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  const el = document.createElement(interactive ? "button" : "div");
  if (interactive) el.type = "button";
  el.className = `playing-card daifugo-card ${isRed ? "red" : "black"}`;
  if (card.isJoker) el.classList.add("joker");
  if (isSelected) el.classList.add("selected");
  if (!interactive) el.classList.add("daifugo-field-card");

  const suit = document.createElement("span");
  suit.className = "card-suit";
  suit.textContent = card.suit;

  const rank = document.createElement("span");
  rank.className = "card-rank";
  rank.textContent = card.label;

  el.append(suit, rank);
  return el;
}

function renderDaifugoGame(container, room) {
  if (!container) return;
  const game = applyDaifugoRules(room.gameState || createInitialGameState("daifugo"));

  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "daifugo-wrapper";

  if (game.phase !== "playing") {
    const members = Array.isArray(room.members) ? room.members : [];
    const canStart = room.ownerUid === currentUser?.uid && members.length >= 2;

    wrapper.innerHTML = `<div class="game-info">参加者 ${members.length}/${getMaxGamePlayers(room.gameType)}人（2人以上でゲーム開始できます）</div>`;

    if (canStart) {
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.className = "primary-button";
      startButton.textContent = "ゲームを開始する";
      startButton.addEventListener("click", () => startDaifugoGame(room.id));
      wrapper.appendChild(startButton);
    }

    container.appendChild(wrapper);
    return;
  }

  const status = document.createElement("div");
  status.className = "game-status";

  if (game.winner) {
    const winnerPlayer = (game.players || []).find((p) => p.uid === game.winner);
    status.textContent = `🏆 ${winnerPlayer?.name || "プレイヤー"} の勝ち！`;
  } else {
    const current = (game.players || []).find((p) => p.uid === game.currentPlayerUid);
    status.textContent = `現在の番：${current?.name || ""}　${getDaifugoRuleStatus(game)}`;
  }
  wrapper.appendChild(status);

  const field = document.createElement("div");
  field.className = "daifugo-field";

  if ((game.lastPlayedCards || []).length) {
    const fieldLabel = document.createElement("div");
    fieldLabel.className = "daifugo-field-label";
    fieldLabel.textContent = "場";
    field.appendChild(fieldLabel);

    const fieldCards = document.createElement("div");
    fieldCards.className = "daifugo-field-cards";
    game.lastPlayedCards.forEach((c) => {
      fieldCards.appendChild(buildDaifugoCardElement(c, false, false));
    });
    field.appendChild(fieldCards);
  } else {
    field.innerHTML = `<div class="daifugo-field-label">場</div><div class="daifugo-field-empty">まだ何も出ていません</div>`;
  }
  wrapper.appendChild(field);

  const myHand = getMyDaifugoHand(room);
  const isMyTurn = game.currentPlayerUid === currentUser?.uid && !game.winner;

  const handTitleRow = document.createElement("div");
  handTitleRow.className = "daifugo-hand-title-row";

  const handTitle = document.createElement("h4");
  handTitle.textContent = `あなたの手札（${myHand.length}枚）`;
  handTitleRow.appendChild(handTitle);

  if (selectedDaifugoCards.length > 0) {
    const selectedCount = document.createElement("span");
    selectedCount.className = "daifugo-selected-count";
    selectedCount.textContent = `${selectedDaifugoCards.length}枚 選択中`;
    handTitleRow.appendChild(selectedCount);
  }
  wrapper.appendChild(handTitleRow);

  const hand = document.createElement("div");
  hand.className = "daifugo-hand";

  myHand.forEach((card) => {
    const isSelected = selectedDaifugoCards.includes(card.id);
    const button = buildDaifugoCardElement(card, isSelected, true);
    button.disabled = !isMyTurn;
    button.addEventListener("click", () => { toggleDaifugoCard(card.id); renderCurrentGame(room); });
    hand.appendChild(button);
  });
  wrapper.appendChild(hand);

  const controls = document.createElement("div");
  controls.className = "game-controls";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "primary-button daifugo-play-button";
  playButton.textContent = selectedDaifugoCards.length > 0 ? `このカードを出す（${selectedDaifugoCards.length}枚）` : "カードを出す";
  playButton.disabled = !isMyTurn || selectedDaifugoCards.length === 0;
  playButton.classList.toggle("is-ready", !playButton.disabled);
  playButton.addEventListener("click", () => playDaifugoCards(room.id));

  const passButton = document.createElement("button");
  passButton.type = "button";
  passButton.className = "secondary-button";
  passButton.textContent = "パス";
  passButton.disabled = !isMyTurn || (game.lastPlayedCards || []).length === 0;
  passButton.addEventListener("click", () => passDaifugoTurn(room.id));

  controls.append(playButton, passButton);
  wrapper.appendChild(controls);

  const playersTitle = document.createElement("h4");
  playersTitle.textContent = "プレイヤー";
  wrapper.appendChild(playersTitle);

  const playersEl = document.createElement("div");
  playersEl.className = "daifugo-players";
  (game.players || []).forEach((player) => {
    const item = document.createElement("div");
    item.className = "daifugo-player";
    if (player.uid === game.currentPlayerUid) item.classList.add("current");
    const handCount = (game.hands?.[player.uid] || []).length;
    item.textContent = player.finished ? `${player.name}　上がり(${player.rank}位)` : `${player.name}　${handCount}枚`;
    playersEl.appendChild(item);
  });
  wrapper.appendChild(playersEl);

  container.appendChild(wrapper);
}

async function playDaifugoCards(roomId) {
  if (!currentUser) return;
  if (selectedDaifugoCards.length === 0) return alert("カードを選択してください。");

  const roomRef = doc(db, "gameRooms", roomId);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("ROOM_NOT_FOUND");

      const room = snapshot.data();
      const game = applyDaifugoRules(room.gameState);
      if (!game || game.phase !== "playing") throw new Error("GAME_FINISHED");
      if (game.currentPlayerUid !== currentUser.uid) throw new Error("NOT_YOUR_TURN");

      const hands = game.hands || {};
      const myHand = Array.isArray(hands[currentUser.uid]) ? [...hands[currentUser.uid]] : [];
      const selected = myHand.filter((card) => selectedDaifugoCards.includes(card.id));

      if (selected.length !== selectedDaifugoCards.length) throw new Error("CARD_NOT_FOUND");

      const isEightCut = isDaifugoEightCut(selected);
      const isRevolution = selected.length >= 4 && areSameDaifugoValue(selected);
      const isElevenBack = selected.some((c) => !c.isJoker && c.value === 11);

      if (!isEightCut && !canPlayDaifugoSelection(selected, game)) {
        throw new Error("INVALID_COMBINATION");
      }

      const previousCards = Array.isArray(game.lastPlayedCards) ? [...game.lastPlayedCards] : [];

      hands[currentUser.uid] = myHand.filter((card) => !selectedDaifugoCards.includes(card.id));

      const players = (game.players || []).map((p) => ({ ...p }));
      const myPlayer = players.find((p) => p.uid === currentUser.uid);
      let finishedOrder = players.filter((p) => p.finished).length;

      if (hands[currentUser.uid].length === 0 && myPlayer && !myPlayer.finished) {
        myPlayer.finished = true;
        myPlayer.rank = finishedOrder + 1;
        finishedOrder++;
      }

      game.hands = hands;
      game.players = players;
      game.lastPlayedCards = selected;
      game.lastPlayerUid = currentUser.uid;

      if (isRevolution) game.revolution = !game.revolution;
      if (isElevenBack) game.elevenBack = !game.elevenBack;
      updateDaifugoLock(game, selected, previousCards);

      if (isEightCut) {
        clearDaifugoTable(game);
        game.currentPlayerUid = currentUser.uid;
      } else {
        const activePlayers = players.filter((p) => !p.finished);
        if (activePlayers.length <= 1) {
          if (activePlayers.length === 1) {
            activePlayers[0].finished = true;
            activePlayers[0].rank = finishedOrder + 1;
          }
          game.phase = "finished";
          game.winner = players.find((p) => p.rank === 1)?.uid || myPlayer?.uid || null;
        } else {
          game.currentPlayerUid = findNextDaifugoPlayer(room, game, currentUser.uid);
        }
      }

      transaction.update(roomRef, { gameState: game, updatedAt: serverTimestamp() });
    });

    selectedDaifugoCards = [];
  } catch (error) {
    console.error("大富豪エラー:", error);
    if (error.message === "NOT_YOUR_TURN") alert("今はあなたの番ではありません。");
    else if (error.message === "INVALID_COMBINATION") alert("そのカードの組み合わせは出せません。");
    else if (error.message === "GAME_FINISHED") alert("このゲームは終了しています。");
    else if (error.message !== "ROOM_NOT_FOUND") alert("カードを出せませんでした。");
  }
}

async function passDaifugoTurn(roomId) {
  if (!currentUser) return;
  const roomRef = doc(db, "gameRooms", roomId);

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("ROOM_NOT_FOUND");

      const room = snapshot.data();
      const game = applyDaifugoRules(room.gameState);
      if (!game || game.currentPlayerUid !== currentUser.uid) throw new Error("NOT_YOUR_TURN");
      if (!(game.lastPlayedCards || []).length) throw new Error("CANNOT_PASS");

      const players = game.players || [];
      const activePlayers = players.filter((p) => !p.finished);
      const passed = Array.isArray(game.passedPlayers) ? [...game.passedPlayers] : [];
      if (!passed.includes(currentUser.uid)) passed.push(currentUser.uid);

      if (activePlayers.every((p) => passed.includes(p.uid) || p.uid === game.lastPlayerUid)) {
        clearDaifugoTable(game);
        const restartUid = game.lastPlayerUid;
        const restartPlayer = players.find((p) => p.uid === restartUid && !p.finished);
        game.currentPlayerUid = restartPlayer ? restartUid : findNextDaifugoPlayer(room, game, currentUser.uid);
      } else {
        game.passedPlayers = passed;
        game.currentPlayerUid = findNextDaifugoPlayer(room, game, currentUser.uid);
      }

      transaction.update(roomRef, { gameState: game, updatedAt: serverTimestamp() });
    });

    selectedDaifugoCards = [];
  } catch (error) {
    console.error("大富豪パスエラー:", error);
    if (error.message === "NOT_YOUR_TURN") alert("今はあなたの番ではありません。");
    else if (error.message === "CANNOT_PASS") alert("最初のカードはパスできません。");
  }
}
