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

    localStorage.setItem(
        "yuuchat_username",
        username
    );
}


/* =========================
   HTML
========================= */

const status =
    document.getElementById("status");

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
   現在の相手
========================= */

let selectedFriend = "";


/* =========================
   友達追加
========================= */

addFriendButton.onclick = async function () {

    const friendName =
        prompt("追加する友達の名前を入力してください");

    if (!friendName) {
        return;
    }

    const name =
        friendName.trim();

    if (name === "") {
        return;
    }

    try {

        await addDoc(
            friendsCollection,
            {
                owner: username,
                friendName: name,
                createdAt: serverTimestamp()
            }
        );

        alert(
            name + "さんを友達に追加しました！"
        );

    } catch (error) {

        console.error(error);

        alert(
            "友達を追加できませんでした。"
        );

    }
};


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

                friend.type = "button";

                friend.textContent =
                    "👤 " + data.friendName;


                /* ここが重要 */

                friend.onclick = function () {

                    selectFriend(
                        data.friendName
                    );

                };


                friendsList.appendChild(friend);

            }
        );

    }
);


/* =========================
   友達を選択
========================= */

function selectFriend(friendName) {

    selectedFriend = friendName;

    chatHeader.textContent =
        "💬 " + friendName;

    input.placeholder =
        friendName + "にメッセージ";

    input.disabled = false;

    sendButton.disabled = false;

    messages.innerHTML = "";

    loadMessages();

    input.focus();
}


/* =========================
   メッセージ読み込み
========================= */

let stopMessages = null;


function loadMessages() {

    if (stopMessages) {
        stopMessages();
    }

    if (!selectedFriend) {
        return;
    }


    const messagesQuery = query(
        messagesCollection,
        orderBy("createdAt", "asc")
    );


    stopMessages =
        onSnapshot(
            messagesQuery,
            function (snapshot) {

                messages.innerHTML = "";

                snapshot.forEach(
                    function (doc) {

                        const data =
                            doc.data();


                        const myMessage =
                            data.username === username &&
                            data.receiver === selectedFriend;


                        const friendMessage =
                            data.username === selectedFriend &&
                            data.receiver === username;


                        if (
                            !myMessage &&
                            !friendMessage
                        ) {
                            return;
                        }


                        const message =
                            document.createElement(
                                "div"
                            );


                        if (myMessage) {

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


                        bubble.textContent =
                            data.username +
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
                createdAt: serverTimestamp()
            }
        );

        input.value = "";

    } catch (error) {

        console.error(error);

        alert(
            "メッセージを送信できませんでした。"
        );

    }
}


/* =========================
   送信
========================= */

sendButton.onclick =
    sendMessage;


/* =========================
   Enter
========================= */

input.onkeydown =
    function (event) {

        if (event.key === "Enter") {
            sendMessage();
        }

    };
