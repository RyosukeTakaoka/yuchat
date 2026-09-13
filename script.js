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

let username =
    localStorage.getItem("yuuchat_username");

if (!username) {

    username =
        prompt("あなたの名前を入力してください");

    if (
        !username ||
        username.trim() === ""
    ) {
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
    document.getElementById(
        "addFriendButton"
    );

const createGroupButton =
    document.getElementById(
        "createGroupButton"
    );

const friendsList =
    document.getElementById(
        "friendsList"
    );

const groupsList =
    document.getElementById(
        "groupsList"
    );

const chatHeader =
    document.getElementById(
        "chatHeader"
    );

const messages =
    document.getElementById(
        "messages"
    );

const input =
    document.getElementById(
        "messageInput"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );

const replyBar =
    document.getElementById(
        "replyBar"
    );

const replyText =
    document.getElementById(
        "replyText"
    );

const cancelReplyButton =
    document.getElementById(
        "cancelReplyButton"
    );


status.textContent =
    username +
    "としてオンライン";


/* =========================
   Firestore
========================= */

const friendsCollection =
    collection(db, "friends");

const groupsCollection =
    collection(db, "groups");

const messagesCollection =
    collection(db, "messages");


/* =========================
   現在の状態
========================= */

let selectedChatType = "";

let selectedFriend = "";

let selectedGroup = null;

let replyTarget = null;

let stopMessages = null;


/* =========================
   通知
========================= */

if ("Notification" in window) {

    Notification.requestPermission();

}


/* =========================
   友達追加
========================= */

addFriendButton.onclick =
    async function () {

        const friendName =
            prompt(
                "追加する友達の名前を入力してください"
            );

        if (!friendName) {
            return;
        }

        const name =
            friendName.trim();

        if (name === "") {
            return;
        }

        if (name === username) {

            alert(
                "自分自身は追加できません。"
            );

            return;
        }

        try {

            await addDoc(
                friendsCollection,
                {
                    owner: username,
                    friendName: name,
                    createdAt:
                        serverTimestamp()
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


/* =========================
   友達一覧
========================= */

const friendsQuery =
    query(
        friendsCollection,
        orderBy(
            "createdAt",
            "asc"
        )
    );


onSnapshot(
    friendsQuery,
    function (snapshot) {

        friendsList.innerHTML = "";

        snapshot.forEach(
            function (friendDoc) {

                const data =
                    friendDoc.data();

                if (
                    data.owner !== username
                ) {
                    return;
                }

                const friend =
                    document.createElement(
                        "button"
                    );

                friend.className =
                    "friend";

                friend.type =
                    "button";

                friend.textContent =
                    "👤 " +
                    data.friendName;

                friend.onclick =
                    function () {

                        selectFriend(
                            data.friendName
                        );

                    };

                friendsList.appendChild(
                    friend
                );

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


/* =========================
   グループ作成
========================= */

createGroupButton.onclick =
    async function () {

        const groupName =
            prompt(
                "グループ名を入力してください"
            );

        if (!groupName) {
            return;
        }

        const name =
            groupName.trim();

        if (name === "") {
            return;
        }


        const friendNames = [];

        const friendSnapshot =
            await new Promise(
                function (resolve, reject) {

                    onSnapshot(
                        friendsQuery,
                        function (snapshot) {

                            resolve(snapshot);

                        },
                        function (error) {

                            reject(error);

                        }
                    );

                }
            );


        friendSnapshot.forEach(
            function (friendDoc) {

                const data =
                    friendDoc.data();

                if (
                    data.owner === username &&
                    !friendNames.includes(
                        data.friendName
                    )
                ) {

                    friendNames.push(
                        data.friendName
                    );

                }

            }
        );


        if (
            friendNames.length === 0
        ) {

            alert(
                "先に友達を追加してください。"
            );

            return;
        }


        const selectedNames =
            prompt(
                "グループに入れる友達を入力してください。\n\n" +
                "友達が複数いる場合は「,」で区切ります。\n\n" +
                "例：たかし,しゅうや"
            );


        if (!selectedNames) {
            return;
        }


        const inputNames =
            selectedNames
                .split(",")
                .map(
                    function (name) {
                        return name.trim();
                    }
                )
                .filter(
                    function (name) {
                        return name !== "";
                    }
                );


        const members = [
            username
        ];


        inputNames.forEach(
            function (name) {

                if (
                    friendNames.includes(name) &&
                    !members.includes(name)
                ) {

                    members.push(name);

                }

            }
        );


        if (
            members.length < 2
        ) {

            alert(
                "グループに入れる友達を正しく入力してください。"
            );

            return;
        }


        try {

            await addDoc(
                groupsCollection,
                {
                    name: name,
                    owner: username,
                    members: members,
                    createdAt:
                        serverTimestamp()
                }
            );


            alert(
                "「" +
                name +
                "」グループを作成しました！"
            );

        } catch (error) {

            console.error(
                "グループ作成エラー:",
                error
            );

            alert(
                "グループを作成できませんでした。"
            );

        }

    };


/* =========================
   グループ一覧
========================= */

const groupsQuery =
    query(
        groupsCollection,
        orderBy(
            "createdAt",
            "asc"
        )
    );


onSnapshot(
    groupsQuery,
    function (snapshot) {

        groupsList.innerHTML = "";

        snapshot.forEach(
            function (groupDoc) {

                const data =
                    groupDoc.data();

                if (
                    !data.members ||
                    !data.members.includes(username)
                ) {
                    return;
                }


                const group =
                    document.createElement(
                        "button"
                    );

                group.className =
                    "group";

                group.type =
                    "button";

                group.textContent =
                    "👥 " +
                    data.name;


                group.onclick =
                    function () {

                        selectGroup(
                            groupDoc.id,
                            data
                        );

                    };


                groupsList.appendChild(
                    group
                );

            }
        );

    },
    function (error) {

        console.error(
            "グループ一覧エラー:",
            error
        );

    }
);


/* =========================
   友達を選択
========================= */

function selectFriend(
    friendName
) {

    selectedChatType =
        "direct";

    selectedFriend =
        friendName;

    selectedGroup =
        null;


    chatHeader.textContent =
        "💬 " +
        friendName;


    input.placeholder =
        friendName +
        "にメッセージ";


    input.disabled =
        false;


    sendButton.disabled =
        false;


    cancelReply();


    loadMessages();


    input.focus();

}


/* =========================
   グループを選択
========================= */

function selectGroup(
    groupId,
    groupData
) {

    selectedChatType =
        "group";

    selectedFriend =
        "";

    selectedGroup = {

        id: groupId,

        name:
            groupData.name,

        members:
            groupData.members

    };


    chatHeader.textContent =
        "👥 " +
        groupData.name;


    input.placeholder =
        groupData.name +
        "にメッセージ";


    input.disabled =
        false;


    sendButton.disabled =
        false;


    cancelReply();


    loadMessages();


    input.focus();

}


/* =========================
   メッセージ読み込み
========================= */

function loadMessages() {

    if (stopMessages) {
        stopMessages();
    }


    messages.innerHTML = "";


    if (
        !selectedChatType
    ) {
        return;
    }


    const messagesQuery =
        query(
            messagesCollection,
            orderBy(
                "createdAt",
                "asc"
            )
        );


    stopMessages =
        onSnapshot(
            messagesQuery,
            async function (snapshot) {

                messages.innerHTML = "";


                const unreadMessages = [];


                snapshot.forEach(
                    function (messageDoc) {

                        const data =
                            messageDoc.data();


                        let shouldShow =
                            false;


                        let isMine =
                            false;


                        /* =====
                           1対1
                        ===== */

                        if (
                            selectedChatType ===
                            "direct"
                        ) {

                            isMine =
                                (
                                    data.username ===
                                    username &&
                                    data.receiver ===
                                    selectedFriend
                                );


                            const isFriend =
                                (
                                    data.username ===
                                    selectedFriend &&
                                    data.receiver ===
                                    username
                                );


                            shouldShow =
                                isMine ||
                                isFriend;


                            if (
                                isFriend &&
                                !(
                                    data.readBy &&
                                    data.readBy.includes(
                                        username
                                    )
                                )
                            ) {

                                unreadMessages.push(
                                    messageDoc.id
                                );

                            }

                        }


                        /* =====
                           グループ
                        ===== */

                        if (
                            selectedChatType ===
                            "group" &&
                            selectedGroup
                        ) {

                            shouldShow =
                                data.chatType ===
                                    "group" &&
                                data.groupId ===
                                    selectedGroup.id;


                            isMine =
                                data.username ===
                                username;


                            if (
                                shouldShow &&
                                !isMine &&
                                !(
                                    data.readBy &&
                                    data.readBy.includes(
                                        username
                                    )
                                )
                            ) {

                                unreadMessages.push(
                                    messageDoc.id
                                );

                            }

                        }


                        if (
                            !shouldShow
                        ) {
                            return;
                        }


                        createMessageElement(
                            messageDoc.id,
                            data,
                            isMine
                        );

                    }
                );


                messages.scrollTop =
                    messages.scrollHeight;


                /* =====
                   既読にする
                ===== */

                for (
                    const messageId
                    of unreadMessages
                ) {

                    try {

                        const messageRef =
                            doc(
                                db,
                                "messages",
                                messageId
                            );


                        const messageSnapshot =
                            snapshot.docs.find(
                                function (item) {

                                    return (
                                        item.id ===
                                        messageId
                                    );

                                }
                            );


                        if (
                            !messageSnapshot
                        ) {
                            continue;
                        }


                        const data =
                            messageSnapshot.data();


                        const readBy =
                            data.readBy
                                ? [
                                    ...data.readBy
                                ]
                                : [];


                        if (
                            !readBy.includes(
                                username
                            )
                        ) {

                            readBy.push(
                                username
                            );


                            await updateDoc(
                                messageRef,
                                {
                                    readBy:
                                        readBy
                                }
                            );

                        }

                    } catch (error) {

                        console.error(
                            "既読更新エラー:",
                            error
                        );

                    }

                }

            },
            function (error) {

                console.error(
                    "メッセージ読み込みエラー:",
                    error
                );

            }
        );

}


/* =========================
   メッセージ表示
========================= */

function createMessageElement(
    messageId,
    data,
    isMine
) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        isMine
            ? "message mine"
            : "message other";


    const container =
        document.createElement(
            "div"
        );


    container.className =
        "message-container";


    /* =====================
       削除済み
    ===================== */

    if (
        data.deleted
    ) {

        const deleted =
            document.createElement(
                "div"
            );


        deleted.className =
            "deleted-message";


        deleted.textContent =
            "このメッセージは取り消されました";


        container.appendChild(
            deleted
        );


        message.appendChild(
            container
        );


        messages.appendChild(
            message
        );


        return;

    }


    /* =====================
       返信元
    ===================== */

    if (
        data.replyTo
    ) {

        const reply =
            document.createElement(
                "div"
            );


        reply.className =
            "reply-preview";


        reply.textContent =
            data.replyTo.username +
            "： " +
            data.replyTo.text;


        container.appendChild(
            reply
        );

    }


    /* =====================
       グループ送信者名
    ===================== */

    if (
        selectedChatType ===
            "group" &&
        !isMine
    ) {

        const sender =
            document.createElement(
                "div"
            );


        sender.className =
            "sender-name";


        sender.textContent =
            data.username;


        container.appendChild(
            sender
        );

    }


    /* =====================
       吹き出し
    ===================== */

    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "bubble";


    bubble.textContent =
        data.text;


    container.appendChild(
        bubble
    );


    /* =====================
       リアクション
    ===================== */

    if (
        data.reactions &&
        Object.keys(
            data.reactions
        ).length > 0
    ) {

        const reactions =
            document.createElement(
                "div"
            );


        reactions.className =
            "reactions";


        Object.entries(
            data.reactions
        ).forEach(
            function (
                [emoji, users]
            ) {

                if (
                    users &&
                    users.length > 0
                ) {

                    const reaction =
                        document.createElement(
                            "span"
                        );


                    reaction.textContent =
                        emoji +
                        " " +
                        users.length;


                    reactions.appendChild(
                        reaction
                    );

                }

            }
        );


        container.appendChild(
            reactions
        );

    }


    /* =====================
       既読表示
    ===================== */

    if (
        isMine &&
        data.readBy
    ) {

        if (
            selectedChatType ===
            "direct"
        ) {

            if (
                data.readBy.includes(
                    selectedFriend
                )
            ) {

                const read =
                    document.createElement(
                        "div"
                    );


                read.className =
                    "read-status";


                read.textContent =
                    "既読";


                container.appendChild(
                    read
                );

            }

        }


        if (
            selectedChatType ===
            "group" &&
            selectedGroup
        ) {

            const readCount =
                data.readBy.filter(
                    function (name) {

                        return (
                            name !==
                            username &&
                            selectedGroup.members.includes(
                                name
                            )
                        );

                    }
                ).length;


            const total =
                selectedGroup.members.length -
                1;


            if (
                readCount > 0
            ) {

                const read =
                    document.createElement(
                        "div"
                    );


                read.className =
                    "read-status";


                read.textContent =
                    "既読 " +
                    readCount +
                    "/" +
                    total;


                container.appendChild(
                    read
                );

            }

        }

    }


    /* =====================
       操作ボタン
    ===================== */

    const actions =
        document.createElement(
            "div"
        );


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


    if (
        isMine
    ) {

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


    container.appendChild(
        actions
    );


    message.appendChild(
        container
    );


    messages.appendChild(
        message
    );

}


/* =========================
   操作ボタン
========================= */

function createActionButton(
    text,
    action
) {

    const button =
        document.createElement(
            "button"
        );


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


/* =========================
   リアクション
========================= */

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


    if (
        !reactions[emoji]
    ) {

        reactions[emoji] = [];

    }


    if (
        reactions[emoji].includes(
            username
        )
    ) {

        reactions[emoji] =
            reactions[emoji].filter(
                function (name) {

                    return (
                        name !==
                        username
                    );

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
                reactions:
                    reactions
            }
        );

    } catch (error) {

        console.error(
            "リアクションエラー:",
            error
        );

    }

}


/* =========================
   返信
========================= */

function startReply(
    messageId,
    data
) {

    replyTarget = {

        id:
            messageId,

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


/* =========================
   返信キャンセル
========================= */

function cancelReply() {

    replyTarget =
        null;


    replyBar.classList.add(
        "hidden"
    );


    replyText.textContent =
        "";

}


cancelReplyButton.onclick =
    cancelReply;


/* =========================
   メッセージ送信
========================= */

async function sendMessage() {

    const text =
        input.value.trim();


    if (
        text === ""
    ) {
        return;
    }


    if (
        !selectedChatType
    ) {

        alert(
            "先に友達またはグループを選択してください。"
        );

        return;

    }


    try {

        let messageData = {

            text:
                text,

            username:
                username,

            createdAt:
                serverTimestamp(),

            readBy:
                [
                    username
                ]

        };


        /* =====================
           1対1
        ===================== */

        if (
            selectedChatType ===
            "direct"
        ) {

            messageData.receiver =
                selectedFriend;

        }


        /* =====================
           グループ
        ===================== */

        if (
            selectedChatType ===
            "group"
        ) {

            messageData.chatType =
                "group";

            messageData.groupId =
                selectedGroup.id;

            messageData.groupName =
                selectedGroup.name;

            messageData.members =
                selectedGroup.members;

        }


        /* =====================
           返信
        ===================== */

        if (
            replyTarget
        ) {

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


        input.value =
            "";


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


/* =========================
   送信ボタン
========================= */

sendButton.onclick =
    sendMessage;


/* =========================
   Enter
========================= */

input.onkeydown =
    function (event) {

        if (
            event.key ===
            "Enter"
        ) {

            sendMessage();

        }

    };


/* =========================
   送信取り消し
========================= */

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
                deleted:
                    true
            }
        );

    } catch (error) {

        console.error(
            "削除エラー:",
            error
        );

    }

}


/* =========================
   通知
========================= */

function showNotification(
    sender,
    text
) {

    if (
        !("Notification" in window)
    ) {

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
                body:
                    text,

                icon:
                    "./icons/icon-192.png"
            }
        );

    }

}
