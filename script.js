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
   Firebase
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

const status = document.getElementById("status");
const addFriendButton =
    document.getElementById("addFriendButton");

const friendsList =
    document.getElementById("friendsList");

const chatHeader =
    document.getElementById("chatHeader");

const messages =
    document.getElementById("messages");

const input =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");


status.textContent =
    username + "としてオンライン";


/* =========================
   Firestore
========================= */

const friendsCollection =
    collection(db, "friends");

const messagesCollection =
    collection(db, "messages");


/* =========================
   現在のチャット相手
========================= */

let selectedFriend = null;


/* =========================
   友達追加
========================= */

addFriendButton.addEventListener(
    "click",
    async function () {

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

            alert(
                name + "さんを友達に追加しました！"
            );

        } catch (error) {

            console.error(
                "友達追加エラー:",
                error
            );

            alert(
                "友達を追加できませんでした。"
            );

        }

    }
);


/* =========================
   友達一覧
========================= */

const friendsQuery = query(
    friendsCollection,
    orderBy("createdAt", "asc")
);


onSnapshot(
    friendsQuery,
    function (snapshot) {

        friendsList.innerHTML = "";

        snapshot.forEach(
            function (doc) {

                const data = doc.data();

                if (data.owner !== username) {
                    return;
                }

                const friend =
                    document.createElement("button");

                friend.className = "friend";

                friend.textContent =
                    "👤 " + data.friendName;

                friend.addEventListener(
                    "click",
                    function () {

                        openChat(
                            data.friendName
                        );

                    }
                );

                friendsList.appendChild(friend);

            }
        );

    }
);


/* =========================
   チャットを開く
========================= */

function openChat(friendName) {

    selectedFriend = friendName;

    chatHeader.textContent =
        "💬 " + friendName;

    input.disabled = false;
    sendButton.disabled = false;

    input.placeholder =
        friendName + "にメッセージ";

    loadMessages();

}


/* =========================
   メッセージ表示
========================= */

let unsubscribeMessages = null;


function loadMessages() {

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    messages.innerHTML = "";

    if (!selectedFriend) {
        return;
    }


    const messagesQuery = query(
        messagesCollection,
        orderBy("createdAt", "asc")
    );


    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            function (snapshot) {

                messages.innerHTML = "";

                snapshot.forEach(
                    function (doc) {

                        const data =
                            doc.data();


                        /*
                         * 自分と相手の
                         * チャットだけ表示
                         */

                        const isMyMessage =
                            data.username === username;

                        const isFromFriend =
                            data.username === selectedFriend;


                        if (
                            !isMyMessage &&
                            !isFromFriend
                        ) {
                            return;
                        }


                        const message =
                            document.createElement(
                                "div"
                            );


                        if (isMyMessage) {

                            message.className =
                                "message mine";

                        } else {

                            message.className =
                                "message other";

                        }


                        const bubble =
                            document.createElement(
                                "div"
                            );

                        bubble.className =
                            "bubble";


                        const name =
                            data.username ||
                            "相手";


                        bubble.textContent =
                            name +
                            "： " +
                            data.text;


                        message.appendChild(
                            bubble
                        );

                        messages.appendChild(
                            message
                        );

                    }
                );


                messages.scrollTop =
                    messages.scrollHeight;

            }
        );

}


/* =========================
   メッセージ送信
========================= */

async function sendMessage() {

    if (!selectedFriend) {

        alert(
            "先に友達を選択してください。"
        );

        return;
    }


    const text =
        input.value.trim();


    if (text === "") {
        return;
    }


    try {

        await addDoc(
            messagesCollection,
            {

                text: text,

                username: username,

                receiver: selectedFriend,

                createdAt:
                    serverTimestamp()

            }
        );


        input.value = "";

    } catch (error) {

        console.error(
            "送信エラー:",
            error
        );

        alert(
            "メッセージを送信できませんでした。"
        );

    }

}


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
    function (event) {

        if (event.key === "Enter") {

            sendMessage();

        }

    }
);
