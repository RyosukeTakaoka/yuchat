import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    doc
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

const replyBar =
    document.getElementById("replyBar");

const replyText =
    document.getElementById("replyText");

const cancelReplyButton =
    document.getElementById("cancelReplyButton");

status.textContent =
    username + "としてオンライン";

const friendsCollection =
    collection(db, "friends");

const messagesCollection =
    collection(db, "messages");

let selectedFriend = "";

let replyTarget = null;

let stopMessages = null;

if ("Notification" in window) {
    Notification.requestPermission();
}

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

    if (name === username) {
        alert("自分自身は追加できません。");
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
            name +
            "さんを友達に追加しました！"
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
};

const friendsQuery =
    query(
        friendsCollection,
        orderBy("createdAt", "asc")
    );

onSnapshot(
    friendsQuery,
    function (snapshot) {

        friendsList.innerHTML = "";

        snapshot.forEach(
            function (friendDoc) {

                const data =
                    friendDoc.data();

                if (data.owner !== username) {
                    return;
                }

                const friend =
                    document.createElement("button");

                friend.className =
                    "friend";

                friend.type =
                    "button";

                friend.textContent =
                    "👤 " + data.friendName;

                friend.onclick =
                    function () {

                        selectFriend(
                            data.friendName
                        );
                    };

                friendsList.appendChild(friend);
            }
        );
    },
    function (error) {

        console.error(
            "友達一覧読み込みエラー:",
            error
        );
    }
);

function selectFriend(friendName) {

    selectedFriend =
        friendName;

    chatHeader.textContent =
        "💬 " + friendName;

    input.placeholder =
        friendName + "にメッセージ";

    input.disabled = false;

    sendButton.disabled = false;

    cancelReply();

    loadMessages();

    input.focus();
}

function loadMessages() {

    if (stopMessages) {
        stopMessages();
    }

    messages.innerHTML = "";

    if (!selectedFriend) {
        return;
    }

    const messagesQuery =
        query(
            messagesCollection,
            orderBy("createdAt", "asc")
        );

    stopMessages =
        onSnapshot(
            messagesQuery,
            function (snapshot) {

                messages.innerHTML = "";

                snapshot.forEach(
                    function (messageDoc) {

                        const data =
                            messageDoc.data();

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

                        createMessageElement(
                            messageDoc.id,
                            data,
                            myMessage
                        );
                    }
                );

                messages.scrollTop =
                    messages.scrollHeight;
            },
            function (error) {

                console.error(
                    "メッセージ読み込みエラー:",
                    error
                );
            }
        );
}

function createMessageElement(
    messageId,
    data,
    isMine
) {

    const message =
        document.createElement("div");

    message.className =
        isMine
            ? "message mine"
            : "message other";

    const container =
        document.createElement("div");

    container.className =
        "message-container";

    if (data.deleted) {

        const deleted =
            document.createElement("div");

        deleted.className =
            "deleted-message";

        deleted.textContent =
            "このメッセージは取り消されました";

        container.appendChild(deleted);

        message.appendChild(container);

        messages.appendChild(message);

        return;
    }

    if (data.replyTo) {

        const reply =
            document.createElement("div");

        reply.className =
            "reply-preview";

        reply.textContent =
            data.replyTo.username +
            "： " +
            data.replyTo.text;

        container.appendChild(reply);
    }

    const bubble =
        document.createElement("div");

    bubble.className =
        "bubble";

    bubble.textContent =
        data.text;

    container.appendChild(bubble);

    if (
        data.reactions &&
        Object.keys(data.reactions).length > 0
    ) {

        const reactions =
            document.createElement("div");

        reactions.className =
            "reactions";

        Object.entries(
            data.reactions
        ).forEach(
            function ([emoji, users]) {

                if (
                    users &&
                    users.length > 0
                ) {

                    const reaction =
                        document.createElement("span");

                    reaction.textContent =
                        emoji +
                        " " +
                        users.length;

                    reactions.appendChild(reaction);
                }
            }
        );

        container.appendChild(reactions);
    }

    const actions =
        document.createElement("div");

    actions.className =
        "message-actions";

    const reactionButton =
        createActionButton(
            "😀",
            function () {
                addReaction(
                    messageId,
                    data
                );
            }
        );

    const replyButton =
        createActionButton(
            "↩️",
            function () {
                startReply(
                    messageId,
                    data
                );
            }
        );

    actions.appendChild(
        reactionButton
    );

    actions.appendChild(
        replyButton
    );

    if (isMine) {

        const deleteButton =
            createActionButton(
                "🗑️",
                function () {
                    deleteMessage(
                        messageId
                    );
                }
            );

        actions.appendChild(
            deleteButton
        );
    }

    container.appendChild(actions);

    message.appendChild(container);

    messages.appendChild(message);
}

function createActionButton(
    text,
    action
) {

    const button =
        document.createElement("button");

    button.type =
        "button";

    button.className =
        "action-button";

    button.textContent =
        text;

    button.onclick =
        action;

    return button;
}

async function addReaction(
    messageId,
    data
) {

    const reactions =
        data.reactions
            ? JSON.parse(
                JSON.stringify(
                    data.reactions
                )
            )
            : {};

    const emoji =
        "❤️";

    if (!reactions[emoji]) {
        reactions[emoji] = [];
    }

    if (
        reactions[emoji].includes(username)
    ) {

        reactions[emoji] =
            reactions[emoji].filter(
                function (name) {
                    return name !== username;
                }
            );

    } else {

        reactions[emoji].push(
            username
        );
    }

    try {

        await updateDoc(
            doc(
                db,
                "messages",
                messageId
            ),
            {
                reactions: reactions
            }
        );

    } catch (error) {

        console.error(
            "リアクションエラー:",
            error
        );
    }
}

function startReply(
    messageId,
    data
) {

    replyTarget = {

        id: messageId,

        username:
            data.username,

        text:
            data.text
    };

    replyText.textContent =
        data.username +
        "： " +
        data.text;

    replyBar.classList.remove(
        "hidden"
    );

    input.focus();
}

function cancelReply() {

    replyTarget = null;

    replyBar.classList.add(
        "hidden"
    );

    replyText.textContent = "";
}

cancelReplyButton.onclick =
    cancelReply;

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

        const messageData = {

            text: text,

            username: username,

            receiver:
                selectedFriend,

            createdAt:
                serverTimestamp()
        };

        if (replyTarget) {

            messageData.replyTo = {

                username:
                    replyTarget.username,

                text:
                    replyTarget.text
            };
        }

        await addDoc(
            messagesCollection,
            messageData
        );

        input.value = "";

        cancelReply();

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

sendButton.onclick =
    sendMessage;

input.onkeydown =
    function (event) {

        if (event.key === "Enter") {
            sendMessage();
        }
    };

async function deleteMessage(
    messageId
) {

    const answer =
        confirm(
            "このメッセージを取り消しますか？"
        );

    if (!answer) {
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "messages",
                messageId
            ),
            {
                deleted: true
            }
        );

    } catch (error) {

        console.error(
            "削除エラー:",
            error
        );
    }
}

function showNotification(
    sender,
    text
) {

    if (!("Notification" in window)) {
        return;
    }

    if (
        Notification.permission ===
        "granted"
    ) {

        new Notification(
            sender +
            "からメッセージ",
            {
                body: text,
                icon: "./icons/icon-192.png"
            }
        );
    }
}
