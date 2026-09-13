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
doc,
where,
getDocs,
writeBatch
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
ユーザー情報
========================= */

let username =
localStorage.getItem("yuuchat_username");

if (!username) {

```
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
```

}

/* =========================
DOM
========================= */

const status =
document.getElementById("status");

const myName =
document.getElementById("myName");

const myProfileImage =
document.getElementById("myProfileImage");

const profileImagePlaceholder =
document.getElementById(
"profileImagePlaceholder"
);

const profileImageInput =
document.getElementById(
"profileImageInput"
);

const changeNameButton =
document.getElementById(
"changeNameButton"
);

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

const typingStatus =
document.getElementById(
"typingStatus"
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

myName.textContent =
username;

/* =========================
Collections
========================= */

const friendsCollection =
collection(db, "friends");

const groupsCollection =
collection(db, "groups");

const messagesCollection =
collection(db, "messages");

const usersCollection =
collection(db, "users");

const typingCollection =
collection(db, "typing");

/* =========================
状態
========================= */

let selectedChatType = "";
let selectedFriend = "";
let selectedGroup = null;

let replyTarget = null;

let stopMessages = null;
let stopTyping = null;

let friendsData = [];
let groupsData = [];

let onlineUsers = new Set();

let unreadCounts = {};

let typingTimer = null;

/* =========================
プロフィール画像
========================= */

const savedProfileImage =
localStorage.getItem(
"yuuchat_profile_image"
);

if (savedProfileImage) {

```
myProfileImage.src =
    savedProfileImage;

myProfileImage.style.display =
    "block";

profileImagePlaceholder.style.display =
    "none";
```

}

profileImageInput.onchange =
function (event) {

```
    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith("image/")
    ) {

        alert(
            "画像ファイルを選択してください。"
        );

        return;

    }

    const reader =
        new FileReader();

    reader.onload =
        function () {

            const imageData =
                reader.result;

            localStorage.setItem(
                "yuuchat_profile_image",
                imageData
            );

            myProfileImage.src =
                imageData;

            myProfileImage.style.display =
                "block";

            profileImagePlaceholder.style.display =
                "none";

        };

    reader.readAsDataURL(file);

};
```

/* =========================
プロフィール名変更
========================= */

changeNameButton.onclick =
async function () {

```
    const newName =
        prompt(
            "新しいプロフィール名を入力してください",
            username
        );

    if (!newName) {
        return;
    }

    const trimmedName =
        newName.trim();

    if (
        trimmedName === ""
    ) {
        return;
    }

    if (
        trimmedName === username
    ) {
        return;
    }

    const oldName =
        username;

    try {

        /*
         * 名前変更に合わせて
         * 既存データもできるだけ更新
         */

        const batch =
            writeBatch(db);


        /* 友達 */

        const friendsSnapshot =
            await getDocs(
                friendsCollection
            );

        friendsSnapshot.forEach(
            function (friendDoc) {

                const data =
                    friendDoc.data();

                if (
                    data.owner ===
                    oldName
                ) {

                    batch.update(
                        friendDoc.ref,
                        {
                            owner:
                                trimmedName
                        }
                    );

                }

                if (
                    data.friendName ===
                    oldName
                ) {

                    batch.update(
                        friendDoc.ref,
                        {
                            friendName:
                                trimmedName
                        }
                    );

                }

            }
        );


        /* グループ */

        const groupsSnapshot =
            await getDocs(
                groupsCollection
            );

        groupsSnapshot.forEach(
            function (groupDoc) {

                const data =
                    groupDoc.data();

                const updates = {};

                if (
                    data.owner ===
                    oldName
                ) {

                    updates.owner =
                        trimmedName;

                }

                if (
                    Array.isArray(
                        data.members
                    )
                ) {

                    const members =
                        data.members.map(
                            function (name) {

                                return (
                                    name ===
                                    oldName
                                )
                                    ? trimmedName
                                    : name;

                            }
                        );

                    updates.members =
                        members;

                }

                if (
                    Object.keys(
                        updates
                    ).length > 0
                ) {

                    batch.update(
                        groupDoc.ref,
                        updates
                    );

                }

            }
        );


        /* メッセージ */

        const messagesSnapshot =
            await getDocs(
                messagesCollection
            );

        messagesSnapshot.forEach(
            function (messageDoc) {

                const data =
                    messageDoc.data();

                const updates = {};

                if (
                    data.username ===
                    oldName
                ) {

                    updates.username =
                        trimmedName;

                }

                if (
                    data.receiver ===
                    oldName
                ) {

                    updates.receiver =
                        trimmedName;

                }

                if (
                    Array.isArray(
                        data.readBy
                    )
                ) {

                    updates.readBy =
                        data.readBy.map(
                            function (name) {

                                return (
                                    name ===
                                    oldName
                                )
                                    ? trimmedName
                                    : name;

                            }
                        );

                }

                if (
                    data.replyTo &&
                    data.replyTo.username ===
                    oldName
                ) {

                    updates.replyTo = {

                        ...data.replyTo,

                        username:
                            trimmedName

                    };

                }

                if (
                    Object.keys(
                        updates
                    ).length > 0
                ) {

                    batch.update(
                        messageDoc.ref,
                        updates
                    );

                }

            }
        );


        await batch.commit();


        username =
            trimmedName;

        localStorage.setItem(
            "yuuchat_username",
            username
        );

        myName.textContent =
            username;

        status.textContent =
            "オンライン";

        alert(
            "プロフィール名を変更しました！"
        );

    } catch (error) {

        console.error(
            "名前変更エラー:",
            error
        );

        alert(
            "名前の変更に失敗しました。"
        );

    }

};
```

/* =========================
オンライン状態
========================= */

async function updateOnlineStatus(
isOnline
) {

```
try {

    await updateDoc(
        doc(
            db,
            "users",
            username
        ),
        {
            username:
                username,

            online:
                isOnline,

            lastSeen:
                serverTimestamp()
        }
    );

} catch {

    try {

        await addDoc(
            usersCollection,
            {
                username:
                    username,

                online:
                    isOnline,

                lastSeen:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.error(
            "オンライン状態エラー:",
            error
        );

    }

}
```

}

/*

* ユーザー状態は
* setIntervalで更新
  */

async function setMyOnline() {

```
try {

    await updateDoc(
        doc(
            db,
            "users",
            username
        ),
        {
            online:
                true,

            lastSeen:
                serverTimestamp()
        }
    );

} catch {

    /*
     * 初回作成
     */

    try {

        await importUser();

    } catch (error) {

        console.error(
            "ユーザー作成エラー:",
            error
        );

    }

}
```

}

async function importUser() {

```
/*
 * usersのドキュメントIDを
 * usernameにするため
 * addDocではなく
 * setDocを使う
 */

const {
    setDoc
} = await import(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
);

await setDoc(
    doc(
        db,
        "users",
        username
    ),
    {
        username:
            username,

        online:
            true,

        lastSeen:
            serverTimestamp()
    }
);
```

}

setMyOnline();

setInterval(
setMyOnline,
20000
);

/*

* ページを閉じたり
* 別タブへ移動した時
  */

window.addEventListener(
"beforeunload",
function () {

```
    /*
     * beforeunloadではFirestore通信が
     * 完了しないことがあるので
     * 基本的にはlastSeen方式で判定
     */

}
```

);

/* =========================
オンライン一覧
========================= */

onSnapshot(
usersCollection,
function (snapshot) {

```
    onlineUsers =
        new Set();

    const now =
        Date.now();

    snapshot.forEach(
        function (userDoc) {

            const data =
                userDoc.data();

            if (
                !data.username
            ) {
                return;
            }

            let isOnline =
                data.online === true;

            /*
             * 最終更新から40秒以上なら
             * オフライン扱い
             */

            if (
                data.lastSeen &&
                data.lastSeen.toMillis
            ) {

                const lastSeen =
                    data.lastSeen.toMillis();

                if (
                    now -
                    lastSeen >
                    40000
                ) {

                    isOnline =
                        false;

                }

            }

            if (isOnline) {

                onlineUsers.add(
                    data.username
                );

            }

        }
    );

    renderFriends();

}
```

);

/* =========================
友達追加
========================= */

addFriendButton.onclick =
async function () {

```
    const friendName =
        prompt(
            "追加する友達の名前を入力してください"
        );

    if (!friendName) {
        return;
    }

    const name =
        friendName.trim();

    if (
        name === ""
    ) {
        return;
    }

    if (
        name === username
    ) {

        alert(
            "自分自身は追加できません。"
        );

        return;
    }

    try {

        await addDoc(
            friendsCollection,
            {
                owner:
                    username,

                friendName:
                    name,

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
```

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

```
    friendsData = [];

    snapshot.forEach(
        function (friendDoc) {

            const data =
                friendDoc.data();

            if (
                data.owner !==
                username
            ) {
                return;
            }

            friendsData.push(
                data.friendName
            );

        }
    );

    renderFriends();

},
function (error) {

    console.error(
        "友達一覧エラー:",
        error
    );

}
```

);

/* =========================
友達描画
========================= */

function renderFriends() {

```
friendsList.innerHTML = "";

friendsData.forEach(
    function (friendName) {

        const friend =
            document.createElement(
                "button"
            );

        friend.className =
            "friend";

        friend.type =
            "button";


        const online =
            onlineUsers.has(
                friendName
            );


        friend.innerHTML =
            `
            <span class="${
                online
                    ? "online-dot"
                    : "offline-dot"
            }"></span>
            👤 ${escapeHTML(friendName)}
            `;


        const count =
            unreadCounts[
                "direct_" +
                friendName
            ] || 0;


        if (
            count > 0
        ) {

            const badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "unread-badge";

            badge.textContent =
                count > 99
                    ? "99+"
                    : count;

            friend.appendChild(
                badge
            );

        }


        friend.onclick =
            function () {

                selectFriend(
                    friendName
                );

            };


        friendsList.appendChild(
            friend
        );

    }
);
```

}

/* =========================
グループ作成
========================= */

createGroupButton.onclick =
async function () {

```
    const groupName =
        prompt(
            "グループ名を入力してください"
        );

    if (!groupName) {
        return;
    }

    const name =
        groupName.trim();

    if (
        name === ""
    ) {
        return;
    }

    if (
        friendsData.length === 0
    ) {

        alert(
            "先に友達を追加してください。"
        );

        return;
    }

    const selectedNames =
        prompt(
            "グループに入れる友達を入力してください。\n\n" +
            "複数人の場合は「,」で区切ります。\n\n" +
            "例：Aくん,Bくん"
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
                friendsData.includes(name) &&
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
            "友達の名前を正しく入力してください。"
        );

        return;
    }


    try {

        await addDoc(
            groupsCollection,
            {
                name:
                    name,

                owner:
                    username,

                members:
                    members,

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
```

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

```
    groupsData = [];

    groupsList.innerHTML = "";

    snapshot.forEach(
        function (groupDoc) {

            const data =
                groupDoc.data();

            if (
                !Array.isArray(
                    data.members
                )
            ) {
                return;
            }

            if (
                !data.members.includes(
                    username
                )
            ) {
                return;
            }

            groupsData.push({
                id:
                    groupDoc.id,

                data:
                    data
            });


            const group =
                document.createElement(
                    "button"
                );

            group.className =
                "group";

            group.type =
                "button";

            group.innerHTML =
                `👥 ${escapeHTML(data.name)}`;


            const count =
                unreadCounts[
                    "group_" +
                    groupDoc.id
                ] || 0;


            if (
                count > 0
            ) {

                const badge =
                    document.createElement(
                        "span"
                    );

                badge.className =
                    "unread-badge";

                badge.textContent =
                    count > 99
                        ? "99+"
                        : count;

                group.appendChild(
                    badge
                );

            }


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

}
```

);

/* =========================
友達選択
========================= */

function selectFriend(
friendName
) {

```
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


unreadCounts[
    "direct_" +
    friendName
] = 0;

renderFriends();


cancelReply();

loadMessages();

listenTyping();

input.focus();
```

}

/* =========================
グループ選択
========================= */

function selectGroup(
groupId,
groupData
) {

```
selectedChatType =
    "group";

selectedFriend =
    "";

selectedGroup = {

    id:
        groupId,

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


unreadCounts[
    "group_" +
    groupId
] = 0;

renderFriends();


cancelReply();

loadMessages();

listenTyping();

input.focus();
```

}

/* =========================
メッセージ読み込み
========================= */

function loadMessages() {

```
if (stopMessages) {

    stopMessages();

    stopMessages =
        null;

}


messages.innerHTML = "";


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


            /*
             * 未読数を計算
             */

            const newUnreadCounts = {};


            snapshot.forEach(
                function (messageDoc) {

                    const data =
                        messageDoc.data();


                    let shouldShow =
                        false;

                    let isMine =
                        false;


                    /* 1対1 */

                    if (
                        selectedChatType ===
                        "direct"
                    ) {

                        isMine =
                            data.username ===
                            username &&
                            data.receiver ===
                            selectedFriend;


                        const isFriend =
                            data.username ===
                            selectedFriend &&
                            data.receiver ===
                            username;


                        shouldShow =
                            isMine ||
                            isFriend;


                        if (
                            isFriend &&
                            !(
                                Array.isArray(
                                    data.readBy
                                ) &&
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


                    /* グループ */

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
                                Array.isArray(
                                    data.readBy
                                ) &&
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


            /*
             * 開いているチャットを既読にする
             */

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


                    const target =
                        snapshot.docs.find(
                            function (item) {

                                return (
                                    item.id ===
                                    messageId
                                );

                            }
                        );


                    if (!target) {
                        continue;
                    }


                    const data =
                        target.data();


                    const readBy =
                        Array.isArray(
                            data.readBy
                        )
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


            messages.scrollTop =
                messages.scrollHeight;


            /*
             * 全体の未読数を再計算
             */

            calculateUnreadCounts(
                snapshot
            );

        },
        function (error) {

            console.error(
                "メッセージ読み込みエラー:",
                error
            );

        }
    );
```

}

/* =========================
未読数計算
========================= */

function calculateUnreadCounts(
snapshot
) {

```
unreadCounts = {};


snapshot.forEach(
    function (messageDoc) {

        const data =
            messageDoc.data();


        if (
            data.username ===
            username
        ) {
            return;
        }


        if (
            Array.isArray(
                data.readBy
            ) &&
            data.readBy.includes(
                username
            )
        ) {
            return;
        }


        /*
         * 1対1
         */

        if (
            data.receiver ===
            username &&
            data.username
        ) {

            const key =
                "direct_" +
                data.username;

            unreadCounts[key] =
                (
                    unreadCounts[key] ||
                    0
                ) + 1;

        }


        /*
         * グループ
         */

        if (
            data.chatType ===
            "group" &&
            data.groupId
        ) {

            const key =
                "group_" +
                data.groupId;

            unreadCounts[key] =
                (
                    unreadCounts[key] ||
                    0
                ) + 1;

        }

    }
);


renderFriends();

renderGroupsBadges();
```

}

/* =========================
グループの未読バッジ更新
========================= */

function renderGroupsBadges() {

```
const buttons =
    groupsList.querySelectorAll(
        ".group"
    );


buttons.forEach(
    function (button, index) {

        const group =
            groupsData[index];

        if (!group) {
            return;
        }


        const oldBadge =
            button.querySelector(
                ".unread-badge"
            );


        if (oldBadge) {

            oldBadge.remove();

        }


        const count =
            unreadCounts[
                "group_" +
                group.id
            ] || 0;


        if (
            count > 0
        ) {

            const badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "unread-badge";

            badge.textContent =
                count > 99
                    ? "99+"
                    : count;

            button.appendChild(
                badge
            );

        }

    }
);
```

}

/* =========================
メッセージ表示
========================= */

function createMessageElement(
messageId,
data,
isMine
) {

```
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


/*
 * 返信
 */

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


/*
 * グループ送信者
 */

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


/*
 * 本文
 */

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


/*
 * リアクション
 */

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


/*
 * 送信時刻
 */

const time =
    document.createElement(
        "div"
    );

time.className =
    "message-time";


if (
    data.createdAt &&
    data.createdAt.toDate
) {

    const date =
        data.createdAt.toDate();


    time.textContent =
        "🕐 " +
        date.toLocaleTimeString(
            "ja-JP",
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

} else {

    time.textContent =
        "🕐 送信中";

}


container.appendChild(
    time
);


/*
 * 既読
 */

if (
    isMine &&
    Array.isArray(
        data.readBy
    )
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


/*
 * 操作ボタン
 */

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
```

}

/* =========================
ボタン作成
========================= */

function createActionButton(
text,
action
) {

```
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
```

}

/* =========================
リアクション
========================= */

async function addReaction(
messageId,
data
) {

```
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

    reactions[emoji] =
        [];

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
```

}

/* =========================
返信
========================= */

function startReply(
messageId,
data
) {

```
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
```

}

function cancelReply() {

```
replyTarget =
    null;


replyBar.classList.add(
    "hidden"
);


replyText.textContent =
    "";
```

}

cancelReplyButton.onclick =
cancelReply;

/* =========================
入力中
========================= */

input.addEventListener(
"input",
function () {

```
    if (
        !selectedChatType
    ) {
        return;
    }


    setTyping(
        true
    );


    clearTimeout(
        typingTimer
    );


    typingTimer =
        setTimeout(
            function () {

                setTyping(
                    false
                );

            },
            1800
        );

}
```

);

async function setTyping(
isTyping
) {

```
try {

    const typingId =
        username;


    const {
        setDoc
    } = await import(
        "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
    );


    await setDoc(
        doc(
            db,
            "typing",
            typingId
        ),
        {
            username:
                username,

            typing:
                isTyping,

            chatType:
                selectedChatType,

            friend:
                selectedFriend,

            groupId:
                selectedGroup
                    ? selectedGroup.id
                    : "",

            updatedAt:
                serverTimestamp()
        }
    );

} catch (error) {

    console.error(
        "入力中更新エラー:",
        error
    );

}
```

}

/* =========================
入力中監視
========================= */

function listenTyping() {

```
if (stopTyping) {

    stopTyping();

    stopTyping =
        null;

}


typingStatus.classList.add(
    "hidden"
);


stopTyping =
    onSnapshot(
        typingCollection,
        function (snapshot) {

            let someoneTyping =
                "";


            snapshot.forEach(
                function (typingDoc) {

                    const data =
                        typingDoc.data();


                    if (
                        data.username ===
                        username
                    ) {
                        return;
                    }


                    if (
                        data.typing !==
                        true
                    ) {
                        return;
                    }


                    /*
                     * 1対1
                     */

                    if (
                        selectedChatType ===
                        "direct" &&
                        data.chatType ===
                        "direct" &&
                        data.username ===
                        selectedFriend &&
                        data.friend ===
                        username
                    ) {

                        someoneTyping =
                            data.username;

                    }


                    /*
                     * グループ
                     */

                    if (
                        selectedChatType ===
                        "group" &&
                        selectedGroup &&
                        data.chatType ===
                        "group" &&
                        data.groupId ===
                        selectedGroup.id
                    ) {

                        someoneTyping =
                            data.username;

                    }

                }
            );


            if (
                someoneTyping
            ) {

                typingStatus.textContent =
                    someoneTyping +
                    "が入力中…";


                typingStatus.classList.remove(
                    "hidden"
                );

            } else {

                typingStatus.classList.add(
                    "hidden"
                );

            }

        }
    );
```

}

/* =========================
送信
========================= */

async function sendMessage() {

```
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


    /*
     * 1対1
     */

    if (
        selectedChatType ===
        "direct"
    ) {

        messageData.receiver =
            selectedFriend;

    }


    /*
     * グループ
     */

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


    /*
     * 返信
     */

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


    await setTyping(
        false
    );


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
```

}

sendButton.onclick =
sendMessage;

input.onkeydown =
function (event) {

```
    if (
        event.key ===
        "Enter"
    ) {

        sendMessage();

    }

};
```

/* =========================
送信取り消し
========================= */

async function deleteMessage(
messageId
) {

```
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
```

}

/* =========================
HTMLエスケープ
========================= */

function escapeHTML(
text
) {

```
const div =
    document.createElement(
        "div"
    );

div.textContent =
    text;

return div.innerHTML;
```

}
