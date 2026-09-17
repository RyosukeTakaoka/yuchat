/* =========================================================
   ゆうChat
   script.js 完全置換版①

   ・Firebaseログイン
   ・Googleログイン
   ・ゲストログイン
   ・名前設定 / 名前変更
   ・プロフィール画像
   ・オンライン状態
   ・友達追加 / 削除
   ・グループ作成
   ・グループ管理
   ・1対1チャット
   ・グループチャット
   ・返信
   ・リアクション
   ・送信取り消し
   ・既読
   ・未読
   ・通知
   ・レーススコア
   ・本日のランキング
   ・今までのランキング

   ※レーススコアは賭けには使用しません。
========================================================= */


/* =========================================================
   Firebase import
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

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
    writeBatch,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


/* =========================================================
   Firebase設定
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyDJFat47USzK6KaGuvj1dVjfELhRmH_2Tw",
    authDomain: "yuuchat-be666.firebaseapp.com",
    projectId: "yuuchat-be666",
    storageBucket: "yuuchat-be666.firebasestorage.app",
    messagingSenderId: "89509274877",
    appId: "1:89509274877:web:978a6179645ce88c3d4a94"
};

const VAPID_PUBLIC_KEY =
    "BNKlLucsJnYok43m4muAEkcQq8cOcNrUKFyNYkCeo2jKhm1RwJVAU6tC7p3PjoaidOU08Hh7oEeRz43S8X73Ppw";


const firebaseApp =
    initializeApp(firebaseConfig);

const db =
    getFirestore(firebaseApp);

const auth =
    getAuth(firebaseApp);

let messaging = null;


/* =========================================================
   アプリ状態
========================================================= */

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

let notificationsInitialized = false;


/* =========================================================
   HTML取得
========================================================= */

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


/* =========================================================
   共通関数
========================================================= */

function showError(element, text) {
    if (element) {
        element.textContent = text || "";
    }
}


function escapeHTML(value) {
    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


function getJapanDateString() {

    const now = new Date();

    const parts =
        new Intl.DateTimeFormat(
            "ja-JP",
            {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(now);

    const year =
        parts.find(
            item => item.type === "year"
        )?.value;

    const month =
        parts.find(
            item => item.type === "month"
        )?.value;

    const day =
        parts.find(
            item => item.type === "day"
        )?.value;

    return `${year}-${month}-${day}`;
}


function makeFriendshipId() {

    if (
        typeof crypto !== "undefined" &&
        crypto.randomUUID
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


/* =========================================================
   ログイン
========================================================= */

googleLoginButton?.addEventListener(
    "click",
    async () => {

        try {

            showError(loginError, "");

            const provider =
                new GoogleAuthProvider();

            await signInWithPopup(
                auth,
                provider
            );

        } catch (error) {

            console.error(
                "Googleログインエラー:",
                error
            );

            showError(
                loginError,
                "ログインに失敗しました。"
            );
        }

    }
);


guestLoginButton?.addEventListener(
    "click",
    async () => {

        try {

            showError(loginError, "");

            await signInAnonymously(auth);

        } catch (error) {

            console.error(
                "ゲストログインエラー:",
                error
            );

            showError(
                loginError,
                "ゲストログインに失敗しました。"
            );
        }

    }
);


/* =========================================================
   Firebase認証状態
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentUser = null;
            username = null;

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


        currentUser = user;


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


        if (!suggestedName) {

            showNameScreen();

            return;
        }


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    suggestedName
                );

            const userDoc =
                await getDoc(userRef);


            if (
                !userDoc.exists() ||
                !userDoc.data().uid ||
                userDoc.data().uid === user.uid
            ) {

                username =
                    suggestedName;

                localStorage.setItem(
                    "yuuchat_username",
                    username
                );

                await startApp();

            } else {

                showError(
                    nameError,
                    "この名前はすでに使われています。別の名前を入力してください。"
                );

                showNameScreen();
            }

        } catch (error) {

            console.error(
                "ユーザー確認エラー:",
                error
            );

            showError(
                nameError,
                "ユーザー情報の確認に失敗しました。"
            );

            showNameScreen();
        }

    }
);


/* =========================================================
   名前画面
========================================================= */

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


/* =========================================================
   名前決定
========================================================= */

startChatButton?.addEventListener(
    "click",
    async () => {

        const newName =
            nameInput?.value.trim();


        if (!newName) {

            showError(
                nameError,
                "名前を入力してください。"
            );

            return;
        }


        if (newName.length > 20) {

            showError(
                nameError,
                "名前は20文字以内にしてください。"
            );

            return;
        }


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    newName
                );

            const existing =
                await getDoc(userRef);


            if (
                existing.exists() &&
                existing.data().uid &&
                existing.data().uid !== currentUser.uid
            ) {

                showError(
                    nameError,
                    "その名前はすでに使われています。"
                );

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

            showError(
                nameError,
                "名前の設定に失敗しました。"
            );
        }

    }
);


/* =========================================================
   アプリ開始
========================================================= */

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


    if (myName) {
        myName.textContent =
            username;
    }


    await updateOnline();

    loadProfileImage();

    listenFriends();

    listenGroups();

    listenAllMessages();

    initializeNotifications();

    initializeRaceSystem();

}


/* =========================================================
   オンライン状態
========================================================= */

async function updateOnline() {

    if (!username || !currentUser) {
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
                username,
                uid: currentUser.uid,
                online: true,
                lastSeen: serverTimestamp()
            },
            {
                merge: true
            }
        );


        if (statusElement) {
            statusElement.textContent =
                "🟢 オンライン";
        }

    } catch (error) {

        console.error(
            "オンライン状態更新エラー:",
            error
        );
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


/* =========================================================
   ログアウト
========================================================= */

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
                        online: false,
                        lastSeen: serverTimestamp()
                    },
                    {
                        merge: true
                    }
                );
            }

        } catch (error) {

            console.error(error);
        }


        try {

            await signOut(auth);

        } catch (error) {

            console.error(error);
        }


        location.reload();

    }
);


/* =========================================================
   プロフィール画像
========================================================= */

profileImageInput?.addEventListener(
    "change",
    () => {

        const file =
            profileImageInput.files?.[0];

        if (!file) {
            return;
        }


        if (!file.type.startsWith("image/")) {

            alert(
                "画像ファイルを選択してください。"
            );

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


    if (
        imageData &&
        myProfileImage
    ) {

        myProfileImage.src =
            imageData;

        myProfileImage.style.display =
            "block";

        if (profileImagePlaceholder) {
            profileImagePlaceholder.style.display =
                "none";
        }

    } else {

        if (myProfileImage) {
            myProfileImage.style.display =
                "none";
        }

        if (profileImagePlaceholder) {
            profileImagePlaceholder.style.display =
                "block";
        }
    }
}


/* =========================================================
   名前変更
========================================================= */

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


        const trimmed =
            newName.trim();


        if (!trimmed) {
            return;
        }


        if (trimmed === username) {
            return;
        }


        if (trimmed.length > 20) {

            alert(
                "名前は20文字以内にしてください。"
            );

            return;
        }


        try {

            const newUserRef =
                doc(
                    db,
                    "users",
                    trimmed
                );

            const existing =
                await getDoc(newUserRef);


            if (
                existing.exists() &&
                existing.data().uid !== currentUser.uid
            ) {

                alert(
                    "その名前はすでに使われています。"
                );

                return;
            }


            await renameUser(
                username,
                trimmed
            );


            username =
                trimmed;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            if (myName) {
                myName.textContent =
                    username;
            }


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


/* =========================================================
   名前変更処理
========================================================= */

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
            username: newName,
            uid: currentUser.uid,
            online: true,
            lastSeen: serverTimestamp()
        },
        {
            merge: true
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

            const members =
                Array.isArray(data.members)
                    ? data.members
                    : [];


            if (
                data.owner === oldName ||
                members.includes(oldName)
            ) {

                batch.update(
                    item.ref,
                    {
                        owner:
                            data.owner === oldName
                                ? newName
                                : data.owner,

                        members:
                            members.map(
                                member =>
                                    member === oldName
                                        ? newName
                                        : member
                            )
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


    const messageUpdates = [];


    messagesSnapshot.forEach(
        item => {

            const data =
                item.data();

            if (
                data.sender === oldName ||
                data.receiver === oldName
            ) {

                messageUpdates.push({
                    ref: item.ref,
                    data: {
                        sender:
                            data.sender === oldName
                                ? newName
                                : data.sender,

                        receiver:
                            data.receiver === oldName
                                ? newName
                                : data.receiver
                    }
                });
            }

        }
    );


    /*
       Firestore batchには500件制限があるため、
       メッセージは分割して更新する。
    */

    for (
        let i = 0;
        i < messageUpdates.length;
        i += 450
    ) {

        const chunk =
            messageUpdates.slice(
                i,
                i + 450
            );

        chunk.forEach(
            item => {
                batch.update(
                    item.ref,
                    item.data
                );
            }
        );

        if (
            i ===
            Math.floor(
                (messageUpdates.length - 1) / 450
            ) * 450
        ) {
            batch.delete(
                doc(
                    db,
                    "users",
                    oldName
                )
            );
        }

        await batch.commit();
    }


    if (messageUpdates.length === 0) {

        batch.delete(
            doc(
                db,
                "users",
                oldName
            )
        );

        await batch.commit();
    }
}


/* =========================================================
   友達一覧監視
========================================================= */

function listenFriends() {

    if (unsubscribeFriends) {
        unsubscribeFriends();
    }


    if (!username) {
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
            )
        );


    unsubscribeFriends =
        onSnapshot(
            q,
            snapshot => {

                friendsData =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                friendsData.sort(
                    (a, b) =>
                        (
                            a.friendName || ""
                        ).localeCompare(
                            b.friendName || "",
                            "ja"
                        )
                );


                renderFriends();

            },
            error => {
                console.error(
                    "友達監視エラー:",
                    error
                );
            }
        );
}


/* =========================================================
   友達一覧表示
========================================================= */

function renderFriends() {

    if (!friendsList) {
        return;
    }


    friendsList.innerHTML =
        "";


    if (friendsData.length === 0) {

        friendsList.innerHTML =
            `<div class="empty-message">友達がいません</div>`;

        return;
    }


    friendsData.forEach(
        friend => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "friend-item";


            const mainButton =
                document.createElement(
                    "button"
                );

            mainButton.className =
                "friend-main-button";


            mainButton.innerHTML =
                `🟢 <span class="friend-name"></span>`;


            const nameElement =
                mainButton.querySelector(
                    ".friend-name"
                );

            if (nameElement) {
                nameElement.textContent =
                    friend.friendName;
            }


            const unread =
                document.createElement(
                    "span"
                );

            unread.className =
                "unread-badge";

            unread.style.display =
                "none";


            mainButton.appendChild(
                unread
            );


            mainButton.addEventListener(
                "click",
                () => {

                    selectFriend(
                        friend.friendName
                    );

                }
            );


            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.className =
                "friend-delete-button";

            deleteButton.textContent =
                "×";

            deleteButton.title =
                "友達を削除";


            deleteButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    deleteFriend(
                        friend.friendName
                    );

                }
            );


            row.appendChild(
                mainButton
            );

            row.appendChild(
                deleteButton
            );

            friendsList.appendChild(
                row
            );

        }
    );


    updateUnreadBadges();
}


/* =========================================================
   友達追加
========================================================= */

addFriendButton?.addEventListener(
    "click",
    async () => {

        const input =
            prompt(
                "追加したい友達の名前を入力してください"
            );


        if (!input) {
            return;
        }


        const friendName =
            input.trim();


        if (!friendName) {
            return;
        }


        if (friendName === username) {

            alert(
                "自分自身は友達に追加できません。"
            );

            return;
        }


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    friendName
                );

            const userSnapshot =
                await getDoc(userRef);


            if (!userSnapshot.exists()) {

                alert(
                    "その名前のユーザーは存在しません。"
                );

                return;
            }


            const existingQuery =
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
                        friendName
                    )
                );


            const existing =
                await getDocs(
                    existingQuery
                );


            if (!existing.empty) {

                alert(
                    "すでに友達です。"
                );

                return;
            }


            const friendshipId =
                makeFriendshipId();


            const batch =
                writeBatch(db);


            const myRef =
                doc(
                    collection(
                        db,
                        "friends"
                    )
                );


            const theirRef =
                doc(
                    collection(
                        db,
                        "friends"
                    )
                );


            batch.set(
                myRef,
                {
                    owner: username,
                    friendName,
                    friendshipId,
                    createdAt:
                        serverTimestamp()
                }
            );


            batch.set(
                theirRef,
                {
                    owner: friendName,
                    friendName: username,
                    friendshipId,
                    createdAt:
                        serverTimestamp()
                }
            );


            await batch.commit();


            alert(
                `${friendName}さんを友達に追加しました！`
            );

        } catch (error) {

            console.error(
                "友達追加エラー:",
                error
            );

            alert(
                "友達追加に失敗しました。"
            );
        }

    }
);


/* =========================================================
   友達削除
========================================================= */

async function deleteFriend(
    friendName
) {

    const ok =
        confirm(
            `${friendName}さんを友達から削除しますか？\n\nお互いの友達一覧から削除されます。`
        );


    if (!ok) {
        return;
    }


    try {

        const myQuery =
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
                    friendName
                )
            );


        const theirQuery =
            query(
                collection(
                    db,
                    "friends"
                ),
                where(
                    "owner",
                    "==",
                    friendName
                ),
                where(
                    "friendName",
                    "==",
                    username
                )
            );


        const mySnapshot =
            await getDocs(
                myQuery
            );

        const theirSnapshot =
            await getDocs(
                theirQuery
            );


        const batch =
            writeBatch(db);


        mySnapshot.forEach(
            item => {
                batch.delete(
                    item.ref
                );
            }
        );


        theirSnapshot.forEach(
            item => {
                batch.delete(
                    item.ref
                );
            }
        );


        await batch.commit();


        if (
            selectedChat ===
            friendName
        ) {
            resetChat();
        }


        alert(
            "友達を削除しました。"
        );

    } catch (error) {

        console.error(
            "友達削除エラー:",
            error
        );

        alert(
            "友達の削除に失敗しました。"
        );
    }
}


/* =========================================================
   Friendship ID
========================================================= */

async function ensureFriendshipId(
    friendName
) {

    const current =
        friendsData.find(
            friend =>
                friend.friendName ===
                friendName
        );


    if (current?.friendshipId) {
        return current.friendshipId;
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
                friendName
            )
        );


    const snapshot =
        await getDocs(q);


    if (!snapshot.empty) {

        return (
            snapshot.docs[0]
                .data()
                .friendshipId ||
            null
        );
    }


    return null;
}


/* =========================================================
   グループ一覧監視
========================================================= */

function listenGroups() {

    if (unsubscribeGroups) {
        unsubscribeGroups();
    }


    if (!username) {
        return;
    }


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


    unsubscribeGroups =
        onSnapshot(
            q,
            snapshot => {

                groupsData =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                groupsData.sort(
                    (a, b) =>
                        (
                            a.name || ""
                        ).localeCompare(
                            b.name || "",
                            "ja"
                        )
                );


                renderGroups();

            },
            error => {

                console.error(
                    "グループ監視エラー:",
                    error
                );
            }
        );
}


/* =========================================================
   グループ表示
========================================================= */

function renderGroups() {

    if (!groupsList) {
        return;
    }


    groupsList.innerHTML =
        "";


    if (groupsData.length === 0) {

        groupsList.innerHTML =
            `<div class="empty-message">グループがありません</div>`;

        return;
    }


    groupsData.forEach(
        group => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "group-item";


            const mainButton =
                document.createElement(
                    "button"
                );

            mainButton.className =
                "group-main-button";

            mainButton.textContent =
                `👥 ${group.name}`;


            mainButton.addEventListener(
                "click",
                () => {

                    selectGroup(
                        group.id
                    );

                }
            );


            const manageButton =
                document.createElement(
                    "button"
                );

            manageButton.className =
                "group-manage-button";

            manageButton.textContent =
                "⋯";


            manageButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    showGroupManagement(
                        group
                    );

                }
            );


            row.appendChild(
                mainButton
            );

            row.appendChild(
                manageButton
            );

            groupsList.appendChild(
                row
            );

        }
    );
}


/* =========================================================
   グループ作成
========================================================= */

createGroupButton?.addEventListener(
    "click",
    async () => {

        const input =
            prompt(
                "グループ名を入力してください"
            );


        if (!input) {
            return;
        }


        const groupName =
            input.trim();


        if (!groupName) {
            return;
        }


        if (groupName.length > 50) {

            alert(
                "グループ名は50文字以内にしてください。"
            );

            return;
        }


        const members =
            [username];


        const selectedFriends = [];


        if (friendsData.length > 0) {

            const list =
                friendsData
                    .map(
                        friend =>
                            friend.friendName
                    )
                    .join("\n");


            const selected =
                prompt(
                    "追加する友達の名前を入力してください。\n\n複数人の場合はカンマ（,）で区切れます。\n\n友達一覧:\n" +
                    list
                );


            if (selected) {

                selected
                    .split(",")
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(Boolean)
                    .forEach(
                        name => {

                            if (
                                name !== username &&
                                friendsData.some(
                                    friend =>
                                        friend.friendName === name
                                ) &&
                                !selectedFriends.includes(name)
                            ) {
                                selectedFriends.push(
                                    name
                                );
                            }

                        }
                    );
            }
        }


        members.push(
            ...selectedFriends
        );


        try {

            await addDoc(
                collection(
                    db,
                    "groups"
                ),
                {
                    name: groupName,
                    owner: username,
                    members,
                    createdAt:
                        serverTimestamp()
                }
            );


            alert(
                "グループを作成しました！"
            );

        } catch (error) {

            console.error(
                "グループ作成エラー:",
                error
            );

            alert(
                "グループ作成に失敗しました。"
            );
        }

    }
);


/* =========================================================
   グループ管理
========================================================= */

async function showGroupManagement(
    group
) {

    if (!group) {
        return;
    }


    const members =
        Array.isArray(group.members)
            ? group.members
            : [];


    let text =
        `グループ「${group.name}」\n\n` +
        `メンバー:\n` +
        members.join("\n");


    if (group.owner === username) {

        text +=
            "\n\nOK → メンバー追加\nキャンセル → 閉じる";


        const add =
            confirm(text);


        if (!add) {
            return;
        }


        const input =
            prompt(
                "追加する友達の名前を入力してください"
            );


        if (!input) {
            return;
        }


        const name =
            input.trim();


        if (
            !friendsData.some(
                friend =>
                    friend.friendName === name
            )
        ) {

            alert(
                "友達一覧にいる人だけ追加できます。"
            );

            return;
        }


        if (members.includes(name)) {

            alert(
                "すでにメンバーです。"
            );

            return;
        }


        try {

            await updateDoc(
                doc(
                    db,
                    "groups",
                    group.id
                ),
                {
                    members: [
                        ...members,
                        name
                    ]
                }
            );


            alert(
                "メンバーを追加しました。"
            );

        } catch (error) {

            console.error(error);

            alert(
                "メンバー追加に失敗しました。"
            );
        }


    } else {

        const leave =
            confirm(
                text +
                "\n\nこのグループから退会しますか？"
            );


        if (!leave) {
            return;
        }


        try {

            const newMembers =
                members.filter(
                    member =>
                        member !== username
                );


            if (newMembers.length === 0) {

                await deleteDoc(
                    doc(
                        db,
                        "groups",
                        group.id
                    )
                );

            } else {

                await updateDoc(
                    doc(
                        db,
                        "groups",
                        group.id
                    ),
                    {
                        members:
                            newMembers
                    }
                );
            }


            if (
                selectedChat ===
                group.id
            ) {
                resetChat();
            }


            alert(
                "グループから退会しました。"
            );

        } catch (error) {

            console.error(error);

            alert(
                "退会に失敗しました。"
            );
        }
    }
}


/* =========================================================
   友達チャット選択
========================================================= */

async function selectFriend(
    friendName
) {

    const friend =
        friendsData.find(
            item =>
                item.friendName ===
                friendName
        );


    selectedChat =
        friendName;

    selectedChatType =
        "friend";

    selectedFriendshipId =
        friend?.friendshipId ||
        await ensureFriendshipId(
            friendName
        );


    if (chatHeader) {
        chatHeader.textContent =
            friendName;
    }


    if (messageInput) {

        messageInput.disabled =
            false;

        messageInput.placeholder =
            `${friendName}にメッセージ`;
    }


    if (sendButton) {
        sendButton.disabled =
            false;
    }


    cancelReply();

    listenMessages();

    await markFriendMessagesAsRead();

    await renderCurrentMessages();
}


/* =========================================================
   グループ選択
========================================================= */

async function selectGroup(
    groupId
) {

    const group =
        groupsData.find(
            item =>
                item.id === groupId
        );


    if (!group) {
        return;
    }


    selectedChat =
        groupId;

    selectedChatType =
        "group";

    selectedFriendshipId =
        null;


    if (chatHeader) {
        chatHeader.textContent =
            `👥 ${group.name}`;
    }


    if (messageInput) {

        messageInput.disabled =
            false;

        messageInput.placeholder =
            `${group.name}にメッセージ`;
    }


    if (sendButton) {
        sendButton.disabled =
            false;
    }


    cancelReply();

    listenMessages();

    await markGroupMessagesAsRead();

    await renderCurrentMessages();
}


/* =========================================================
   チャットリセット
========================================================= */

function resetChat() {

    selectedChat =
        null;

    selectedChatType =
        null;

    selectedFriendshipId =
        null;


    if (chatHeader) {
        chatHeader.textContent =
            "相手を選択してください";
    }


    if (messagesElement) {
        messagesElement.innerHTML =
            "";
    }


    if (messageInput) {

        messageInput.disabled =
            true;

        messageInput.value =
            "";

        messageInput.placeholder =
            "友達またはグループを選択してください";
    }


    if (sendButton) {
        sendButton.disabled =
            true;
    }


    cancelReply();
}


/* =========================================================
   メッセージ監視
========================================================= */

function listenMessages() {

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }


    if (!selectedChat) {
        return;
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


    unsubscribeMessages =
        onSnapshot(
            q,
            snapshot => {

                const messages =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderMessages(
                    messages
                );

            },
            error => {

                console.error(
                    "メッセージ監視エラー:",
                    error
                );
            }
        );
}


/* =========================================================
   メッセージ表示
========================================================= */

function renderMessages(
    allMessages
) {

    if (!messagesElement) {
        return;
    }


    let filtered = [];


    if (
        selectedChatType ===
        "friend"
    ) {

        filtered =
            allMessages.filter(
                message => {

                    const samePair =
                        (
                            message.sender ===
                                username &&
                            message.receiver ===
                                selectedChat
                        ) ||
                        (
                            message.sender ===
                                selectedChat &&
                            message.receiver ===
                                username
                        );


                    return (
                        samePair &&
                        (
                            !selectedFriendshipId ||
                            message.friendshipId ===
                                selectedFriendshipId
                        ) &&
                        message.chatType !==
                            "group"
                    );
                }
            );
    }


    if (
        selectedChatType ===
        "group"
    ) {

        filtered =
            allMessages.filter(
                message =>
                    message.chatType ===
                        "group" &&
                    message.chatId ===
                        selectedChat
            );
    }


    messagesElement.innerHTML =
        "";


    filtered.forEach(
        message => {

            renderSingleMessage(
                message
            );

        }
    );


    messagesElement.scrollTop =
        messagesElement.scrollHeight;
}


/* =========================================================
   1メッセージ表示
========================================================= */

function renderSingleMessage(
    message
) {

    if (!messagesElement) {
        return;
    }


    const row =
        document.createElement(
            "div"
        );


    const mine =
        message.sender ===
        username;


    row.className =
        mine
            ? "message-row mine"
            : "message-row";


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        mine
            ? "message-bubble mine"
            : "message-bubble";


    if (
        selectedChatType ===
            "group" &&
        !mine
    ) {

        const sender =
            document.createElement(
                "div"
            );

        sender.className =
            "message-sender";

        sender.textContent =
            message.sender || "";

        bubble.appendChild(
            sender
        );
    }


    if (message.replyToText) {

        const reply =
            document.createElement(
                "div"
            );

        reply.className =
            "message-reply";

        reply.textContent =
            `↩ ${message.replyToText}`;

        bubble.appendChild(
            reply
        );
    }


    const text =
        document.createElement(
            "div"
        );

    text.className =
        "message-text";


    if (message.deleted) {

        text.textContent =
            "このメッセージは削除されました。";

        text.style.opacity =
            "0.6";

    } else {

        text.textContent =
            message.text || "";
    }


    bubble.appendChild(
        text
    );


    if (
        message.imageData &&
        !message.deleted
    ) {

        const image =
            document.createElement(
                "img"
            );

        image.src =
            message.imageData;

        image.alt =
            "送信された画像";

        image.style.maxWidth =
            "240px";

        image.style.borderRadius =
            "12px";

        image.style.marginTop =
            "8px";

        bubble.appendChild(
            image
        );
    }


    const time =
        document.createElement(
            "div"
        );

    time.className =
        "message-time";


    if (
        message.createdAt?.toDate
    ) {

        const date =
            message.createdAt.toDate();


        time.textContent =
            date.toLocaleTimeString(
                "ja-JP",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }


    bubble.appendChild(
        time
    );


    if (message.reaction) {

        const reaction =
            document.createElement(
                "div"
            );

        reaction.className =
            "message-reaction";

        reaction.textContent =
            message.reaction;

        bubble.appendChild(
            reaction
        );
    }


    if (!message.deleted) {

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
            () =>
                startReply(
                    message
                )
        );


        const reactionButton =
            document.createElement(
                "button"
            );

        reactionButton.textContent =
            "❤️";

        reactionButton.title =
            "リアクション";


        reactionButton.addEventListener(
            "click",
            () =>
                addReaction(
                    message.id
                )
        );


        actions.appendChild(
            replyButton
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
                "🗑️";

            deleteButton.title =
                "送信取り消し";


            deleteButton.addEventListener(
                "click",
                () =>
                    deleteMessage(
                        message.id
                    )
            );


            actions.appendChild(
                deleteButton
            );
        }


        bubble.appendChild(
            actions
        );
    }


    row.appendChild(
        bubble
    );


    messagesElement.appendChild(
        row
    );
}


/* =========================================================
   メッセージ送信
========================================================= */

sendButton?.addEventListener(
    "click",
    sendMessage
);


messageInput?.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            if (
                event.shiftKey
            ) {
                return;
            }

            event.preventDefault();

            sendMessage();
        }

    }
);


async function sendMessage() {

    const text =
        messageInput?.value.trim();


    if (
        !text &&
        !selectedChat
    ) {
        return;
    }


    if (!selectedChat) {

        alert(
            "友達またはグループを選択してください。"
        );

        return;
    }


    if (!text) {
        return;
    }


    try {

        const messageData = {

            sender:
                username,

            text,

            createdAt:
                serverTimestamp(),

            deleted:
                false,

            readBy:
                [username]
        };


        if (
            selectedChatType ===
            "friend"
        ) {

            messageData.receiver =
                selectedChat;

            messageData.chatType =
                "friend";

            messageData.friendshipId =
                selectedFriendshipId;
        }


        if (
            selectedChatType ===
            "group"
        ) {

            messageData.chatType =
                "group";

            messageData.chatId =
                selectedChat;
        }


        if (replyingMessage) {

            messageData.replyToId =
                replyingMessage.id;

            messageData.replyToText =
                replyingMessage.text ||
                "";
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

        cancelReply();


    } catch (error) {

        console.error(
            "メッセージ送信エラー:",
            error
        );

        alert(
            "メッセージ送信に失敗しました。"
        );
    }
}


/* =========================================================
   画像送信
========================================================= */

const imageButton =
    document.getElementById(
        "imageButton"
    );

const imageInput =
    document.getElementById(
        "imageInput"
    );


imageButton?.addEventListener(
    "click",
    () => {
        imageInput?.click();
    }
);


imageInput?.addEventListener(
    "change",
    () => {

        const file =
            imageInput.files?.[0];

        if (!file) {
            return;
        }


        if (!selectedChat) {

            alert(
                "先にチャットを選択してください。"
            );

            imageInput.value =
                "";

            return;
        }


        if (!file.type.startsWith("image/")) {

            alert(
                "画像ファイルを選択してください。"
            );

            imageInput.value =
                "";

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            async () => {

                try {

                    const messageData = {

                        sender:
                            username,

                        text:
                            "",

                        imageData:
                            reader.result,

                        createdAt:
                            serverTimestamp(),

                        deleted:
                            false,

                        readBy:
                            [username]
                    };


                    if (
                        selectedChatType ===
                        "friend"
                    ) {

                        messageData.receiver =
                            selectedChat;

                        messageData.chatType =
                            "friend";

                        messageData.friendshipId =
                            selectedFriendshipId;
                    }


                    if (
                        selectedChatType ===
                        "group"
                    ) {

                        messageData.chatType =
                            "group";

                        messageData.chatId =
                            selectedChat;
                    }


                    await addDoc(
                        collection(
                            db,
                            "messages"
                        ),
                        messageData
                    );


                } catch (error) {

                    console.error(
                        "画像送信エラー:",
                        error
                    );

                    alert(
                        "画像の送信に失敗しました。"
                    );
                }


                imageInput.value =
                    "";
            };


        reader.readAsDataURL(file);

    }
);


/* =========================================================
   返信
========================================================= */

function startReply(
    message
) {

    replyingMessage =
        message;


    replyBar?.classList.remove(
        "hidden"
    );


    if (replyText) {

        replyText.textContent =
            message.text ||
            "画像";
    }


    messageInput?.focus();
}


cancelReplyButton?.addEventListener(
    "click",
    cancelReply
);


function cancelReply() {

    replyingMessage =
        null;


    replyBar?.classList.add(
        "hidden"
    );


    if (replyText) {
        replyText.textContent =
            "";
    }
}


/* =========================================================
   メッセージ削除
========================================================= */

async function deleteMessage(
    messageId
) {

    const ok =
        confirm(
            "このメッセージの送信を取り消しますか？"
        );


    if (!ok) {
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
                deleted: true,
                text: "",
                imageData: null
            }
        );

    } catch (error) {

        console.error(
            "メッセージ削除エラー:",
            error
        );

        alert(
            "メッセージ削除に失敗しました。"
        );
    }
}


/* =========================================================
   リアクション
========================================================= */

async function addReaction(
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
                reaction: "❤️"
            }
        );

    } catch (error) {

        console.error(
            "リアクションエラー:",
            error
        );
    }
}


/* =========================================================
   友達チャット既読
========================================================= */

async function markFriendMessagesAsRead() {

    if (
        !selectedFriendshipId ||
        !selectedChat ||
        !username
    ) {
        return;
    }


    try {

        const q =
            query(
                collection(
                    db,
                    "messages"
                ),
                where(
                    "friendshipId",
                    "==",
                    selectedFriendshipId
                )
            );


        const snapshot =
            await getDocs(q);


        const batch =
            writeBatch(db);


        let count =
            0;


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                const incoming =
                    data.sender ===
                        selectedChat &&
                    data.receiver ===
                        username;


                const read =
                    Array.isArray(
                        data.readBy
                    )
                        ? data.readBy
                        : [];


                if (
                    incoming &&
                    !read.includes(
                        username
                    )
                ) {

                    batch.update(
                        item.ref,
                        {
                            readBy: [
                                ...read,
                                username
                            ]
                        }
                    );

                    count++;
                }

            }
        );


        if (count > 0) {
            await batch.commit();
        }

    } catch (error) {

        console.error(
            "既読更新エラー:",
            error
        );
    }
}


/* =========================================================
   グループ既読
========================================================= */

async function markGroupMessagesAsRead() {

    if (
        !selectedChat ||
        !username
    ) {
        return;
    }


    try {

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
                    selectedChat
                )
            );


        const snapshot =
            await getDocs(q);


        const batch =
            writeBatch(db);


        let count =
            0;


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                const read =
                    Array.isArray(
                        data.readBy
                    )
                        ? data.readBy
                        : [];


                if (
                    data.sender !==
                        username &&
                    !read.includes(
                        username
                    )
                ) {

                    batch.update(
                        item.ref,
                        {
                            readBy: [
                                ...read,
                                username
                            ]
                        }
                    );

                    count++;
                }

            }
        );


        if (count > 0) {
            await batch.commit();
        }

    } catch (error) {

        console.error(
            "グループ既読エラー:",
            error
        );
    }
}


/* =========================================================
   全メッセージ監視
========================================================= */

function listenAllMessages() {

    if (unsubscribeAllMessages) {
        unsubscribeAllMessages();
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


    unsubscribeAllMessages =
        onSnapshot(
            q,
            () => {

                updateUnreadBadges();

            },
            error => {

                console.error(
                    "未読監視エラー:",
                    error
                );
            }
        );
}


/* =========================================================
   未読バッジ
========================================================= */

async function updateUnreadBadges() {

    if (!username) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "messages"
                )
            );


        const messages =
            snapshot.docs.map(
                item => ({
                    id: item.id,
                    ...item.data()
                })
            );


        document
            .querySelectorAll(
                ".friend-item"
            )
            .forEach(
                (row, index) => {

                    const friend =
                        friendsData[index];


                    if (!friend) {
                        return;
                    }


                    const badge =
                        row.querySelector(
                            ".unread-badge"
                        );


                    if (!badge) {
                        return;
                    }


                    let count =
                        0;


                    messages.forEach(
                        message => {

                            const incoming =
                                message.sender ===
                                    friend.friendName &&
                                message.receiver ===
                                    username;


                            const sameChat =
                                !friend.friendshipId ||
                                message.friendshipId ===
                                    friend.friendshipId;


                            const read =
                                Array.isArray(
                                    message.readBy
                                ) &&
                                message.readBy.includes(
                                    username
                                );


                            if (
                                incoming &&
                                sameChat &&
                                !read
                            ) {
                                count++;
                            }

                        }
                    );


                    if (count > 0) {

                        badge.textContent =
                            count > 99
                                ? "99+"
                                : count;

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
            "未読更新エラー:",
            error
        );
    }
}


/* =========================================================
   現在のチャット再描画
========================================================= */

async function renderCurrentMessages() {

    if (!selectedChat) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "messages"
                )
            );


        const messages =
            snapshot.docs.map(
                item => ({
                    id: item.id,
                    ...item.data()
                })
            );


        renderMessages(
            messages
        );

    } catch (error) {

        console.error(
            "チャット再描画エラー:",
            error
        );
    }
}


/* =========================================================
   通知
========================================================= */

async function initializeNotifications() {

    if (
        notificationsInitialized
    ) {
        return;
    }


    if (
        typeof Notification ===
            "undefined" ||
        !(
            "serviceWorker" in
            navigator
        )
    ) {

        console.log(
            "この環境では通知に対応していません。"
        );

        return;
    }


    try {

        messaging =
            getMessaging(
                firebaseApp
            );


        const registration =
            await navigator
                .serviceWorker
                .register(
                    "./firebase-messaging-sw.js"
                );


        const permission =
            await Notification.requestPermission();


        if (
            permission !==
            "granted"
        ) {

            console.log(
                "通知が許可されませんでした。"
            );

            return;
        }


        const token =
            await getToken(
                messaging,
                {
                    vapidKey:
                        VAPID_PUBLIC_KEY,

                    serviceWorkerRegistration:
                        registration
                }
            );


        if (
            token &&
            username
        ) {

            await setDoc(
                doc(
                    db,
                    "users",
                    username
                ),
                {
                    fcmToken:
                        token,

                    notificationsEnabled:
                        true
                },
                {
                    merge: true
                }
            );
        }


        onMessage(
            messaging,
            payload => {

                console.log(
                    "通知を受信:",
                    payload
                );


                const title =
                    payload
                        .notification
                        ?.title ||
                    "ゆうChat";


                const body =
                    payload
                        .notification
                        ?.body ||
                    "新しいメッセージが届きました。";


                if (
                    Notification.permission ===
                    "granted"
                ) {

                    new Notification(
                        title,
                        {
                            body
                        }
                    );
                }

            }
        );


        notificationsInitialized =
            true;


    } catch (error) {

        console.error(
            "通知初期化エラー:",
            error
        );
    }
}


/* =========================================================
   =========================================================
   レースシステム
   =========================================================
========================================================= */


/* ---------------------------------------------------------
   固定10頭
--------------------------------------------------------- */

const RACE_HORSES = [

    {
        number: 1,
        name: "ユウウキ",
        reading: "勇気"
    },

    {
        number: 2,
        name: "ユウセイ",
        reading: "流星"
    },

    {
        number: 3,
        name: "ユウヤン",
        reading: "夕闇"
    },

    {
        number: 4,
        name: "ユウチュウ",
        reading: "宇宙"
    },

    {
        number: 5,
        name: "ユウガ",
        reading: "優雅"
    },

    {
        number: 6,
        name: "ユウバエ",
        reading: "夕映え"
    },

    {
        number: 7,
        name: "ユウキカイ",
        reading: "勇気カイ"
    },

    {
        number: 8,
        name: "ユウマグレ",
        reading: "まぐれ"
    },

    {
        number: 9,
        name: "ユウジン",
        reading: "友人"
    },

    {
        number: 10,
        name: "ユウシャ",
        reading: "勇者"
    }

];


/* ---------------------------------------------------------
   レース状態
--------------------------------------------------------- */

const RACE_START_SCORE =
    1000;

let currentRaceId =
    null;

let currentRaceScore =
    RACE_START_SCORE;

let raceResult =
    null;

let raceTimer =
    null;


/* ---------------------------------------------------------
   決定論的乱数
--------------------------------------------------------- */

function seededRandom(
    seed
) {

    let value =
        Number(seed) >>> 0;


    value =
        (
            value *
                1664525 +
            1013904223
        ) >>> 0;


    return value /
        4294967296;
}


/* ---------------------------------------------------------
   レースシード
--------------------------------------------------------- */

function createRaceSeed(
    raceId
) {

    let hash =
        2166136261;


    for (
        let i = 0;
        i < raceId.length;
        i++
    ) {

        hash ^=
            raceId.charCodeAt(i);

        hash =
            Math.imul(
                hash,
                16777619
            );
    }


    return hash >>> 0;
}


/* ---------------------------------------------------------
   レースID
--------------------------------------------------------- */

function makeRaceId() {

    return (
        getJapanDateString() +
        "_" +
        Date.now()
    );
}


/* ---------------------------------------------------------
   レース結果生成
--------------------------------------------------------- */

function generateRaceResult(
    raceId
) {

    const seed =
        createRaceSeed(
            raceId
        );


    const horses =
        RACE_HORSES.map(
            horse => {

                const random =
                    seededRandom(
                        seed +
                        horse.number * 7919
                    );


                const condition =
                    Math.floor(
                        random * 31
                    ) - 15;


                const ability =
                    70 +
                    Math.floor(
                        seededRandom(
                            seed +
                            horse.number *
                                15485863
                        ) * 31
                    );


                const score =
                    ability +
                    condition +
                    Math.floor(
                        seededRandom(
                            seed +
                            horse.number *
                                32452843
                        ) * 20
                    );


                return {
                    ...horse,

                    ability,

                    condition,

                    score
                };

            }
        );


    horses.sort(
        (a, b) =>
            b.score -
            a.score
    );


    return {

        raceId,

        date:
            getJapanDateString(),

        seed,

        finishOrder:
            horses.map(
                horse =>
                    horse.number
            ),

        horses

    };
}


/* ---------------------------------------------------------
   レース初期化
--------------------------------------------------------- */

async function initializeRaceSystem() {

    const raceView =
        document.getElementById(
            "derbyView"
        );


    if (!raceView) {
        return;
    }


    await loadCurrentRace();

    await loadRaceRankings();

    renderRaceInfo();
}


/* ---------------------------------------------------------
   現在のレース
--------------------------------------------------------- */

async function loadCurrentRace() {

    if (!username) {
        return;
    }


    /*
       版①では日付ごとの共通レースを使用。
       同じ日なら同じ結果を見る。
    */

    const today =
        getJapanDateString();


    const raceRef =
        doc(
            db,
            "derbyRaces",
            today
        );


    try {

        const snapshot =
            await getDoc(
                raceRef
            );


        if (
            snapshot.exists()
        ) {

            raceResult =
                snapshot.data();

            currentRaceId =
                raceResult.raceId;

        } else {

            currentRaceId =
                `${today}_daily`;

            raceResult =
                generateRaceResult(
                    currentRaceId
                );


            await setDoc(
                raceRef,
                raceResult
            );
        }


        currentRaceScore =
            RACE_START_SCORE;


        await createRaceScoreRecord();


        renderRaceInfo();


    } catch (error) {

        console.error(
            "レース読み込みエラー:",
            error
        );
    }
}


/* ---------------------------------------------------------
   レーススコア記録
--------------------------------------------------------- */

async function createRaceScoreRecord() {

    if (
        !username ||
        !currentRaceId
    ) {
        return;
    }


    const ref =
        doc(
            db,
            "raceScores",
            `${currentRaceId}_${username}`
        );


    try {

        const existing =
            await getDoc(ref);


        if (
            existing.exists()
        ) {

            const data =
                existing.data();


            currentRaceScore =
                Number(
                    data.finalScore ??
                    RACE_START_SCORE
                );


            return;
        }


        await setDoc(
            ref,
            {
                username,

                raceId:
                    currentRaceId,

                date:
                    getJapanDateString(),

                startScore:
                    RACE_START_SCORE,

                finalScore:
                    RACE_START_SCORE,

                scoreChange:
                    0,

                finished:
                    false,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            }
        );


    } catch (error) {

        console.error(
            "レーススコア作成エラー:",
            error
        );
    }
}


/* ---------------------------------------------------------
   レーススコア変更
--------------------------------------------------------- */

async function changeRaceScore(
    amount
) {

    if (
        !username ||
        !currentRaceId
    ) {
        return;
    }


    const ref =
        doc(
            db,
            "raceScores",
            `${currentRaceId}_${username}`
        );


    try {

        await runTransaction(
            db,
            async transaction => {

                const snapshot =
                    await transaction.get(
                        ref
                    );


                if (
                    !snapshot.exists()
                ) {

                    transaction.set(
                        ref,
                        {
                            username,

                            raceId:
                                currentRaceId,

                            date:
                                getJapanDateString(),

                            startScore:
                                RACE_START_SCORE,

                            finalScore:
                                RACE_START_SCORE +
                                amount,

                            scoreChange:
                                amount,

                            finished:
                                false,

                            createdAt:
                                serverTimestamp(),

                            updatedAt:
                                serverTimestamp()
                        }
                    );


                    return;
                }


                const data =
                    snapshot.data();


                const oldScore =
                    Number(
                        data.finalScore ??
                        RACE_START_SCORE
                    );


                const newScore =
                    oldScore +
                    Number(amount);


                transaction.update(
                    ref,
                    {
                        finalScore:
                            newScore,

                        scoreChange:
                            newScore -
                            RACE_START_SCORE,

                        updatedAt:
                            serverTimestamp()
                    }
                );

            }
        );


        currentRaceScore +=
            Number(amount);


        updateRaceScoreDisplay();


    } catch (error) {

        console.error(
            "レーススコア更新エラー:",
            error
        );
    }
}


/* ---------------------------------------------------------
   レース終了
--------------------------------------------------------- */

async function finishRaceScore() {

    if (
        !username ||
        !currentRaceId
    ) {
        return;
    }


    const ref =
        doc(
            db,
            "raceScores",
            `${currentRaceId}_${username}`
        );


    try {

        await updateDoc(
            ref,
            {
                finalScore:
                    currentRaceScore,

                scoreChange:
                    currentRaceScore -
                    RACE_START_SCORE,

                finished:
                    true,

                finishedAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            }
        );


        await loadRaceRankings();


    } catch (error) {

        console.error(
            "レース終了処理エラー:",
            error
        );
    }
}


/* ---------------------------------------------------------
   スコア表示
--------------------------------------------------------- */

function updateRaceScoreDisplay() {

    const elements = [

        document.getElementById(
            "raceScore"
        ),

        document.getElementById(
            "currentRaceScore"
        )

    ];


    elements.forEach(
        element => {

            if (!element) {
                return;
            }


            element.textContent =
                currentRaceScore
                    .toLocaleString();

        }
    );
}


/* ---------------------------------------------------------
   レース情報表示
--------------------------------------------------------- */

function renderRaceInfo() {

    if (!raceResult) {
        return;
    }


    const raceInfo =
        document.getElementById(
            "raceInfo"
        );


    if (!raceInfo) {
        return;
    }


    raceInfo.innerHTML =
        "";


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "今回のレース結果";


    raceInfo.appendChild(
        title
    );


    const order =
        document.createElement(
            "div"
        );


    order.className =
        "race-result-order";


    raceResult.finishOrder
        .forEach(
            (number, index) => {

                const horse =
                    RACE_HORSES.find(
                        item =>
                            item.number ===
                            number
                    );


                if (!horse) {
                    return;
                }


                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "race-result-row";


                row.textContent =
                    `${index + 1}着　${horse.number}番 ${horse.name}`;


                order.appendChild(
                    row
                );

            }
        );


    raceInfo.appendChild(
        order
    );


    updateRaceScoreDisplay();
}


/* =========================================================
   本日のランキング
========================================================= */

async function loadTodayRaceRanking() {

    const element =
        document.getElementById(
            "raceTodayRanking"
        );


    if (!element) {
        return;
    }


    try {

        const today =
            getJapanDateString();


        const q =
            query(
                collection(
                    db,
                    "raceScores"
                ),
                where(
                    "date",
                    "==",
                    today
                )
            );


        const snapshot =
            await getDocs(q);


        const ranking =
            {};


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                if (!data.username) {
                    return;
                }


                if (
                    !ranking[
                        data.username
                    ]
                ) {

                    ranking[
                        data.username
                    ] = 0;
                }


                ranking[
                    data.username
                ] +=
                    Number(
                        data.scoreChange ||
                        0
                    );

            }
        );


        const sorted =
            Object.entries(
                ranking
            ).sort(
                (a, b) =>
                    b[1] -
                    a[1]
            );


        renderRaceRanking(
            element,
            sorted,
            "本日のランキング"
        );


    } catch (error) {

        console.error(
            "本日ランキングエラー:",
            error
        );
    }
}


/* =========================================================
   今までのランキング
========================================================= */

async function loadAllTimeRaceRanking() {

    const element =
        document.getElementById(
            "raceAllTimeRanking"
        );


    if (!element) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "raceScores"
                )
            );


        const ranking =
            {};


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                if (!data.username) {
                    return;
                }


                if (
                    !ranking[
                        data.username
                    ]
                ) {

                    ranking[
                        data.username
                    ] = 0;
                }


                ranking[
                    data.username
                ] +=
                    Number(
                        data.scoreChange ||
                        0
                    );

            }
        );


        const sorted =
            Object.entries(
                ranking
            ).sort(
                (a, b) =>
                    b[1] -
                    a[1]
            );


        renderRaceRanking(
            element,
            sorted,
            "今までのランキング"
        );


    } catch (error) {

        console.error(
            "歴代ランキングエラー:",
            error
        );
    }
}


/* =========================================================
   ランキング読み込み
========================================================= */

async function loadRaceRankings() {

    await Promise.all([
        loadTodayRaceRanking(),
        loadAllTimeRaceRanking()
    ]);
}


/* =========================================================
   ランキング表示
========================================================= */

function renderRaceRanking(
    container,
    ranking,
    title
) {

    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    const titleElement =
        document.createElement(
            "div"
        );

    titleElement.className =
        "race-ranking-title";

    titleElement.textContent =
        title;


    container.appendChild(
        titleElement
    );


    if (
        ranking.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-state";

        empty.textContent =
            "まだレース記録がありません。";


        container.appendChild(
            empty
        );

        return;
    }


    ranking.forEach(
        ([name, score], index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "race-ranking-item";


            const number =
                document.createElement(
                    "div"
                );

            number.className =
                "race-ranking-number";

            number.textContent =
                index + 1;


            const usernameElement =
                document.createElement(
                    "div"
                );

            usernameElement.className =
                "race-ranking-name";

            usernameElement.textContent =
                name;


            const scoreElement =
                document.createElement(
                    "div"
                );

            scoreElement.className =
                "race-ranking-score";


            const numericScore =
                Number(score);


            scoreElement.textContent =
                numericScore >= 0
                    ? `+${numericScore.toLocaleString()}`
                    : numericScore.toLocaleString();


            item.appendChild(
                number
            );

            item.appendChild(
                usernameElement
            );

            item.appendChild(
                scoreElement
            );


            container.appendChild(
                item
            );

        }
    );
}


/* =========================================================
   レースランキングタブ
========================================================= */

window.showRaceRanking =
    function(type) {

        const today =
            document.getElementById(
                "raceTodayRanking"
            );


        const all =
            document.getElementById(
                "raceAllTimeRanking"
            );


        const tabs =
            document.querySelectorAll(
                ".ranking-tab"
            );


        if (
            type ===
            "today"
        ) {

            if (today) {
                today.style.display =
                    "block";
            }

            if (all) {
                all.style.display =
                    "none";
            }


            tabs[0]?.classList.add(
                "active"
            );

            tabs[1]?.classList.remove(
                "active"
            );

        } else {

            if (today) {
                today.style.display =
                    "none";
            }

            if (all) {
                all.style.display =
                    "block";
            }


            tabs[0]?.classList.remove(
                "active"
            );

            tabs[1]?.classList.add(
                "active"
            );
        }


        loadRaceRankings();

    };


/* =========================================================
   レースを開始
========================================================= */

window.startDailyRace =
    async function() {

        if (!raceResult) {

            await loadCurrentRace();
        }


        const track =
            document.getElementById(
                "raceTrack"
            );


        if (!track) {
            return;
        }


        track.innerHTML =
            "";


        raceResult.finishOrder
            .forEach(
                (number, index) => {

                    const horse =
                        RACE_HORSES.find(
                            item =>
                                item.number ===
                                number
                        );


                    if (!horse) {
                        return;
                    }


                    const lane =
                        document.createElement(
                            "div"
                        );

                    lane.className =
                        "race-lane";


                    lane.innerHTML =
                        `
                        <span class="horse-number">
                            ${horse.number}
                        </span>

                        <span class="race-horse">
                            🐎 ${horse.name}
                        </span>
                        `;


                    track.appendChild(
                        lane
                    );


                    setTimeout(
                        () => {

                            lane.classList.add(
                                "finished"
                            );

                        },
                        1000 +
                        index * 500
                    );

                }
            );


        setTimeout(
            () => {

                finishRaceScore();

            },
            6000
        );

    };


/* =========================================================
   外部から使えるようにする
========================================================= */

window.startRaceScore =
    async function(
        raceId = null
    ) {

        currentRaceId =
            raceId ||
            makeRaceId();


        currentRaceScore =
            RACE_START_SCORE;


        await createRaceScoreRecord();

        updateRaceScoreDisplay();

    };


window.changeRaceScore =
    changeRaceScore;


window.finishRaceScore =
    finishRaceScore;


window.loadRaceRankings =
    loadRaceRankings;


window.loadTodayRaceRanking =
    loadTodayRaceRanking;


window.loadAllTimeRaceRanking =
    loadAllTimeRaceRanking;


/* =========================================================
   初期状態
========================================================= */

if (messageInput) {

    messageInput.disabled =
        true;
}


if (sendButton) {

    sendButton.disabled =
        true;
}


console.log(
    "ゆうChat script.js 版① 起動完了"
);
