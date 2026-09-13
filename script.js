```javascript
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


status.textContent = username + "としてオンライン";


/* =========================
   Firestore
========================= */

const messagesCollection = collection(db, "messages");


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


onSnapshot(messagesQuery, (snapshot) => {

    messages.innerHTML = "";


    snapshot.forEach((doc) => {

        const data = doc.data();


        const message = document.createElement("div");


        if (data.username === username) {

            message.className = "message mine";

        } else {

            message.className = "message other";

        }


        const bubble = document.createElement("div");

        bubble.className = "bubble";


        bubble.textContent = data.username + "： " + data.text;


        message.appendChild(bubble);

        messages.appendChild(message);

    });


    messages.scrollTop = messages.scrollHeight;

});


/* =========================
   送信ボタン
========================= */

sendButton.addEventListener("click", sendMessage);


/* =========================
   Enterキー
========================= */

input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {

        sendMessage();

    }

});
```
