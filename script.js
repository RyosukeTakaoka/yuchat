import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
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


// ==================================================
// Firebase Cloud Messaging
// ==================================================

import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";


// ==================================================
// Firebase
// ==================================================

const firebaseConfig = {
    apiKey: "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw",
    authDomain: "yuuchat-be666.firebaseapp.com",
    projectId: "yuuchat-be666",
    storageBucket: "yuuchat-be666.firebasestorage.app",
    messagingSenderId: "89509274877",
    appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};

const firebaseApp =
    initializeApp(firebaseConfig);

const db =
    getFirestore(firebaseApp);

const auth =
    getAuth(firebaseApp);


// ==================================================
// Firebase Cloud Messaging
// ==================================================

const messaging =
    getMessaging(firebaseApp);


// ==================================================
// Web Push 公開鍵
// ==================================================
//
// Firebase Console
// ↓
// Cloud Messaging
// ↓
// Web Push 証明書
// ↓
// 鍵ペア
//
// あとでここに公開鍵を入れる。
// 今はそのままでOK。
// ==================================================

const VAPID_KEY =
    "ここにFirebaseのWeb Push公開鍵を入れる";


// ==================================================
// 通知の状態
// ==================================================

let notificationToken =
    null;

let notificationInitialized =
    false;


// ==================================================
// アプリの状態
// ==================================================

let currentUser = null;

let username = null;

let friendsData = [];

let groupsData = [];

let selectedChat = null;

let selectedChatType = null;

let selectedFriendshipId = null;

let replyingMessage = null;

let unsubscribeFriends = null;

let unsubscribeGroups = null;

let unsubscribeMessages = null;

let unsubscribeAllMessages = null;


// ==================================================
// HTML取得
// ==================================================

const loginScreen =
    document.getElementById("loginScreen");

const nameScreen =
    document.getElementById("nameScreen");

const appElement =
    document.getElementById("app");

const googleLoginButton =
    document.getElementById("googleLoginButton");

const guestLoginButton =
    document.getElementById("guestLoginButton");

const nameInput =
    document.getElementById("nameInput");

const startChatButton =
    document.getElementById("startChatButton");

const loginError =
    document.getElementById("loginError");

const nameError =
    document.getElementById("nameError");

const myName =
    document.getElementById("myName");

const statusElement =
    document.getElementById("status");

const friendsList =
    document.getElementById("friendsList");

const groupsList =
    document.getElementById("groupsList");

const addFriendButton =
    document.getElementById("addFriendButton");

const createGroupButton =
    document.getElementById("createGroupButton");

const logoutButton =
    document.getElementById("logoutButton");

const chatHeader =
    document.getElementById("chatHeader");

const messagesElement =
    document.getElementById("messages");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const replyBar =
    document.getElementById("replyBar");

const replyText =
    document.getElementById("replyText");

const cancelReplyButton =
    document.getElementById("cancelReplyButton");

const profileImageInput =
    document.getElementById("profileImageInput");

const myProfileImage =
    document.getElementById("myProfileImage");

const profileImagePlaceholder =
    document.getElementById("profileImagePlaceholder");

const changeNameButton =
    document.getElementById("changeNameButton");


// ==================================================
// 通知機能
// ==================================================

async function initializeNotifications() {

    if (
        notificationInitialized ||
        !currentUser
    ) {
        return;
    }


    notificationInitialized =
        true;


    if (
        !("Notification" in window)
    ) {

        console.log(
            "このブラウザは通知に対応していません。"
        );

        return;

    }


    if (
        !("serviceWorker" in navigator)
    ) {

        console.log(
            "Service Workerに対応していません。"
        );

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission !== "granted"
        ) {

            console.log(
                "通知が許可されていません。"
            );

            return;

        }


        const registration =
            await navigator.serviceWorker.register(
                "./firebase-messaging-sw.js"
            );


        console.log(
            "通知用Service Workerを登録しました。",
            registration
        );


        if (
            !VAPID_KEY ||
            VAPID_KEY ===
                "ここにFirebaseのWeb Push公開鍵を入れる"
        ) {

            console.log(
                "VAPID公開鍵がまだ設定されていません。"
            );

            return;

        }


        notificationToken =
            await getToken(
                messaging,
                {
                    vapidKey:
                        VAPID_KEY,

                    serviceWorkerRegistration:
                        registration
                }
            );


        if (notificationToken) {

            console.log(
                "FCMトークンを取得しました。",
                notificationToken
            );


            await saveNotificationToken(
                notificationToken
            );

        } else {

            console.log(
                "FCMトークンを取得できませんでした。"
            );

        }


    } catch (error) {

        console.error(
            "通知の初期化に失敗しました。",
            error
        );

    }

}


// ==================================================
// 通知トークン保存
// ==================================================

async function saveNotificationToken(
    token
) {

    if (
        !currentUser ||
        !username ||
        !token
    ) {
        return;
    }


    try {

        await setDoc(
            doc(
                db,
                "users",
                username
            ),
            {
                notificationToken:
                    token,

                notificationEnabled:
                    true,

                notificationUpdatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );


    } catch (error) {

        console.error(
            "通知トークンの保存に失敗しました。",
            error
        );

    }

}


// ==================================================
// アプリを開いているときの通知
// ==================================================

onMessage(
    messaging,
    payload => {

        console.log(
            "FCMメッセージを受信しました。",
            payload
        );


        const notification =
            payload.notification || {};


        const title =
            notification.title ||
            "ゆうChat";


        const body =
            notification.body ||
            "新しいメッセージが届きました。";


        if (
            Notification.permission ===
            "granted"
        ) {

            try {

                new Notification(
                    title,
                    {
                        body:
                            body,

                        icon:
                            "./icon.png",

                        tag:
                            "yuuchat-message"
                    }
                );

            } catch (error) {

                console.error(
                    "通知表示に失敗しました。",
                    error
                );

            }

        }

    }
);


// ==================================================
// ログイン
// ==================================================

googleLoginButton?.addEventListener(
    "click",
    async () => {

        try {

            loginError.textContent = "";

            const provider =
                new GoogleAuthProvider();

            await signInWithPopup(
                auth,
                provider
            );

        } catch (error) {

            console.error(error);

            loginError.textContent =
                "ログインに失敗しました。";

        }

    }
);


guestLoginButton?.addEventListener(
    "click",
    async () => {

        try {

            loginError.textContent = "";

            await signInAnonymously(auth);

        } catch (error) {

            console.error(error);

            loginError.textContent =
                "ゲストログインに失敗しました。";

        }

    }
);


// ==================================================
// 認証状態
// ==================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            currentUser = null;

            notificationInitialized =
                false;

            notificationToken =
                null;


            loginScreen?.classList.remove(
                "hidden"
            );

            nameScreen?.classList.add(
                "hidden"
            );

            appElement?.classList.add(
                "hidden"
            );

            return;
        }


        currentUser =
            user;


        const savedName =
            localStorage.getItem(
                "yuuchat_username"
            );


        let suggestedName =
            savedName;


        if (
            !suggestedName &&
            user.displayName
        ) {

            suggestedName =
                user.displayName;

        }


        if (suggestedName) {

            const userDoc =
                await getDoc(
                    doc(
                        db,
                        "users",
                        suggestedName
                    )
                );


            if (
                !userDoc.exists() ||
                !userDoc.data().uid ||
                userDoc.data().uid ===
                    user.uid
            ) {

                username =
                    suggestedName;


                localStorage.setItem(
                    "yuuchat_username",
                    username
                );


                await startApp();

            } else {

                nameInput.value = "";

                nameError.textContent =
                    "この名前はすでに使われています。別の名前を入力してください。";

                showNameScreen();

            }

        } else {

            showNameScreen();

        }

    }
);


// ==================================================
// 名前入力画面
// ==================================================

function showNameScreen() {

    loginScreen?.classList.add(
        "hidden"
    );

    appElement?.classList.add(
        "hidden"
    );

    nameScreen?.classList.remove(
        "hidden"
    );

}


// ==================================================
// 名前決定
// ==================================================

startChatButton?.addEventListener(
    "click",
    async () => {

        const newName =
            nameInput.value.trim();


        if (!newName) {

            nameError.textContent =
                "名前を入力してください。";

            return;
        }


        if (newName.length > 20) {

            nameError.textContent =
                "名前は20文字以内にしてください。";

            return;
        }


        try {

            const existingUser =
                await getDoc(
                    doc(
                        db,
                        "users",
                        newName
                    )
                );


            if (
                existingUser.exists() &&
                existingUser.data().uid &&
                existingUser.data().uid !==
                    currentUser.uid
            ) {

                nameError.textContent =
                    "その名前はすでに使われています。";

                return;
            }


            username =
                newName;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            await startApp();

        } catch (error) {

            console.error(error);

            nameError.textContent =
                "名前の設定に失敗しました。";

        }

    }
);


// ==================================================
// アプリ開始
// ==================================================

async function startApp() {

    loginScreen?.classList.add(
        "hidden"
    );

    nameScreen?.classList.add(
        "hidden"
    );

    appElement?.classList.remove(
        "hidden"
    );


    myName.textContent =
        username;


    await updateOnline();

    loadProfileImage();

    listenFriends();

    listenGroups();

    listenAllMessages();


    // 通知機能を開始
    await initializeNotifications();

}


// ==================================================
// オンライン状態
// ==================================================

async function updateOnline() {

    if (
        !username ||
        !currentUser
    ) {

        return;

    }


    try {

        await setDoc(
            doc(
                db,
                "users",
                username
            ),
            {
                username:
                    username,

                uid:
                    currentUser.uid,

                online:
                    true,

                lastSeen:
                    serverTimestamp()
            },
            {
                merge:
                    true
            }
        );


        if (statusElement) {

            statusElement.textContent =
                "🟢 オンライン";

        }

    } catch (error) {

        console.error(error);

    }

}


setInterval(
    () => {

        if (
            currentUser &&
            username
        ) {

            updateOnline();

        }

    },
    20000
);


// ==================================================
// ログアウト
// ==================================================

logoutButton?.addEventListener(
    "click",
    async () => {

        try {

            if (username) {

                await setDoc(
                    doc(
                        db,
                        "users",
                        username
                    ),
                    {
                        online:
                            false,

                        lastSeen:
                            serverTimestamp(),

                        notificationEnabled:
                            false
                    },
                    {
                        merge:
                            true
                    }
                );

            }

        } catch (error) {

            console.error(error);

        }


        await signOut(auth);

        location.reload();

    }
);


// ==================================================
// プロフィール画像
// ==================================================

profileImageInput?.addEventListener(
    "change",
    () => {

        const file =
            profileImageInput.files[0];


        if (!file) {

            return;

        }


        const reader =
            new FileReader();


        reader.onload =
            () => {

                localStorage.setItem(
                    `yuuchat_profile_${currentUser.uid}`,
                    reader.result
                );


                loadProfileImage();

            };


        reader.readAsDataURL(file);

    }
);


function loadProfileImage() {

    if (!currentUser) {

        return;

    }


    const imageData =
        localStorage.getItem(
            `yuuchat_profile_${currentUser.uid}`
        );


    if (imageData) {

        myProfileImage.src =
            imageData;

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


// ==================================================
// 名前変更
// ==================================================

changeNameButton?.addEventListener(
    "click",
    async () => {

        const newName =
            prompt(
                "新しい名前を入力してください",
                username
            );


        if (!newName) {

            return;

        }


        const trimmedName =
            newName.trim();


        if (
            !trimmedName ||
            trimmedName === username
        ) {

            return;

        }


        if (trimmedName.length > 20) {

            alert(
                "名前は20文字以内にしてください。"
            );

            return;

        }


        try {

            const newUserDoc =
                await getDoc(
                    doc(
                        db,
                        "users",
                        trimmedName
                    )
                );


            if (
                newUserDoc.exists() &&
                newUserDoc.data().uid !==
                    currentUser.uid
            ) {

                alert(
                    "その名前はすでに使われています。"
                );

                return;

            }


            await renameUser(
                username,
                trimmedName
            );


            username =
                trimmedName;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            myName.textContent =
                username;


            alert(
                "名前を変更しました。"
            );

        } catch (error) {

            console.error(error);

            alert(
                "名前変更に失敗しました。"
            );

        }

    }
);


// ==================================================
// 名前変更処理
// ==================================================

async function renameUser(
    oldName,
    newName
) {

    const batch =
        writeBatch(db);


    batch.set(
        doc(
            db,
            "users",
            newName
        ),
        {
            username:
                newName,

            uid:
                currentUser.uid,

            online:
                true,

            lastSeen:
                serverTimestamp(),

            notificationToken:
                notificationToken,

            notificationEnabled:
                !!notificationToken
        },
        {
            merge:
                true
        }
    );


    const friendsSnapshot =
        await getDocs(
            collection(
                db,
                "friends"
            )
        );


    friendsSnapshot.forEach(
        item => {

            const data =
                item.data();


            if (
                data.owner === oldName ||
                data.friendName === oldName
            ) {

                batch.update(
                    item.ref,
                    {
                        owner:
                            data.owner === oldName
                                ? newName
                                : data.owner,

                        friendName:
                            data.friendName === oldName
                                ? newName
                                : data.friendName
                    }
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
        item => {

            const data =
                item.data();


            if (
                data.owner === oldName ||
                (data.members || [])
                    .includes(oldName)
            ) {

                const members =
                    (data.members || [])
                        .map(
                            member =>
                                member === oldName
                                    ? newName
                                    : member
                        );


                batch.update(
                    item.ref,
                    {
                        owner:
                            data.owner === oldName
                                ? newName
                                : data.owner,

                        members:
                            members
                    }
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
        item => {

            const data =
                item.data();


            if (
                data.sender === oldName ||
                data.receiver === oldName
            ) {

                batch.update(
                    item.ref,
                    {
                        sender:
                            data.sender === oldName
                                ? newName
                                : data.sender,

                        receiver:
                            data.receiver === oldName
                                ? newName
                                : data.receiver
                    }
                );

            }

        }
    );


    batch.delete(
        doc(
            db,
            "users",
            oldName
        )
    );


    await batch.commit();

}


// ==================================================
// ①ここまで
// ==================================================

// ==================================================
// 友達一覧
// ==================================================

function listenFriends() {

    if (!username) return;

    if (unsubscribeFriends) {
        unsubscribeFriends();
    }

    const friendsQuery = query(
        collection(db, "friends"),
        where("owner", "==", username)
    );

    unsubscribeFriends = onSnapshot(
        friendsQuery,
        snapshot => {

            friendsData = [];

            snapshot.forEach(item => {

                friendsData.push({
                    id: item.id,
                    ...item.data()
                });

            });

            renderFriends();
        },
        error => {
            console.error(
                "友達一覧の取得に失敗しました。",
                error
            );
        }
    );
}


// ==================================================
// 友達一覧表示
// ==================================================

function renderFriends() {

    if (!friendsList) return;

    friendsList.innerHTML = "";

    friendsData.forEach(friend => {

        const button =
            document.createElement("button");

        button.className =
            "friend-item";

        button.dataset.username =
            friend.friendName;

        button.innerHTML = `
            <span class="friend-name">
                ${escapeHtml(friend.friendName)}
            </span>
            <span
                class="unread-badge"
                id="unread-${safeId(friend.friendName)}"
                style="display:none;"
            >
                0
            </span>
        `;

        button.addEventListener(
            "click",
            () => {

                selectFriend(
                    friend.friendName,
                    friend.id
                );

            }
        );

        friendsList.appendChild(button);

    });

    updateUnreadBadges();
}


// ==================================================
// 友達追加
// ==================================================

addFriendButton?.addEventListener(
    "click",
    async () => {

        const friendName =
            prompt(
                "追加したい友達の名前を入力してください"
            );

        if (!friendName) return;

        const trimmed =
            friendName.trim();

        if (!trimmed) return;

        if (trimmed === username) {

            alert(
                "自分自身は友達に追加できません。"
            );

            return;
        }

        try {

            const friendUser =
                await getDoc(
                    doc(
                        db,
                        "users",
                        trimmed
                    )
                );

            if (!friendUser.exists()) {

                alert(
                    "そのユーザーは存在しません。"
                );

                return;
            }

            const already =
                friendsData.some(
                    friend =>
                        friend.friendName ===
                        trimmed
                );

            if (already) {

                alert(
                    "すでに友達です。"
                );

                return;
            }

            const friendshipId =
                await ensureFriendshipId(
                    username,
                    trimmed
                );

            await setDoc(
                doc(
                    db,
                    "friends",
                    friendshipId + "_" + username
                ),
                {
                    owner:
                        username,

                    friendName:
                        trimmed,

                    friendshipId:
                        friendshipId,

                    createdAt:
                        serverTimestamp()
                }
            );

            await setDoc(
                doc(
                    db,
                    "friends",
                    friendshipId + "_" + trimmed
                ),
                {
                    owner:
                        trimmed,

                    friendName:
                        username,

                    friendshipId:
                        friendshipId,

                    createdAt:
                        serverTimestamp()
                }
            );

            alert(
                `${trimmed}さんを友達に追加しました。`
            );

        } catch (error) {

            console.error(error);

            alert(
                "友達追加に失敗しました。"
            );

        }

    }
);


// ==================================================
// 友達削除
// ==================================================

async function deleteFriend(
    friendName
) {

    if (!confirm(
        `${friendName}さんを友達から削除しますか？`
    )) {

        return;
    }

    try {

        const friendshipId =
            await ensureFriendshipId(
                username,
                friendName
            );

        const myFriendDoc =
            doc(
                db,
                "friends",
                friendshipId + "_" + username
            );

        const theirFriendDoc =
            doc(
                db,
                "friends",
                friendshipId + "_" + friendName
            );

        await deleteDoc(
            myFriendDoc
        );

        await deleteDoc(
            theirFriendDoc
        );

        if (
            selectedChatType === "friend" &&
            selectedChat === friendName
        ) {

            resetChat();

        }

    } catch (error) {

        console.error(error);

        alert(
            "友達削除に失敗しました。"
        );

    }

}


// ==================================================
// 友達ID
// ==================================================

async function ensureFriendshipId(
    user1,
    user2
) {

    const names = [
        user1,
        user2
    ].sort();

    return names.join("__");

}


// ==================================================
// グループ一覧
// ==================================================

function listenGroups() {

    if (!username) return;

    if (unsubscribeGroups) {
        unsubscribeGroups();
    }

    const groupsQuery =
        query(
            collection(db, "groups")
        );

    unsubscribeGroups =
        onSnapshot(
            groupsQuery,
            snapshot => {

                groupsData = [];

                snapshot.forEach(item => {

                    const data =
                        item.data();

                    if (
                        (data.members || [])
                            .includes(username)
                    ) {

                        groupsData.push({
                            id: item.id,
                            ...data
                        });

                    }

                });

                renderGroups();

            },
            error => {

                console.error(
                    "グループ一覧の取得に失敗しました。",
                    error
                );

            }
        );

}


// ==================================================
// グループ表示
// ==================================================

function renderGroups() {

    if (!groupsList) return;

    groupsList.innerHTML = "";

    groupsData.forEach(group => {

        const button =
            document.createElement("button");

        button.className =
            "group-item";

        button.innerHTML = `
            <span class="group-name">
                ${escapeHtml(
                    group.name || "グループ"
                )}
            </span>
            <span
                class="unread-badge"
                id="group-unread-${safeId(group.id)}"
                style="display:none;"
            >
                0
            </span>
        `;

        button.addEventListener(
            "click",
            () => {

                selectGroup(group);

            }
        );

        groupsList.appendChild(button);

    });

    updateUnreadBadges();

}


// ==================================================
// グループ作成
// ==================================================

createGroupButton?.addEventListener(
    "click",
    async () => {

        const groupName =
            prompt(
                "グループ名を入力してください"
            );

        if (!groupName) return;

        const trimmed =
            groupName.trim();

        if (!trimmed) return;

        try {

            const groupRef =
                await addDoc(
                    collection(
                        db,
                        "groups"
                    ),
                    {
                        name:
                            trimmed,

                        owner:
                            username,

                        members:
                            [username],

                        createdAt:
                            serverTimestamp()
                    }
                );

            alert(
                "グループを作成しました。"
            );

            selectGroup({
                id:
                    groupRef.id,

                name:
                    trimmed,

                owner:
                    username,

                members:
                    [username]
            });

        } catch (error) {

            console.error(error);

            alert(
                "グループ作成に失敗しました。"
            );

        }

    }
);


// ==================================================
// グループ選択
// ==================================================

function selectGroup(group) {

    selectedChat =
        group.id;

    selectedChatType =
        "group";

    selectedFriendshipId =
        null;

    replyingMessage =
        null;

    if (chatHeader) {

        chatHeader.textContent =
            group.name || "グループ";

    }

    clearReply();

    enableMessageInput();

    listenMessagesForCurrentChat();

    markGroupMessagesRead(
        group.id
    );

}


// ==================================================
// 友達選択
// ==================================================

async function selectFriend(
    friendName,
    friendshipId
) {

    selectedChat =
        friendName;

    selectedChatType =
        "friend";

    selectedFriendshipId =
        friendshipId;

    replyingMessage =
        null;

    if (chatHeader) {

        chatHeader.textContent =
            friendName;

    }

    clearReply();

    enableMessageInput();

    listenMessagesForCurrentChat();

    await markFriendMessagesRead(
        friendName
    );

}


// ==================================================
// メッセージ入力有効化
// ==================================================

function enableMessageInput() {

    if (messageInput) {

        messageInput.disabled =
            false;

    }

    if (sendButton) {

        sendButton.disabled =
            false;

    }

}


// ==================================================
// チャットリセット
// ==================================================

function resetChat() {

    selectedChat =
        null;

    selectedChatType =
        null;

    selectedFriendshipId =
        null;

    replyingMessage =
        null;

    if (chatHeader) {

        chatHeader.textContent =
            "チャットを選択してください";

    }

    if (messagesElement) {

        messagesElement.innerHTML =
            "";

    }

    if (messageInput) {

        messageInput.value =
            "";

        messageInput.disabled =
            true;

    }

    if (sendButton) {

        sendButton.disabled =
            true;

    }

    clearReply();

}


// ==================================================
// 現在のチャットのメッセージ監視
// ==================================================

function listenMessagesForCurrentChat() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages =
            null;

    }

    if (
        !selectedChat ||
        !selectedChatType
    ) {

        return;

    }


    let messagesQuery;


    if (
        selectedChatType ===
        "friend"
    ) {

        messagesQuery =
            query(
                collection(
                    db,
                    "messages"
                ),
                where(
                    "chatType",
                    "==",
                    "friend"
                ),
                where(
                    "friendshipId",
                    "==",
                    selectedFriendshipId
                ),
                orderBy(
                    "createdAt",
                    "asc"
                )
            );

    } else {

        messagesQuery =
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
                    selectedChat
                ),
                orderBy(
                    "createdAt",
                    "asc"
                )
            );

    }


    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                renderMessages(
                    snapshot
                );

            },
            error => {

                console.error(
                    "メッセージ取得エラー:",
                    error
                );

            }
        );

}


// ==================================================
// 全メッセージ監視
// ==================================================

function listenAllMessages() {

    if (unsubscribeAllMessages) {

        unsubscribeAllMessages();

    }

    const messagesQuery =
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


    unsubscribeAllMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                updateUnreadBadges();

            },
            error => {

                console.error(
                    "全メッセージ監視エラー:",
                    error
                );

            }
        );

}


// ==================================================
// メッセージ表示
// ==================================================

function renderMessages(
    snapshot
) {

    if (!messagesElement) return;

    messagesElement.innerHTML =
        "";

    snapshot.forEach(
        item => {

            const message =
                item.data();

            renderMessage(
                item.id,
                message
            );

        }
    );

    messagesElement.scrollTop =
        messagesElement.scrollHeight;

}


// ==================================================
// メッセージ1件表示
// ==================================================

function renderMessage(
    messageId,
    message
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message-wrapper";


    if (
        message.sender ===
        username
    ) {

        wrapper.classList.add(
            "mine"
        );

    } else {

        wrapper.classList.add(
            "theirs"
        );

    }


    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "message-bubble";


    if (message.deleted) {

        bubble.textContent =
            "送信を取り消しました。";

        bubble.classList.add(
            "deleted-message"
        );

    } else {

        bubble.textContent =
            message.text;

    }


    if (
        message.replyToText
    ) {

        const reply =
            document.createElement(
                "div"
            );

        reply.className =
            "reply-preview";

        reply.textContent =
            `↪ ${message.replyToText}`;

        bubble.prepend(
            reply
        );

    }


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
        "↩";

    replyButton.title =
        "返信";


    replyButton.addEventListener(
        "click",
        () => {

            replyingMessage = {
                id:
                    messageId,

                text:
                    message.text || ""
            };

            if (replyText) {

                replyText.textContent =
                    message.text || "";

            }

            if (replyBar) {

                replyBar.style.display =
                    "flex";

            }

            messageInput?.focus();

        }
    );


    actions.appendChild(
        replyButton
    );


    if (
        message.sender ===
        username &&
        !message.deleted
    ) {

        const deleteButton =
            document.createElement(
                "button"
            );

        deleteButton.textContent =
            "取消";

        deleteButton.addEventListener(
            "click",
            () => {

                deleteMessage(
                    messageId
                );

            }
        );

        actions.appendChild(
            deleteButton
        );

    }


    const reactionButton =
        document.createElement(
            "button"
        );

    reactionButton.textContent =
        "❤️";

    reactionButton.addEventListener(
        "click",
        () => {

            reactToMessage(
                messageId
            );

        }
    );


    actions.appendChild(
        reactionButton
    );


    bubble.appendChild(
        actions
    );


    wrapper.appendChild(
        bubble
    );


    messagesElement.appendChild(
        wrapper
    );

}


// ==================================================
// メッセージ送信
// ==================================================

sendButton?.addEventListener(
    "click",
    sendMessage
);


messageInput?.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


async function sendMessage() {

    if (
        !username ||
        !selectedChat ||
        !selectedChatType
    ) {

        return;

    }


    const text =
        messageInput.value.trim();


    if (!text) {

        return;

    }


    try {

        const messageData = {

            sender:
                username,

            text:
                text,

            createdAt:
                serverTimestamp(),

            deleted:
                false,

            readBy:
                [username],

            chatType:
                selectedChatType

        };


        if (
            selectedChatType ===
            "friend"
        ) {

            messageData.receiver =
                selectedChat;

            messageData.friendshipId =
                selectedFriendshipId;

        } else {

            messageData.chatId =
                selectedChat;

        }


        if (
            replyingMessage
        ) {

            messageData.replyToId =
                replyingMessage.id;

            messageData.replyToText =
                replyingMessage.text;

        }


        await addDoc(
            collection(
                db,
                "messages"
            ),
            messageData
        );


        messageInput.value =
            "";

        clearReply();


    } catch (error) {

        console.error(
            "メッセージ送信エラー:",
            error
        );

        alert(
            "メッセージを送信できませんでした。"
        );

    }

}


// ==================================================
// 返信解除
// ==================================================

cancelReplyButton?.addEventListener(
    "click",
    clearReply
);


function clearReply() {

    replyingMessage =
        null;

    if (replyBar) {

        replyBar.style.display =
            "none";

    }

    if (replyText) {

        replyText.textContent =
            "";

    }

}


// ==================================================
// メッセージ削除・送信取り消し
// ==================================================

async function deleteMessage(
    messageId
) {

    try {

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

    } catch (error) {

        console.error(
            error
        );

    }

}


// ==================================================
// リアクション
// ==================================================

async function reactToMessage(
    messageId
) {

    try {

        const messageRef =
            doc(
                db,
                "messages",
                messageId
            );

        const messageSnapshot =
            await getDoc(
                messageRef
            );

        if (!messageSnapshot.exists()) {
            return;
        }

        const data =
            messageSnapshot.data();

        let reactions =
            data.reactions || {};

        let users =
            reactions.heart || [];

        if (
            users.includes(username)
        ) {

            users =
                users.filter(
                    user =>
                        user !== username
                );

        } else {

            users = [
                ...users,
                username
            ];

        }

        reactions.heart =
            users;

        await updateDoc(
            messageRef,
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


// ==================================================
// 既読処理
// ==================================================

async function markFriendMessagesRead(
    friendName
) {

    if (!selectedFriendshipId) {
        return;
    }

    try {

        const messagesQuery =
            query(
                collection(
                    db,
                    "messages"
                ),
                where(
                    "chatType",
                    "==",
                    "friend"
                ),
                where(
                    "friendshipId",
                    "==",
                    selectedFriendshipId
                )
            );

        const snapshot =
            await getDocs(
                messagesQuery
            );

        const batch =
            writeBatch(db);

        let changed =
            false;

        snapshot.forEach(
            item => {

                const data =
                    item.data();

                const readBy =
                    data.readBy || [];

                if (
                    !readBy.includes(username)
                ) {

                    batch.update(
                        item.ref,
                        {
                            readBy: [
                                ...readBy,
                                username
                            ]
                        }
                    );

                    changed =
                        true;

                }

            }
        );

        if (changed) {

            await batch.commit();

        }

    } catch (error) {

        console.error(
            "既読処理エラー:",
            error
        );

    }

}


// ==================================================
// グループ既読
// ==================================================

async function markGroupMessagesRead(
    groupId
) {

    try {

        const messagesQuery =
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
            await getDocs(
                messagesQuery
            );

        const batch =
            writeBatch(db);

        let changed =
            false;

        snapshot.forEach(
            item => {

                const data =
                    item.data();

                const readBy =
                    data.readBy || [];

                if (
                    !readBy.includes(username)
                ) {

                    batch.update(
                        item.ref,
                        {
                            readBy: [
                                ...readBy,
                                username
                            ]
                        }
                    );

                    changed =
                        true;

                }

            }
        );

        if (changed) {

            await batch.commit();

        }

    } catch (error) {

        console.error(
            "グループ既読処理エラー:",
            error
        );

    }

}


// ==================================================
// 未読数
// ==================================================

async function updateUnreadBadges() {

    if (!username) return;

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "messages"
                )
            );


        const friendUnread = {};

        const groupUnread = {};


        snapshot.forEach(
            item => {

                const data =
                    item.data();

                const readBy =
                    data.readBy || [];


                if (
                    readBy.includes(username)
                ) {

                    return;

                }


                if (
                    data.chatType ===
                    "friend"
                ) {

                    const otherUser =
                        data.sender === username
                            ? data.receiver
                            : data.sender;

                    if (!otherUser) {
                        return;
                    }

                    friendUnread[otherUser] =
                        (friendUnread[otherUser] || 0)
                        + 1;

                }


                if (
                    data.chatType ===
                    "group"
                ) {

                    if (!data.chatId) {
                        return;
                    }

                    groupUnread[data.chatId] =
                        (groupUnread[data.chatId] || 0)
                        + 1;

                }

            }
        );


        friendsData.forEach(
            friend => {

                const badge =
                    document.getElementById(
                        `unread-${safeId(
                            friend.friendName
                        )}`
                    );

                if (!badge) return;

                const count =
                    friendUnread[
                        friend.friendName
                    ] || 0;

                if (count > 0) {

                    badge.textContent =
                        count;

                    badge.style.display =
                        "inline-flex";

                } else {

                    badge.style.display =
                        "none";

                }

            }
        );


        groupsData.forEach(
            group => {

                const badge =
                    document.getElementById(
                        `group-unread-${safeId(
                            group.id
                        )}`
                    );

                if (!badge) return;

                const count =
                    groupUnread[
                        group.id
                    ] || 0;

                if (count > 0) {

                    badge.textContent =
                        count;

                    badge.style.display =
                        "inline-flex";

                } else {

                    badge.style.display =
                        "none";

                }

            }
        );


    } catch (error) {

        console.error(
            "未読数取得エラー:",
            error
        );

    }

}


// ==================================================
// 補助関数
// ==================================================

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


function safeId(
    value
) {

    return String(value)
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
        );

}


// ==================================================
// 初期状態
// ==================================================

if (messageInput) {

    messageInput.disabled =
        true;

}

if (sendButton) {

    sendButton.disabled =
        true;

}


// ==================================================
// ②ここまで
// ==================================================
