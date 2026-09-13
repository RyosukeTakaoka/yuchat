import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


/* =========================
   Firebase
========================= */

const firebaseConfig = {
    apiKey: "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw",
    authDomain: "yuuchat-be666.firebaseapp.com",
    projectId: "yuuchat-be666",
    storageBucket: "yuuchat-be666.firebasestorage.app",
    messagingSenderId: "89509274877",
    appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();


/* =========================
   ログイン画面
========================= */

const loginScreen =
    document.getElementById("loginScreen");

const nameScreen =
    document.getElementById("nameScreen");

const appScreen =
    document.getElementById("app");

const googleLoginButton =
    document.getElementById(
        "googleLoginButton"
    );

const guestLoginButton =
    document.getElementById(
        "guestLoginButton"
    );

const startChatButton =
    document.getElementById(
        "startChatButton"
    );

const nameInput =
    document.getElementById(
        "nameInput"
    );

const loginError =
    document.getElementById(
        "loginError"
    );

const nameError =
    document.getElementById(
        "nameError"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


/* =========================
   アプリHTML
========================= */

const myName =
    document.getElementById("myName");

const status =
    document.getElementById("status");

const changeNameButton =
    document.getElementById(
        "changeNameButton"
    );

const profileImageInput =
    document.getElementById(
        "profileImageInput"
    );

const myProfileImage =
    document.getElementById(
        "myProfileImage"
    );

const profileImagePlaceholder =
    document.getElementById(
        "profileImagePlaceholder"
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

const messages =
    document.getElementById(
        "messages"
    );

const messageInput =
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


/* =========================
   変数
========================= */

let username = "";

let currentUser = null;

let friendsData = [];

let groupsData = [];

let selectedChat = null;

let selectedChatType = null;

let stopMessagesListener = null;

let replyTarget = null;

let allMessages = [];


/* =========================
   ログイン状態監視
========================= */

onAuthStateChanged(
    auth,
    async user => {

        currentUser = user;


        if (!user) {

            showLoginScreen();

            return;
        }


        /*
         * Googleログインの場合
         */

        if (
            user.providerData.some(
                provider =>
                    provider.providerId ===
                    "google.com"
            )
        ) {

            let savedName =
                localStorage.getItem(
                    "yuuchat_username"
                );


            if (!savedName) {

                savedName =
                    user.displayName ||
                    "ゆうた";

                localStorage.setItem(
                    "yuuchat_username",
                    savedName
                );
            }


            username =
                savedName;

            startApp();

            return;
        }


        /*
         * ゲストの場合
         */

        const savedName =
            localStorage.getItem(
                "yuuchat_username"
            );


        if (savedName) {

            username =
                savedName;

            startApp();

        } else {

            showNameScreen();
        }
    }
);


/* =========================
   Googleログイン
========================= */

googleLoginButton.addEventListener(
    "click",
    async () => {

        loginError.textContent = "";

        googleLoginButton.disabled = true;

        try {

            await signInWithPopup(
                auth,
                googleProvider
            );

        } catch (error) {

            console.error(error);

            loginError.textContent =
                "Googleログインに失敗しました。もう一度試してください。";

            googleLoginButton.disabled =
                false;
        }
    }
);


/* =========================
   ゲストログイン
========================= */

guestLoginButton.addEventListener(
    "click",
    async () => {

        loginError.textContent = "";

        guestLoginButton.disabled = true;

        try {

            await signInAnonymously(
                auth
            );

        } catch (error) {

            console.error(error);

            loginError.textContent =
                "ゲストログインに失敗しました。";

            guestLoginButton.disabled =
                false;
        }
    }
);


/* =========================
   名前設定
========================= */

startChatButton.addEventListener(
    "click",
    () => {

        nameError.textContent = "";

        const name =
            nameInput.value.trim();


        if (!name) {

            nameError.textContent =
                "名前を入力してください。";

            return;
        }


        if (name.length > 20) {

            nameError.textContent =
                "名前は20文字以内にしてください。";

            return;
        }


        username =
            name;

        localStorage.setItem(
            "yuuchat_username",
            username
        );


        startApp();
    }
);


/* =========================
   画面切り替え
========================= */

function showLoginScreen() {

    loginScreen.classList.remove(
        "hidden"
    );

    nameScreen.classList.add(
        "hidden"
    );

    appScreen.classList.add(
        "hidden"
    );
}


function showNameScreen() {

    loginScreen.classList.add(
        "hidden"
    );

    nameScreen.classList.remove(
        "hidden"
    );

    appScreen.classList.add(
        "hidden"
    );
}


function startApp() {

    loginScreen.classList.add(
        "hidden"
    );

    nameScreen.classList.add(
        "hidden"
    );

    appScreen.classList.remove(
        "hidden"
    );


    myName.textContent =
        username;

    status.textContent =
        "🟢 オンライン";


    loadProfileImage();

    updateOnline();

    listenFriends();

    listenGroups();

    listenAllMessages();
}


/* =========================
   ログアウト
========================= */

logoutButton.addEventListener(
    "click",
    async () => {

        const ok =
            confirm(
                "ログアウトしますか？"
            );

        if (!ok) return;


        try {

            if (
                stopMessagesListener
            ) {

                stopMessagesListener();

                stopMessagesListener =
                    null;
            }


            await signOut(auth);

        } catch (error) {

            console.error(error);

            alert(
                "ログアウトに失敗しました。"
            );
        }
    }
);


/* =========================
   プロフィール画像
========================= */

function getProfileImageKey() {

    if (!currentUser) {

        return "yuuchat_profile_image";
    }

    return (
        "yuuchat_profile_image_" +
        currentUser.uid
    );
}


function loadProfileImage() {

    const saved =
        localStorage.getItem(
            getProfileImageKey()
        );


    if (saved) {

        myProfileImage.src =
            saved;

        myProfileImage.style.display =
            "block";

        profileImagePlaceholder.style.display =
            "none";

    } else {

        myProfileImage.style.display =
            "none";

        profileImagePlaceholder.style.display =
            "block";
    }
}


profileImageInput.addEventListener(
    "change",
    () => {

        const file =
            profileImageInput.files[0];

        if (!file) return;


        const reader =
            new FileReader();


        reader.onload = () => {

            const imageData =
                reader.result;


            localStorage.setItem(
                getProfileImageKey(),
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
    }
);


/* =========================
   名前変更
========================= */

changeNameButton.addEventListener(
    "click",
    async () => {

        const oldName =
            username;


        const newName =
            prompt(
                "新しい名前を入力してください",
                username
            );


        if (!newName) return;


        const trimmed =
            newName.trim();


        if (!trimmed) return;


        if (
            trimmed === oldName
        ) {

            return;
        }


        if (
            trimmed.length > 20
        ) {

            alert(
                "名前は20文字以内にしてください。"
            );

            return;
        }


        try {

            await renameUser(
                oldName,
                trimmed
            );


            username =
                trimmed;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            myName.textContent =
                username;


            alert(
                "名前を変更しました"
            );

        } catch (error) {

            console.error(error);

            alert(
                "名前変更に失敗しました。"
            );
        }
    }
);


/* =========================
   名前変更処理
========================= */

async function renameUser(
    oldName,
    newName
) {

    const batch =
        writeBatch(db);


    const friendsSnapshot =
        await getDocs(
            collection(
                db,
                "friends"
            )
        );


    friendsSnapshot.forEach(
        friendDoc => {

            const data =
                friendDoc.data();

            const updateData = {};

            let changed = false;


            if (
                data.owner ===
                oldName
            ) {

                updateData.owner =
                    newName;

                changed = true;
            }


            if (
                data.friendName ===
                oldName
            ) {

                updateData.friendName =
                    newName;

                changed = true;
            }


            if (changed) {

                batch.update(
                    doc(
                        db,
                        "friends",
                        friendDoc.id
                    ),
                    updateData
                );
            }
        }
    );


    const groupsSnapshot =
        await getDocs(
            collection(
                db,
                "groups"
            )
        );


    groupsSnapshot.forEach(
        groupDoc => {

            const data =
                groupDoc.data();


            let changed = false;


            let members =
                Array.isArray(
                    data.members
                )
                    ? [...data.members]
                    : [];


            members =
                members.map(
                    member => {

                        if (
                            member ===
                            oldName
                        ) {

                            changed = true;

                            return newName;
                        }

                        return member;
                    }
                );


            const updateData = {};


            if (
                data.owner ===
                oldName
            ) {

                updateData.owner =
                    newName;

                changed = true;
            }


            if (changed) {

                updateData.members =
                    members;


                batch.update(
                    doc(
                        db,
                        "groups",
                        groupDoc.id
                    ),
                    updateData
                );
            }
        }
    );


    const messagesSnapshot =
        await getDocs(
            collection(
                db,
                "messages"
            )
        );


    messagesSnapshot.forEach(
        messageDoc => {

            const data =
                messageDoc.data();


            const updateData = {};

            let changed = false;


            if (
                data.username ===
                oldName
            ) {

                updateData.username =
                    newName;

                changed = true;
            }


            if (
                data.receiver ===
                oldName
            ) {

                updateData.receiver =
                    newName;

                changed = true;
            }


            if (
                data.replyTo &&
                data.replyTo.username ===
                oldName
            ) {

                updateData.replyTo = {
                    ...data.replyTo,
                    username:
                        newName
                };

                changed = true;
            }


            if (
                Array.isArray(
                    data.readBy
                )
            ) {

                const newReadBy =
                    data.readBy.map(
                        name =>
                            name ===
                            oldName
                                ? newName
                                : name
                    );


                if (
                    JSON.stringify(
                        newReadBy
                    ) !==
                    JSON.stringify(
                        data.readBy
                    )
                ) {

                    updateData.readBy =
                        newReadBy;

                    changed = true;
                }
            }


            if (changed) {

                batch.update(
                    doc(
                        db,
                        "messages",
                        messageDoc.id
                    ),
                    updateData
                );
            }
        }
    );


    await batch.commit();
}


/* =========================
   オンライン状態
========================= */

async function updateOnline() {

    if (!username) return;


    try {

        await setDoc(
            doc(
                db,
                "users",
                username
            ),
            {
                username,
                online: true,
                lastSeen:
                    serverTimestamp(),

                uid:
                    currentUser
                        ? currentUser.uid
                        : null
            },
            {
                merge: true
            }
        );

    } catch (error) {

        console.error(
            "online error",
            error
        );
    }
}


setTimeout(
    updateOnline,
    500
);


setInterval(
    updateOnline,
    20000
);


/* =========================
   友達一覧
========================= */

function listenFriends() {

    const q =
        query(
            collection(
                db,
                "friends"
            ),
            where(
                "owner",
                "==",
                username
            )
        );


    onSnapshot(
        q,
        snapshot => {

            friendsData = [];


            snapshot.forEach(
                friendDoc => {

                    friendsData.push({
                        id:
                            friendDoc.id,

                        ...friendDoc.data()
                    });
                }
            );


            renderFriends();
        }
    );
}


/* =========================
   グループ一覧
========================= */

function listenGroups() {

    const q =
        query(
            collection(
                db,
                "groups"
            ),
            where(
                "members",
                "array-contains",
                username
            )
        );


    onSnapshot(
        q,
        snapshot => {

            groupsData = [];


            snapshot.forEach(
                groupDoc => {

                    groupsData.push({
                        id:
                            groupDoc.id,

                        ...groupDoc.data()
                    });
                }
            );


            renderGroups();
        }
    );
}


/* =========================
   全メッセージ
========================= */

function listenAllMessages() {

    const q =
        query(
            collection(
                db,
                "messages"
            ),
            orderBy(
                "createdAt",
                "asc"
            )
        );


    onSnapshot(
        q,
        snapshot => {

            allMessages = [];


            snapshot.forEach(
                messageDoc => {

                    allMessages.push({
                        id:
                            messageDoc.id,

                        ...messageDoc.data()
                    });
                }
            );


            renderFriends();

            renderGroups();


            if (
                selectedChat
            ) {

                renderCurrentMessages();
            }
        }
    );
}


/* =========================
   未読数
========================= */

function getUnreadCountForFriend(
    friendName
) {

    return allMessages.filter(
        message => {

            if (
                message.username ===
                username
            ) {
                return false;
            }


            if (
                message.receiver !==
                username
            ) {
                return false;
            }


            if (
                message.username !==
                friendName
            ) {
                return false;
            }


            if (
                Array.isArray(
                    message.readBy
                ) &&
                message.readBy.includes(
                    username
                )
            ) {

                return false;
            }


            return true;
        }
    ).length;
}


function getUnreadCountForGroup(
    groupId
) {

    return allMessages.filter(
        message => {

            if (
                message.chatType !==
                "group"
            ) {
                return false;
            }


            if (
                message.chatId !==
                groupId
            ) {
                return false;
            }


            if (
                message.username ===
                username
            ) {
                return false;
            }


            if (
                Array.isArray(
                    message.readBy
                ) &&
                message.readBy.includes(
                    username
                )
            ) {

                return false;
            }


            return true;
        }
    ).length;
}


/* =========================
   友達表示
========================= */

function renderFriends() {

    friendsList.innerHTML = "";


    if (
        friendsData.length ===
        0
    ) {

        friendsList.innerHTML =
            `
            <div style="
                color:#aaa;
                font-size:12px;
                padding:5px;
            ">
                友達を追加してください
            </div>
            `;

        return;
    }


    friendsData.forEach(
        friend => {

            const item =
                document.createElement(
                    "button"
                );


            item.className =
                "friend-item";


            if (
                selectedChatType ===
                    "friend" &&
                selectedChat ===
                    friend.friendName
            ) {

                item.classList.add(
                    "active"
                );
            }


            const dot =
                document.createElement(
                    "span"
                );


            dot.className =
                "offline-dot";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "friend-name";


            name.textContent =
                friend.friendName;


            item.appendChild(dot);

            item.appendChild(name);


            const unread =
                getUnreadCountForFriend(
                    friend.friendName
                );


            if (
                unread > 0
            ) {

                const badge =
                    document.createElement(
                        "span"
                    );


                badge.className =
                    "unread-badge";


                badge.textContent =
                    unread > 99
                        ? "99+"
                        : unread;


                item.appendChild(
                    badge
                );
            }


            item.addEventListener(
                "click",
                () => {

                    selectFriend(
                        friend.friendName
                    );
                }
            );


            friendsList.appendChild(
                item
            );
        }
    );
}


/* =========================
   グループ表示
========================= */

function renderGroups() {

    groupsList.innerHTML = "";


    if (
        groupsData.length ===
        0
    ) {

        groupsList.innerHTML =
            `
            <div style="
                color:#aaa;
                font-size:12px;
                padding:5px;
            ">
                グループはありません
            </div>
            `;

        return;
    }


    groupsData.forEach(
        group => {

            const item =
                document.createElement(
                    "button"
                );


            item.className =
                "group-item";


            if (
                selectedChatType ===
                    "group" &&
                selectedChat ===
                    group.id
            ) {

                item.classList.add(
                    "active"
                );
            }


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "group-name";


            name.textContent =
                "👥 " +
                group.name;


            item.appendChild(name);


            const unread =
                getUnreadCountForGroup(
                    group.id
                );


            if (
                unread > 0
            ) {

                const badge =
                    document.createElement(
                        "span"
                    );


                badge.className =
                    "unread-badge";


                badge.textContent =
                    unread > 99
                        ? "99+"
                        : unread;


                item.appendChild(
                    badge
                );
            }


            item.addEventListener(
                "click",
                () => {

                    selectGroup(
                        group.id
                    );
                }
            );


            groupsList.appendChild(
                item
            );
        }
    );
}


/* =========================
   友達追加
========================= */

addFriendButton.addEventListener(
    "click",
    async () => {

        const friendName =
            prompt(
                "追加する友達の名前を入力してください"
            );


        if (!friendName) return;


        const trimmed =
            friendName.trim();


        if (!trimmed) return;


        if (
            trimmed === username
        ) {

            alert(
                "自分自身は追加できません"
            );

            return;
        }


        const q =
            query(
                collection(
                    db,
                    "friends"
                ),
                where(
                    "owner",
                    "==",
                    username
                ),
                where(
                    "friendName",
                    "==",
                    trimmed
                )
            );


        const result =
            await getDocs(q);


        if (
            !result.empty
        ) {

            alert(
                "すでに追加されています"
            );

            return;
        }


        await addDoc(
            collection(
                db,
                "friends"
            ),
            {
                owner:
                    username,

                friendName:
                    trimmed,

                createdAt:
                    serverTimestamp()
            }
        );


        alert(
            trimmed +
            " さんを追加しました"
        );
    }
);


/* =========================
   グループ作成
========================= */

createGroupButton.addEventListener(
    "click",
    async () => {

        if (
            friendsData.length ===
            0
        ) {

            alert(
                "先に友達を追加してください"
            );

            return;
        }


        const groupName =
            prompt(
                "グループ名を入力してください"
            );


        if (!groupName) return;


        const membersInput =
            prompt(
                "メンバー名をカンマ区切りで入力してください\n例：たかし,ゆうき"
            );


        if (!membersInput) return;


        const names =
            membersInput
                .split(",")
                .map(
                    name =>
                        name.trim()
                )
                .filter(
                    name =>
                        name.length > 0
                );


        const members =
            [
                username,
                ...names
            ];


        const uniqueMembers =
            [
                ...new Set(
                    members
                )
            ];


        await addDoc(
            collection(
                db,
                "groups"
            ),
            {
                name:
                    groupName.trim(),

                owner:
                    username,

                members:
                    uniqueMembers,

                createdAt:
                    serverTimestamp()
            }
        );


        alert(
            "グループを作成しました"
        );
    }
);


/* =========================
   友達チャット
========================= */

function selectFriend(
    friendName
) {

    selectedChat =
        friendName;

    selectedChatType =
        "friend";


    chatHeader.textContent =
        friendName;


    messageInput.disabled =
        false;

    sendButton.disabled =
        false;


    messageInput.placeholder =
        "メッセージを入力...";


    cancelReply();


    listenMessages();


    markFriendMessagesAsRead(
        friendName
    );


    renderFriends();

    renderGroups();
}


/* =========================
   グループチャット
========================= */

function selectGroup(
    groupId
) {

    const group =
        groupsData.find(
            g =>
                g.id ===
                groupId
        );


    if (!group) return;


    selectedChat =
        groupId;

    selectedChatType =
        "group";


    chatHeader.textContent =
        "👥 " +
        group.name;


    messageInput.disabled =
        false;

    sendButton.disabled =
        false;


    messageInput.placeholder =
        "グループにメッセージ...";


    cancelReply();


    listenMessages();


    markGroupMessagesAsRead(
        groupId
    );


    renderFriends();

    renderGroups();
}


/* =========================
   メッセージ監視
========================= */

function listenMessages() {

    if (
        stopMessagesListener
    ) {

        stopMessagesListener();

        stopMessagesListener =
            null;
    }


    const q =
        query(
            collection(
                db,
                "messages"
            ),
            orderBy(
                "createdAt",
                "asc"
            )
        );


    stopMessagesListener =
        onSnapshot(
            q,
            snapshot => {

                const list = [];


                snapshot.forEach(
                    messageDoc => {

                        const data =
                            messageDoc.data();


                        if (
                            selectedChatType ===
                            "friend"
                        ) {

                            const isFriendMessage =
                                (
                                    data.chatType !==
                                    "group"
                                ) &&
                                (
                                    (
                                        data.username ===
                                        username &&
                                        data.receiver ===
                                        selectedChat
                                    ) ||
                                    (
                                        data.username ===
                                        selectedChat &&
                                        data.receiver ===
                                        username
                                    )
                                );


                            if (
                                isFriendMessage
                            ) {

                                list.push({
                                    id:
                                        messageDoc.id,

                                    ...data
                                });
                            }
                        }


                        if (
                            selectedChatType ===
                            "group"
                        ) {

                            if (
                                data.chatType ===
                                    "group" &&
                                data.chatId ===
                                    selectedChat
                            ) {

                                list.push({
                                    id:
                                        messageDoc.id,

                                    ...data
                                });
                            }
                        }
                    }
                );


                renderMessages(
                    list
                );
            }
        );
}


/* =========================
   メッセージ表示
========================= */

function renderMessages(
    list
) {

    messages.innerHTML = "";


    list.forEach(
        message => {

            const row =
                document.createElement(
                    "div"
                );


            const mine =
                message.username ===
                username;


            row.className =
                "message-row " +
                (
                    mine
                        ? "mine"
                        : "other"
                );


            if (
                !mine &&
                selectedChatType ===
                    "group"
            ) {

                const user =
                    document.createElement(
                        "div"
                    );


                user.className =
                    "message-user";


                user.textContent =
                    message.username;


                row.appendChild(
                    user
                );
            }


            const bubble =
                document.createElement(
                    "div"
                );


            bubble.className =
                "message-bubble";


            if (
                message.deleted
            ) {

                bubble.classList.add(
                    "deleted-message"
                );


                bubble.textContent =
                    "このメッセージは取り消されました";

            } else {

                if (
                    message.replyTo
                ) {

                    const reply =
                        document.createElement(
                            "div"
                        );


                    reply.style.fontSize =
                        "11px";


                    reply.style.opacity =
                        "0.7";


                    reply.style.marginBottom =
                        "5px";


                    reply.textContent =
                        "↩️ " +
                        message.replyTo.username +
                        ": " +
                        message.replyTo.text;


                    bubble.appendChild(
                        reply
                    );
                }


                const text =
                    document.createElement(
                        "div"
                    );


                text.textContent =
                    message.text;


                bubble.appendChild(
                    text
                );
            }


            row.appendChild(
                bubble
            );


            const time =
                document.createElement(
                    "div"
                );


            time.className =
                "message-time";


            time.textContent =
                formatTime(
                    message.createdAt
                );


            row.appendChild(
                time
            );


            if (
                message.reaction
            ) {

                const reactionArea =
                    document.createElement(
                        "div"
                    );


                reactionArea.className =
                    "reaction-area";


                const reaction =
                    document.createElement(
                        "span"
                    );


                reaction.className =
                    "reaction";


                reaction.textContent =
                    message.reaction;


                reactionArea.appendChild(
                    reaction
                );


                row.appendChild(
                    reactionArea
                );
            }


            if (
                !message.deleted
            ) {

                const actions =
                    document.createElement(
                        "div"
                    );


                actions.className =
                    "message-actions";


                const replyButton =
                    document.createElement(
                        "button"
                    );


                replyButton.textContent =
                    "↩️ 返信";


                replyButton.addEventListener(
                    "click",
                    () => {

                        startReply(
                            message
                        );
                    }
                );


                actions.appendChild(
                    replyButton
                );


                const reactionButton =
                    document.createElement(
                        "button"
                    );


                reactionButton.textContent =
                    "❤️";


                reactionButton.addEventListener(
                    "click",
                    () => {

                        addReaction(
                            message.id,
                            "❤️"
                        );
                    }
                );


                actions.appendChild(
                    reactionButton
                );


                if (mine) {

                    const deleteButton =
                        document.createElement(
                            "button"
                        );


                    deleteButton.textContent =
                        "送信取り消し";


                    deleteButton.addEventListener(
                        "click",
                        () => {

                            deleteMessage(
                                message.id
                            );
                        }
                    );


                    actions.appendChild(
                        deleteButton
                    );
                }


                row.appendChild(
                    actions
                );
            }


            messages.appendChild(
                row
            );
        }
    );


    messages.scrollTop =
        messages.scrollHeight;
}


/* =========================
   時刻
========================= */

function formatTime(
    timestamp
) {

    if (
        !timestamp ||
        !timestamp.toDate
    ) {

        return "";
    }


    const date =
        timestamp.toDate();


    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        );


    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        );


    return (
        hours +
        ":" +
        minutes
    );
}


/* =========================
   送信
========================= */

sendButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            sendMessage();
        }
    }
);


async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) return;

    if (!selectedChat) return;


    const data = {

        username,

        text,

        createdAt:
            serverTimestamp(),

        readBy:
            [username]
    };


    if (
        selectedChatType ===
        "friend"
    ) {

        data.receiver =
            selectedChat;

        data.chatType =
            "friend";
    }


    if (
        selectedChatType ===
        "group"
    ) {

        data.chatType =
            "group";

        data.chatId =
            selectedChat;
    }


    if (replyTarget) {

        data.replyTo = {

            username:
                replyTarget.username,

            text:
                replyTarget.text
        };
    }


    await addDoc(
        collection(
            db,
            "messages"
        ),
        data
    );


    messageInput.value =
        "";


    cancelReply();
}


/* =========================
   返信
========================= */

function startReply(
    message
) {

    replyTarget =
        message;


    replyText.textContent =
        message.text;


    replyBar.classList.remove(
        "hidden"
    );


    messageInput.focus();
}


function cancelReply() {

    replyTarget =
        null;


    replyBar.classList.add(
        "hidden"
    );


    replyText.textContent =
        "";
}


cancelReplyButton.addEventListener(
    "click",
    cancelReply
);


/* =========================
   リアクション
========================= */

async function addReaction(
    messageId,
    reaction
) {

    await updateDoc(
        doc(
            db,
            "messages",
            messageId
        ),
        {
            reaction
        }
    );
}


/* =========================
   送信取り消し
========================= */

async function deleteMessage(
    messageId
) {

    const ok =
        confirm(
            "このメッセージを取り消しますか？"
        );


    if (!ok) return;


    await updateDoc(
        doc(
            db,
            "messages",
            messageId
        ),
        {
            deleted:
                true,

            text:
                ""
        }
    );
}


/* =========================
   既読
========================= */

async function markFriendMessagesAsRead(
    friendName
) {

    const q =
        query(
            collection(
                db,
                "messages"
            ),
            where(
                "username",
                "==",
                friendName
            ),
            where(
                "receiver",
                "==",
                username
            )
        );


    const snapshot =
        await getDocs(q);


    const batch =
        writeBatch(db);


    snapshot.forEach(
        messageDoc => {

            const data =
                messageDoc.data();


            const readBy =
                Array.isArray(
                    data.readBy
                )
                    ? [...data.readBy]
                    : [];


            if (
                !readBy.includes(
                    username
                )
            ) {

                readBy.push(
                    username
                );


                batch.update(
                    doc(
                        db,
                        "messages",
                        messageDoc.id
                    ),
                    {
                        readBy
                    }
                );
            }
        }
    );


    await batch.commit();
}


async function markGroupMessagesAsRead(
    groupId
) {

    const q =
        query(
            collection(
                db,
                "messages"
            ),
            where(
                "chatType",
                "==",
                "group"
            ),
            where(
                "chatId",
                "==",
                groupId
            )
        );


    const snapshot =
        await getDocs(q);


    const batch =
        writeBatch(db);


    snapshot.forEach(
        messageDoc => {

            const data =
                messageDoc.data();


            const readBy =
                Array.isArray(
                    data.readBy
                )
                    ? [...data.readBy]
                    : [];


            if (
                !readBy.includes(
                    username
                )
            ) {

                readBy.push(
                    username
                );


                batch.update(
                    doc(
                        db,
                        "messages",
                        messageDoc.id
                    ),
                    {
                        readBy
                    }
                );
            }
        }
    );


    await batch.commit();
}


/* =========================
   現在のチャット再表示
========================= */

function renderCurrentMessages() {

    if (!selectedChat) return;


    const list =
        allMessages.filter(
            message => {

                if (
                    selectedChatType ===
                    "friend"
                ) {

                    return (
                        message.chatType !==
                            "group" &&
                        (
                            (
                                message.username ===
                                username &&
                                message.receiver ===
                                selectedChat
                            ) ||
                            (
                                message.username ===
                                selectedChat &&
                                message.receiver ===
                                username
                            )
                        )
                    );
                }


                if (
                    selectedChatType ===
                    "group"
                ) {

                    return (
                        message.chatType ===
                            "group" &&
                        message.chatId ===
                            selectedChat
                    );
                }


                return false;
            }
        );


    renderMessages(
        list
    );
}
