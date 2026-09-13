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


// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyDJFat47sz6KkaGuvj1dVjfELhRmH_2Tw",
    authDomain: "yuuchat-be666.firebaseapp.com",
    projectId: "yuuchat-be666",
    storageBucket: "yuuchat-be666.firebasestorage.app",
    messagingSenderId: "89509274877",
    appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};


// Firebaseを起動
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// HTMLの要素
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");


// Firestoreの「messages」という場所を使う
const messagesCollection = collection(db, "messages");


// メッセージを送信
async function sendMessage() {

    const text = input.value.trim();

    if (text === "") {
        return;
    }

    try {

        await addDoc(messagesCollection, {
            text: text,
            type: "mine",
            createdAt: serverTimestamp()
        });

        input.value = "";

    } catch (error) {

        console.error("送信エラー:", error);

        alert("メッセージを送信できませんでした。");

    }
}


// Firebaseからメッセージをリアルタイム取得
const messagesQuery = query(
    messagesCollection,
    orderBy("createdAt", "asc")
);


onSnapshot(messagesQuery, (snapshot) => {

    messages.innerHTML = "";

    snapshot.forEach((doc) => {

        const data = doc.data();

        const message = document.createElement("div");

        message.className =
            data.type === "mine"
                ? "message mine"
                : "message other";


        const bubble = document.createElement("div");

        bubble.className = "bubble";

        bubble.textContent = data.text;


        message.appendChild(bubble);

        messages.appendChild(message);

    });


    messages.scrollTop = messages.scrollHeight;

});


// 送信ボタン
sendButton.addEventListener("click", sendMessage);


// Enterキーでも送信
input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {

        sendMessage();

    }

});
```
