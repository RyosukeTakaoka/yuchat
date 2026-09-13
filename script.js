import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================
   Firebase設定
========================= */

const firebaseConfig = {
    apiKey: "AIzaSyDJFat47sz6KkaGuvj1dVjfELhRmH_2Tw",
    authDomain: "yuuchat-be666.firebaseapp.com",
    projectId: "yuuchat-be666",
    storageBucket: "yuuchat-be666.firebasestorage.app",
    messagingSenderId: "89509274877",
    appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


/* =========================
   ユーザー名
========================= */

let username = localStorage.getItem("yuuchat_username");

if (!username) {

    username = prompt("あなたの名前を入力してください");

    if (!username || username.trim() === "") {
        username = "ゆうた";
    }

    username = username.trim();

    localStorage.setItem("yuuchat_username", username);
}


/* =========================
   HTML
========================= */

const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");
const status = document.getElementById("status");

const addFriendButton =
    document.getElementById("addFriendButton");

const friendsList =
    document.getElementById("friendsList");


status.textContent =
    username + "としてオンライン";


/* =========================
   Firestore
========================= */

const messagesCollection =
    collection(db, "messages");

const friendsCollection =
    collection(db, "friends");


/* =========================
   友達追加
========================= */

addFriendButton.addEventListener("click", async function () {

    const friendName =
        prompt("追加する友達の名前を入力してください");

    if (!friendName || friendName.trim() === "") {
        return;
    }

    const name = friendName.trim();

    try {

        await addDoc(friendsCollection, {

            owner: username,

            friendName: name,

            createdAt: serverTimestamp()

        });

        alert(name + "さんを友達に追加しました！");

    } catch (error) {

        console.error("友達追加エラー:", error);

        alert("友達を追加できませんでした。");

    }

});


/* =========================
   友達一覧表示
========================= */

const friendsQuery = query(
    friendsCollection,
    orderBy("createdAt", "asc")
);


onSnapshot(friendsQuery, function(snapshot) {

    friendsList.innerHTML = "";

    snapshot.forEach(function(doc) {

        const data = doc.data();

        // 自分が追加した友達だけ表示
        if (data.owner !== username) {
            return;
        }

        const friend = document.createElement("button");

        friend.className = "friend";

        friend.textContent =
            "👤 " + data.friendName;

        friendsList.appendChild(friend);

    });

});


/* =========================
   メッセージ送信
========================= */

async function sendMessage() {

    const text = input.value.trim();

    if (text === "") {
        return;
    }

    try {

        await addDoc(messagesCollection, {

            text: text,

            username: username,

            createdAt: serverTimestamp()

        });

        input.value = "";

    } catch (error) {

        console.error("送信エラー:", error);

        alert("メッセージを送信できませんでした。");

    }

}


/* =========================
   メッセージ表示
========================= */

const messagesQuery = query(
    messagesCollection,
    orderBy("createdAt", "asc")
);


onSnapshot(messagesQuery, function(snapshot) {

    messages.innerHTML = "";

    snapshot.forEach(function(doc) {

        const data = doc.data();

        const message =
            document.createElement("div");

        if (data.username === username) {

            message.className =
                "message mine";

        } else {

            message.className =
                "message other";

        }

        const bubble =
            document.createElement("div");

        bubble.className = "bubble";

        const name =
            data.username || "相手";

        bubble.textContent =
            name + "： " + data.text;

        message.appendChild(bubble);

        messages.appendChild(message);

    });

    messages.scrollTop =
        messages.scrollHeight;

});


/* =========================
   送信ボタン
========================= */

sendButton.addEventListener(
    "click",
    sendMessage
);


/* =========================
   Enterキー
========================= */

input.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            sendMessage();

        }

    }
);
```
