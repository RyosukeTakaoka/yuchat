/* =========================================================
   ゆうChat
   script.js 完全置換版②

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
    apiKey: "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw",
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

            showError(
                loginError,
                ""
            );

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

            showError(
                loginError,
                ""
            );

            await signInAnonymously(
                auth
            );

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
                await getDoc(
                    userRef
                );


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


                await saveUserProfile();


                showApp();

            } else {

                showNameScreen();

            }

        } catch (error) {

            console.error(
                "ユーザー確認エラー:",
                error
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

    nameScreen?.classList.remove(
        "hidden"
    );

    appElement?.classList.add(
        "hidden"
    );


    if (nameInput) {

        nameInput.value =
            localStorage.getItem(
                "yuuchat_username"
            ) || "";

    }

}


startChatButton?.addEventListener(
    "click",
    async () => {

        const name =
            nameInput?.value.trim();


        showError(
            nameError,
            ""
        );


        if (!name) {

            showError(
                nameError,
                "名前を入力してください。"
            );

            return;
        }


        if (
            name.length > 20
        ) {

            showError(
                nameError,
                "名前は20文字以内にしてください。"
            );

            return;
        }


        if (
            !/^[ぁ-んァ-ヶ一-龠a-zA-Z0-9 _\-]+$/.test(
                name
            )
        ) {

            showError(
                nameError,
                "使用できない文字が含まれています。"
            );

            return;
        }


        try {

            startChatButton.disabled =
                true;


            const userRef =
                doc(
                    db,
                    "users",
                    name
                );


            const userDoc =
                await getDoc(
                    userRef
                );


            if (
                userDoc.exists() &&
                userDoc.data().uid !== currentUser?.uid
            ) {

                showError(
                    nameError,
                    "その名前はすでに使われています。"
                );

                startChatButton.disabled =
                    false;

                return;
            }


            username =
                name;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            await saveUserProfile();


            showApp();


        } catch (error) {

            console.error(
                "名前設定エラー:",
                error
            );


            showError(
                nameError,
                "名前の設定に失敗しました。"
            );

        } finally {

            startChatButton.disabled =
                false;

        }

    }
);


/* =========================================================
   ユーザープロフィール
========================================================= */

async function saveUserProfile() {

    if (
        !currentUser ||
        !username
    ) {
        return;
    }


    const userRef =
        doc(
            db,
            "users",
            username
        );


    const existing =
        await getDoc(
            userRef
        );


    const oldData =
        existing.exists()
            ? existing.data()
            : {};


    const profileImage =
        localStorage.getItem(
            "yuuchat_profile_image"
        ) || "";


    await setDoc(
        userRef,
        {
            uid:
                currentUser.uid,

            name:
                username,

            photoURL:
                currentUser.photoURL || "",

            profileImage:
                profileImage,

            online:
                true,

            lastSeen:
                serverTimestamp(),

            updatedAt:
                serverTimestamp(),

            createdAt:
                oldData.createdAt ||
                serverTimestamp()
        },
        {
            merge:
                true
        }
    );

}


function showApp() {

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
            username || "ユーザー";

    }


    loadProfileImage();

    startApp();

}


/* =========================================================
   アプリ開始
========================================================= */

async function startApp() {

    if (
        !currentUser ||
        !username
    ) {
        return;
    }


    try {

        await updateOnlineStatus(
            true
        );


        listenFriends();

        listenGroups();

        listenAllMessages();

        initializeNotifications();

        initializeRaceSystem();


    } catch (error) {

        console.error(
            "アプリ起動エラー:",
            error
        );

    }

}


/* =========================================================
   オンライン状態
========================================================= */

async function updateOnlineStatus(
    isOnline
) {

    if (
        !currentUser ||
        !username
    ) {
        return;
    }


    try {

        await updateDoc(
            doc(
                db,
                "users",
                username
            ),
            {
                online:
                    isOnline,

                lastSeen:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.error(
            "オンライン状態更新エラー:",
            error
        );

    }

}


window.addEventListener(
    "beforeunload",
    () => {

        if (
            currentUser &&
            username
        ) {

            updateOnlineStatus(
                false
            );

        }

    }
);


setInterval(
    () => {

        if (
            currentUser &&
            username
        ) {

            updateOnlineStatus(
                true
            );

        }

    },
    20000
);


/* =========================================================
   プロフィール画像
========================================================= */

profileImageInput?.addEventListener(
    "change",
    event => {

        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "画像ファイルを選択してください。"
            );

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            async () => {

                const dataURL =
                    reader.result;


                try {

                    localStorage.setItem(
                        "yuuchat_profile_image",
                        dataURL
                    );


                    loadProfileImage();


                    await saveUserProfile();


                    await updateProfileImageEverywhere(
                        dataURL
                    );


                } catch (error) {

                    console.error(
                        "プロフィール画像更新エラー:",
                        error
                    );

                    alert(
                        "プロフィール画像の更新に失敗しました。"
                    );

                }

            };


        reader.readAsDataURL(file);

    }
);

async function updateProfileImageEverywhere(
    image
) {

    if (!username) {
        return;
    }


    try {

        const friendsSnapshot =
            await getDocs(
                collection(
                    db,
                    "friends"
                )
            );


        const batch =
            writeBatch(db);


        let count =
            0;


        friendsSnapshot.forEach(
            item => {

                const data =
                    item.data();


                if (
                    data.user1 === username
                ) {

                    batch.update(
                        item.ref,
                        {
                            user1Photo:
                                image
                        }
                    );

                    count++;

                }


                if (
                    data.user2 === username
                ) {

                    batch.update(
                        item.ref,
                        {
                            user2Photo:
                                image
                        }
                    );

                    count++;

                }

            }
        );


        if (
            count > 0
        ) {

            await batch.commit();

        }

    } catch (error) {

        console.error(
            "プロフィール画像同期エラー:",
            error
        );

    }

}


/* =========================================================
   名前変更
========================================================= */

changeNameButton?.addEventListener(
    "click",
    async () => {

        if (!username) {
            return;
        }


        const newName =
            prompt(
                "新しい名前を入力してください。",
                username
            );


        if (
            newName === null
        ) {
            return;
        }


        const trimmed =
            newName.trim();


        if (!trimmed) {

            alert(
                "名前を入力してください。"
            );

            return;
        }


        if (
            trimmed === username
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

            const newUserRef =
                doc(
                    db,
                    "users",
                    trimmed
                );

                if (
                existing.exists() &&
                existing.data().uid !== currentUser.uid
            ) {

                alert(
                    "その名前はすでに使われています。"
                );

                return;
            }


            const oldName =
                username;


            await setDoc(
                newUserRef,
                {
                    uid:
                        currentUser.uid,

                    name:
                        trimmed,

                    photoURL:
                        currentUser.photoURL || "",

                    profileImage:
                        localStorage.getItem(
                            "yuuchat_profile_image"
                        ) || "",

                    online:
                        true,

                    lastSeen:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp(),

                    createdAt:
                        serverTimestamp()
                }
            );


            username =
                trimmed;


            localStorage.setItem(
                "yuuchat_username",
                username
            );


            await migrateUsername(
                oldName,
                username
            );


            try {

                await deleteDoc(
                    doc(
                        db,
                        "users",
                        oldName
                    )
                );

            } catch (error) {

                console.warn(
                    "旧ユーザーデータ削除失敗:",
                    error
                );

            }


            if (myName) {

                myName.textContent =
                    username;

            }


            alert(
                "名前を変更しました。"
            );


            listenFriends();
            listenGroups();
            listenAllMessages();


        } catch (error) {

            console.error(
                "名前変更エラー:",
                error
            );


            alert(
                "名前の変更に失敗しました。"
            );

        }

    }
);


/* =========================================================
   名前変更時のデータ移行
========================================================= */

async function migrateUsername(
    oldName,
    newName
) {

    if (
        !oldName ||
        !newName ||
        oldName === newName
    ) {
        return;
    }


    try {

        /* -------------------------
           友達データ
        ------------------------- */

        const friendsSnapshot =
            await getDocs(
                collection(
                    db,
                    "friends"
                )
            );


        const friendBatch =
            writeBatch(db);


        let friendChanged =
            false;


        friendsSnapshot.forEach(
            friendDoc => {

                const data =
                    friendDoc.data();


                const updateData =
                    {};


                if (
                    data.user1 === oldName
                ) {

                    updateData.user1 =
                        newName;

                }


                if (
                    data.user2 === oldName
                ) {

                    updateData.user2 =
                        newName;

                }


                if (
                    data.requestedBy === oldName
                ) {

                    updateData.requestedBy =
                        newName;

                }


                if (
                    data.acceptedBy === oldName
                ) {

                    updateData.acceptedBy =
                        newName;

                }


                if (
                    Object.keys(
                        updateData
                    ).length > 0
                ) {

                    updateData.updatedAt =
                        serverTimestamp();


                    friendBatch.update(
                        friendDoc.ref,
                        updateData
                    );


                    friendChanged =
                        true;

                }

            }
        );


        if (friendChanged) {

            await friendBatch.commit();

        }


        /* -------------------------
           グループデータ
        ------------------------- */

        const groupsSnapshot =
            await getDocs(
                collection(
                    db,
                    "groups"
                )
            );


        const groupBatch =
            writeBatch(db);


        let groupChanged =
            false;


        groupsSnapshot.forEach(
            groupDoc => {

                const data =
                    groupDoc.data();


                const members =
                    Array.isArray(
                        data.members
                    )
                        ? [...data.members]
                        : [];


                const newMembers =
                    members.map(
                        member =>
                            member === oldName
                                ? newName
                                : member
                    );


                const updateData =
                    {};


                if (
                    JSON.stringify(
                        members
                    ) !==
                    JSON.stringify(
                        newMembers
                    )
                ) {

                    updateData.members =
                        newMembers;

                }


                if (
                    data.owner === oldName
                ) {

                    updateData.owner =
                        newName;

                }


                if (
                    Object.keys(
                        updateData
                    ).length > 0
                ) {

                    updateData.updatedAt =
                        serverTimestamp();


                    groupBatch.update(
                        groupDoc.ref,
                        updateData
                    );


                    groupChanged =
                        true;

                }

            }
        );


        if (groupChanged) {

            await groupBatch.commit();

        }


        /* -------------------------
           メッセージデータ
        ------------------------- */

        const messagesSnapshot =
            await getDocs(
                collection(
                    db,
                    "messages"
                )
            );


        const messageBatch =
            writeBatch(db);


        let messageChanged =
            false;


        messagesSnapshot.forEach(
            messageDoc => {

                const data =
                    messageDoc.data();


                const updateData =
                    {};


                if (
                    data.sender === oldName
                ) {

                    updateData.sender =
                        newName;

                }


                if (
                    data.username === oldName
                ) {

                    updateData.username =
                        newName;

                }


                if (
                    data.receiver === oldName
                ) {

                    updateData.receiver =
                        newName;

                }


                if (
                    data.replyToUsername === oldName
                ) {

                    updateData.replyToUsername =
                        newName;

                }


                if (
                    Object.keys(
                        updateData
                    ).length > 0
                ) {

                    messageBatch.update(
                        messageDoc.ref,
                        updateData
                    );


                    messageChanged =
                        true;

                }

            }
        );


        if (messageChanged) {

            await messageBatch.commit();

        }


    } catch (error) {

        console.error(
            "名前変更データ移行エラー:",
            error
        );

        throw error;

    }

}


/* =========================================================
   友達一覧リアルタイム監視
========================================================= */

function listenFriends() {

    if (!username) {
        return;
    }


    if (unsubscribeFriends) {

        unsubscribeFriends();

        unsubscribeFriends =
            null;

    }


    const friendsRef =
        collection(
            db,
            "friends"
        );


    const q =
        query(
            friendsRef
        );


    unsubscribeFriends =
        onSnapshot(
            q,
            snapshot => {

                const friends =
                    [];


                snapshot.forEach(
                    item => {

                        const data =
                            item.data();


                        if (
                            data.user1 === username
                        ) {

                            friends.push(
                                {
                                    id:
                                        item.id,

                                    friend:
                                        data.user2,

                                    friendshipId:
                                        item.id,

                                    online:
                                        data.user2Online ||
                                        false,

                                    photo:
                                        data.user2Photo ||
                                        ""
                                }
                            );

                        }


                        if (
                            data.user2 === username
                        ) {

                            friends.push(
                                {
                                    id:
                                        item.id,

                                    friend:
                                        data.user1,

                                    friendshipId:
                                        item.id,

                                    online:
                                        data.user1Online ||
                                        false,

                                    photo:
                                        data.user1Photo ||
                                        ""
                                }
                            );

                        }

                    }
                );


                friendsData =
                    friends;


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


    if (
        friendsData.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-state";


        empty.textContent =
            "友達がいません";


        friendsList.appendChild(
            empty
        );


        return;

    }


    friendsData.forEach(
        friend => {

            const item =
                document.createElement(
                    "button"
                );


            item.type =
                "button";


            item.className =
                "friend-item";


            if (
                selectedChatType === "friend" &&
                selectedChat === friend.friend
            ) {

                item.classList.add(
                    "active"
                );

            }


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "friend-avatar";


            if (
                friend.photo
            ) {

                avatar.style.backgroundImage =
                    `url("${friend.photo}")`;

            } else {

                avatar.textContent =
                    friend.friend
                        ?.charAt(0)
                        ?.toUpperCase() ||
                    "?";

            }


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "friend-info";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "friend-name";


            name.textContent =
                friend.friend;


            const status =
                document.createElement(
                    "div"
                );


            status.className =
                "friend-status";


            status.textContent =
                friend.online
                    ? "オンライン"
                    : "オフライン";


            info.appendChild(
                name
            );


            info.appendChild(
                status
            );


            item.appendChild(
                avatar
            );


            item.appendChild(
                info
            );


            item.addEventListener(
                "click",
                () => {

                    selectFriendChat(
                        friend
                    );

                }
            );


            item.addEventListener(
                "contextmenu",
                async event => {

                    event.preventDefault();


                    const confirmed =
                        confirm(
                            `${friend.friend}を友達から削除しますか？`
                        );


                    if (!confirmed) {
                        return;
                    }


                    await deleteFriend(
                        friend
                    );

                }
            );


            friendsList.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   友達追加
========================================================= */

addFriendButton?.addEventListener(
    "click",
    async () => {

        const friendName =
            prompt(
                "追加したい友達の名前を入力してください。"
            );


        if (
            friendName === null
        ) {
            return;
        }


        const trimmed =
            friendName.trim();


        if (!trimmed) {

            alert(
                "名前を入力してください。"
            );

            return;
        }


        if (
            trimmed === username
        ) {

            alert(
                "自分自身は追加できません。"
            );

            return;
        }


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    trimmed
                );


            const userDoc =
                await getDoc(
                    userRef
                );


            if (
                !userDoc.exists()
            ) {

                alert(
                    "そのユーザーは見つかりません。"
                );

                return;
            }


            const userData =
                userDoc.data();


            const friendshipId =
                [
                    username,
                    trimmed
                ]
                .sort()
                .join("_");


            const friendshipRef =
                doc(
                    db,
                    "friends",
                    friendshipId
                );


            const existing =
                await getDoc(
                    friendshipRef
                );


            if (
                existing.exists()
            ) {

                alert(
                    "すでに友達です。"
                );

                return;
            }


            const myImage =
                localStorage.getItem(
                    "yuuchat_profile_image"
                ) || "";


            await setDoc(
                friendshipRef,
                {
                    user1:
                        username,

                    user2:
                        trimmed,

                    user1Uid:
                        currentUser.uid,

                    user2Uid:
                        userData.uid,

                    user1Online:
                        true,

                    user2Online:
                        userData.online ||
                        false,

                    user1Photo:
                        myImage,

                    user2Photo:
                        userData.profileImage ||
                        "",

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                }
            );


            alert(
                `${trimmed}を友達に追加しました。`
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
    friend
) {

    if (
        !friend?.friendshipId
    ) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "friends",
                friend.friendshipId
            )
        );


        if (
            selectedChat === friend.friend
        ) {

            resetChat();

        }


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
   グループ一覧リアルタイム監視
========================================================= */

function listenGroups() {

    if (!username) {
        return;
    }


    if (unsubscribeGroups) {

        unsubscribeGroups();

        unsubscribeGroups =
            null;

    }


    const groupsRef =
        collection(
            db,
            "groups"
        );


    const q =
        query(
            groupsRef,
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
                            id:
                                item.id,

                            ...item.data()
                        })
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
   グループ一覧表示
========================================================= */

function renderGroups() {

    if (!groupsList) {
        return;
    }


    groupsList.innerHTML =
        "";


    if (
        groupsData.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-state";


        empty.textContent =
            "グループがありません";


        groupsList.appendChild(
            empty
        );


        return;

    }


    groupsData.forEach(
        group => {

            const item =
                document.createElement(
                    "button"
                );


            item.type =
                "button";


            item.className =
                "group-item";


            if (
                selectedChatType === "group" &&
                selectedChat === group.id
            ) {

                item.classList.add(
                    "active"
                );

            }


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "group-avatar";


            avatar.textContent =
                "👥";


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "group-info";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "group-name";


            name.textContent =
                group.name ||
                "グループ";


            const members =
                document.createElement(
                    "div"
                );


            members.className =
                "group-members";


            const memberCount =
                Array.isArray(
                    group.members
                )
                    ? group.members.length
                    : 0;


            members.textContent =
                `${memberCount}人`;


            info.appendChild(
                name
            );


            info.appendChild(
                members
            );


            item.appendChild(
                avatar
            );


            item.appendChild(
                info
            );


            item.addEventListener(
                "click",
                () => {

                    selectGroupChat(
                        group
                    );

                }
            );


            groupsList.appendChild(
                item
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

        const groupName =
            prompt(
                "グループ名を入力してください。"
            );


        if (
            groupName === null
        ) {
            return;
        }


        const trimmed =
            groupName.trim();


        if (!trimmed) {

            alert(
                "グループ名を入力してください。"
            );

            return;
        }


        if (
            trimmed.length > 30
        ) {

            alert(
                "グループ名は30文字以内にしてください。"
            );

            return;
        }


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
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()
                    }
                );


            const newGroup =
                {
                    id:
                        groupRef.id,

                    name:
                        trimmed,

                    owner:
                        username,

                    members:
                        [username]
                };


            alert(
                `${trimmed}を作成しました。`
            );


            selectGroupChat(
                newGroup
            );


        } catch (error) {

            console.error(
                "グループ作成エラー:",
                error
            );


            alert(
                "グループの作成に失敗しました。"
            );

        }

    }
);


/* =========================================================
   グループチャット選択
========================================================= */

function selectGroupChat(
    group
) {

    if (!group) {
        return;
    }


    selectedChatType =
        "group";


    selectedChat =
        group.id;


    selectedFriendshipId =
        null;


    replyingMessage =
        null;


    updateReplyBar();


    if (chatHeader) {

        chatHeader.textContent =
            group.name ||
            "グループ";

    }


    renderFriends();

    renderGroups();

    listenSelectedChatMessages();

}


/* =========================================================
   友達チャット選択
========================================================= */

function selectFriendChat(
    friend
) {

    if (!friend) {
        return;
    }


    selectedChatType =
        "friend";


    selectedChat =
        friend.friend;


    selectedFriendshipId =
        friend.friendshipId;


    replyingMessage =
        null;


    updateReplyBar();


    if (chatHeader) {

        chatHeader.textContent =
            friend.friend;

    }


    renderFriends();

    renderGroups();

    listenSelectedChatMessages();

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


    replyingMessage =
        null;


    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages =
            null;

    }


    if (chatHeader) {

        chatHeader.textContent =
            "チャット";

    }


    if (messagesElement) {

        messagesElement.innerHTML =
            `
            <div class="empty-state">
                チャットを選択してください
            </div>
            `;

    }


    updateReplyBar();

    renderFriends();

    renderGroups();

}


/* =========================================================
   全メッセージ監視
========================================================= */

function listenAllMessages() {

    if (unsubscribeAllMessages) {

        unsubscribeAllMessages();

        unsubscribeAllMessages =
            null;

    }


    if (!username) {
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


    unsubscribeAllMessages =
        onSnapshot(
            q,
            snapshot => {

                const messages =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                if (
                    selectedChat
                ) {

                    renderSelectedMessages(
                        messages
                    );

                }

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
   選択中チャット監視
========================================================= */

function listenSelectedChatMessages() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages =
            null;

    }


    if (
        !username ||
        !selectedChat
    ) {
        return;
    }


    if (messagesElement) {

        messagesElement.innerHTML =
            `
            <div class="loading">
                読み込み中...
            </div>
            `;

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
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                renderSelectedMessages(
                    messages
                );


                markMessagesAsRead(
                    messages
                );

            },
            error => {

                console.error(
                    "チャット読み込みエラー:",
                    error
                );


                if (messagesElement) {

                    messagesElement.innerHTML =
                        `
                        <div class="empty-state">
                            メッセージの読み込みに失敗しました
                        </div>
                        `;

                }

            }
        );

}


/* =========================================================
   選択中チャット判定
========================================================= */

function isMessageForSelectedChat(
    message
) {

    if (
        !message ||
        !selectedChat
    ) {

        return false;

    }


    if (
        selectedChatType === "group"
    ) {

        return (
            message.type === "group" &&
            message.groupId === selectedChat
        );

    }


    if (
        selectedChatType === "friend"
    ) {

        const sender =
            message.sender ||
            message.username;


        const receiver =
            message.receiver;


        if (
            selectedFriendshipId &&
            message.friendshipId
        ) {

            return (
                message.friendshipId ===
                selectedFriendshipId
            );

        }


        return (
            (
                sender === username &&
                receiver === selectedChat
            ) ||
            (
                sender === selectedChat &&
                receiver === username
            )
        );

    }


    return false;

}


/* =========================================================
   メッセージ一覧表示
========================================================= */

function renderSelectedMessages(
    allMessages
) {

    if (!messagesElement) {
        return;
    }


    const messages =
        allMessages.filter(
            message =>
                isMessageForSelectedChat(
                    message
                )
        );


    messagesElement.innerHTML =
        "";


    if (
        messages.length === 0
    ) {

        messagesElement.innerHTML =
            `
            <div class="empty-state">
                まだメッセージがありません
            </div>
            `;

        return;

    }


    messages.forEach(
        message => {

            renderMessage(
                message
            );

        }
    );


    requestAnimationFrame(
        () => {

            messagesElement.scrollTop =
                messagesElement.scrollHeight;

        }
    );

}


/* =========================================================
   メッセージ描画
========================================================= */

function renderMessage(
    message
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "message-wrapper";


    const senderName =
        message.sender ||
        message.username ||
        "";


    const isMine =
        senderName === username;


    wrapper.classList.add(
        isMine
            ? "mine"
            : "other"
    );


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "message-bubble";


    if (
        message.deleted
    ) {

        const deleted =
            document.createElement(
                "div"
            );


        deleted.className =
            "deleted-message";


        deleted.textContent =
            "このメッセージは送信を取り消しました";


        bubble.appendChild(
            deleted
        );

    } else {

        if (
            selectedChatType === "group" &&
            senderName &&
            senderName !== username
        ) {

            const sender =
                document.createElement(
                    "div"
                );


            sender.className =
                "message-sender";


            sender.textContent =
                senderName;


            bubble.appendChild(
                sender
            );

        }


        if (
            message.replyTo
        ) {

            const reply =
                document.createElement(
                    "div"
                );


            reply.className =
                "message-reply";


            reply.textContent =
                message.replyTo.text ||
                "返信";


            bubble.appendChild(
                reply
            );

        }


        if (
            message.image
        ) {

            const image =
                document.createElement(
                    "img"
                );


            image.className =
                "message-image";


            image.src =
                message.image;


            image.alt =
                "送信された画像";


            image.loading =
                "lazy";


            image.addEventListener(
                "click",
                () => {

                    const newWindow =
                        window.open(
                            "",
                            "_blank"
                        );


                    if (newWindow) {

                        newWindow.document.write(
                            `
                            <title>画像</title>
                            <img
                                src="${message.image}"
                                style="
                                    max-width:100%;
                                    max-height:100vh;
                                    display:block;
                                    margin:auto;
                                "
                            >
                            `
                        );

                    }

                }
            );


            bubble.appendChild(
                image
            );

        }


        if (
            message.text
        ) {

            const text =
                document.createElement(
                    "div"
                );


            text.className =
                "message-text";


            text.textContent =
                message.text;


            bubble.appendChild(
                text
            );

        }


        if (
            message.reactions
        ) {

            renderReactions(
                bubble,
                message
            );

        }

    }


    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "message-meta";


    meta.textContent =
        formatMessageTime(
            message.createdAt
        );


    bubble.appendChild(
        meta
    );


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


        replyButton.type =
            "button";


        replyButton.textContent =
            "返信";


        replyButton.addEventListener(
            "click",
            () => {

                setReplyMessage(
                    message
                );

            }
        );


        const reactionButton =
            document.createElement(
                "button"
            );


        reactionButton.type =
            "button";


        reactionButton.textContent =
            "😊";


        reactionButton.addEventListener(
            "click",
            () => {

                addReaction(
                    message
                );

            }
        );


        actions.appendChild(
            replyButton
        );


        actions.appendChild(
            reactionButton
        );


        if (isMine) {

            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.textContent =
                "取消";


            deleteButton.addEventListener(
                "click",
                () => {

                    unsendMessage(
                        message.id
                    );

                }
            );


            actions.appendChild(
                deleteButton
            );

        }


        bubble.appendChild(
            actions
        );

    }


    wrapper.appendChild(
        bubble
    );


    messagesElement.appendChild(
        wrapper
    );

}


/* =========================================================
   メッセージ時刻
========================================================= */

function formatMessageTime(
    timestamp
) {

    if (!timestamp) {
        return "";
    }


    try {

        let date;


        if (
            typeof timestamp.toDate ===
            "function"
        ) {

            date =
                timestamp.toDate();

        } else if (
            timestamp instanceof Date
        ) {

            date =
                timestamp;

        } else {

            date =
                new Date(timestamp);

        }


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        return new Intl.DateTimeFormat(
            "ja-JP",
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        ).format(
            date
        );

    } catch (error) {

        return "";

    }

}

/* =========================================================
   返信機能
========================================================= */

function setReplyMessage(message) {

    if (!message) {
        return;
    }

    replyingMessage = {
        id: message.id,
        text:
            message.text ||
            (message.image ? "画像" : "")
    };

    updateReplyBar();

    if (messageInput) {
        messageInput.focus();
    }
}


/* =========================================================
   返信バー表示
========================================================= */

function updateReplyBar() {

    if (!replyBar) {
        return;
    }

    if (!replyingMessage) {

        replyBar.classList.add("hidden");

        if (replyText) {
            replyText.textContent = "";
        }

        return;
    }

    replyBar.classList.remove("hidden");

    if (replyText) {

        replyText.textContent =
            `「${replyingMessage.text || "メッセージ"}」に返信`;
    }
}


/* =========================================================
   返信キャンセル
========================================================= */

cancelReplyButton?.addEventListener(
    "click",
    () => {

        replyingMessage = null;

        updateReplyBar();

    }
);


/* =========================================================
   リアクション表示
========================================================= */

function renderReactions(
    bubble,
    message
) {

    const reactions =
        message.reactions || {};


    const entries =
        Object.entries(
            reactions
        );


    if (entries.length === 0) {
        return;
    }


    const container =
        document.createElement(
            "div"
        );


    container.className =
        "message-reactions";


    entries.forEach(
        ([emoji, users]) => {

            if (
                !Array.isArray(users) ||
                users.length === 0
            ) {
                return;
            }


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "reaction-item";


            button.textContent =
                `${emoji} ${users.length}`;


            button.addEventListener(
                "click",
                () => {

                    toggleReaction(
                        message,
                        emoji
                    );

                }
            );


            container.appendChild(
                button
            );

        }
    );


    if (
        container.children.length > 0
    ) {

        bubble.appendChild(
            container
        );

    }

}


/* =========================================================
   リアクション追加
========================================================= */

async function addReaction(
    message
) {

    if (!message?.id) {
        return;
    }


    const emoji =
        prompt(
            "リアクションを入力してください\n\n😊 😂 👍 ❤️ 😮 😢 🎉"
        );


    if (!emoji) {
        return;
    }


    const selectedEmoji =
        emoji.trim();


    if (!selectedEmoji) {
        return;
    }


    await toggleReaction(
        message,
        selectedEmoji
    );

}


/* =========================================================
   リアクション切り替え
========================================================= */

async function toggleReaction(
    message,
    emoji
) {

    if (
        !currentUser ||
        !message?.id ||
        !emoji
    ) {
        return;
    }


    try {

        const messageRef =
            doc(
                db,
                "messages",
                message.id
            );


        const snapshot =
            await getDoc(
                messageRef
            );


        if (!snapshot.exists()) {
            return;
        }


        const data =
            snapshot.data();


        const reactions =
            {
                ...(data.reactions || {})
            };


        const users =
            Array.isArray(
                reactions[emoji]
            )
                ? [
                    ...reactions[emoji]
                ]
                : [];


        const index =
            users.indexOf(
                username
            );


        if (index >= 0) {

            users.splice(
                index,
                1
            );

        } else {

            users.push(
                username
            );

        }


        if (users.length === 0) {

            delete reactions[emoji];

        } else {

            reactions[emoji] =
                users;

        }


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


/* =========================================================
   送信取り消し
========================================================= */

async function unsendMessage(
    messageId
) {

    if (
        !currentUser ||
        !messageId
    ) {
        return;
    }


    const ok =
        confirm(
            "このメッセージの送信を取り消しますか？"
        );


    if (!ok) {
        return;
    }


    try {

        const messageRef =
            doc(
                db,
                "messages",
                messageId
            );


        const snapshot =
            await getDoc(
                messageRef
            );


        if (!snapshot.exists()) {
            return;
        }


        const data =
            snapshot.data();


        const sender =
            data.sender ||
            data.username;


        if (
            sender !== username
        ) {

            alert(
                "自分が送信したメッセージだけ取り消せます。"
            );

            return;
        }


        await updateDoc(
            messageRef,
            {
                deleted:
                    true,

                deletedAt:
                    serverTimestamp()
            }
        );


    } catch (error) {

        console.error(
            "送信取り消しエラー:",
            error
        );


        alert(
            "送信取り消しに失敗しました。"
        );

    }

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
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


/* =========================================================
   メッセージ送信本体
========================================================= */

async function sendMessage() {

    if (
        !currentUser ||
        !username
    ) {
        return;
    }


    if (
        !selectedChat ||
        !selectedChatType
    ) {

        alert(
            "友達またはグループを選択してください。"
        );

        return;
    }


    const text =
        messageInput
            ?.value
            ?.trim() || "";


    const image =
        pendingImageData || null;


    if (
        !text &&
        !image
    ) {
        return;
    }


    try {

        const messageData = {

            sender:
                username,

            senderUid:
                currentUser.uid,

            text:
                text,

            image:
                image,

            type:
                selectedChatType,

            createdAt:
                serverTimestamp(),

            deleted:
                false

        };


        if (
            selectedChatType ===
            "friend"
        ) {

            messageData.receiver =
                selectedChat;

            messageData.friendshipId =
                selectedFriendshipId ||
                createFriendshipId(
                    username,
                    selectedChat
                );

        }


        if (
            selectedChatType ===
            "group"
        ) {

            messageData.groupId =
                selectedChat;

        }


        if (
            replyingMessage
        ) {

            messageData.replyTo =
                {
                    id:
                        replyingMessage.id,

                    text:
                        replyingMessage.text ||
                        ""
                };

        }


        await addDoc(
            collection(
                db,
                "messages"
            ),
            messageData
        );


        if (messageInput) {

            messageInput.value =
                "";

        }


        pendingImageData =
            null;


        if (imageInput) {

            imageInput.value =
                "";

        }


        replyingMessage =
            null;


        updateReplyBar();


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


/* =========================================================
   画像選択
========================================================= */

imageButton?.addEventListener(
    "click",
    () => {

        imageInput?.click();

    }
);


imageInput?.addEventListener(
    "change",
    async event => {

        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "画像ファイルを選択してください。"
            );

            return;
        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            alert(
                "画像は5MB以下にしてください。"
            );

            imageInput.value =
                "";

            return;
        }


        try {

            pendingImageData =
                await readFileAsDataURL(
                    file
                );


            if (messageInput) {

                messageInput.placeholder =
                    "画像を選択しました。送信できます";

            }

        } catch (error) {

            console.error(
                "画像読み込みエラー:",
                error
            );


            pendingImageData =
                null;

        }

    }
);


/* =========================================================
   ファイル → Data URL
========================================================= */

function readFileAsDataURL(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        reader.error
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   友達ID生成
========================================================= */

function createFriendshipId(
    userA,
    userB
) {

    return [
        userA,
        userB
    ]
        .sort(
            (a, b) =>
                a.localeCompare(b)
        )
        .join("__");

}


/* =========================================================
   既読処理
========================================================= */

async function markMessagesAsRead(
    messages
) {

    if (
        !currentUser ||
        !username
    ) {
        return;
    }


    const unread =
        messages.filter(
            message => {

                if (
                    !isMessageForSelectedChat(
                        message
                    )
                ) {
                    return false;
                }


                const sender =
                    message.sender ||
                    message.username;


                if (
                    sender === username
                ) {
                    return false;
                }


                const readBy =
                    Array.isArray(
                        message.readBy
                    )
                        ? message.readBy
                        : [];


                return !readBy.includes(
                    username
                );

            }
        );


    if (
        unread.length === 0
    ) {
        return;
    }


    try {

        const batch =
            writeBatch(db);


        unread.forEach(
            message => {

                const messageRef =
                    doc(
                        db,
                        "messages",
                        message.id
                    );


                const readBy =
                    Array.isArray(
                        message.readBy
                    )
                        ? [
                            ...message.readBy
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


                    batch.update(
                        messageRef,
                        {
                            readBy:
                                readBy
                        }
                    );

                }

            }
        );


        await batch.commit();


    } catch (error) {

        console.error(
            "既読更新エラー:",
            error
        );

    }

}

/* =========================================================
   通知システム
========================================================= */

async function initializeNotifications() {

    if (
        notificationsInitialized ||
        !currentUser
    ) {
        return;
    }

    notificationsInitialized =
        true;

    try {

        if (
            typeof Notification ===
            "undefined"
        ) {
            return;
        }


        if (
            Notification.permission ===
            "default"
        ) {

            const permission =
                await Notification.requestPermission();

            if (
                permission !== "granted"
            ) {
                return;
            }

        }


        if (
            Notification.permission !==
            "granted"
        ) {
            return;
        }


        if (
            !("serviceWorker" in navigator)
        ) {
            return;
        }


        const registration =
            await navigator.serviceWorker.register(
                "./firebase-messaging-sw.js"
            );


        const messaging =
            getMessaging(
                app
            );


        const token =
            await getToken(
                messaging,
                {
                    vapidKey:
                        "BNKlLucsJnYok43m4muAEkcQq8cOcNrUKFyNYkCeo2jKhm1RwJVAU6tC7p3PjoaidOU08Hh7oEeRz43S8X73Ppw",

                    serviceWorkerRegistration:
                        registration
                }
            );


        if (token) {

            await saveNotificationToken(
                token
            );

        }


        onMessage(
            messaging,
            payload => {

                console.log(
                    "通知を受信:",
                    payload
                );


                showInAppNotification(
                    payload
                );

            }
        );


    } catch (error) {

        console.error(
            "通知初期化エラー:",
            error
        );

    }

}


/* =========================================================
   通知トークン保存
========================================================= */

async function saveNotificationToken(
    token
) {

    if (
        !currentUser ||
        !token
    ) {
        return;
    }


    try {

        await setDoc(
            doc(
                db,
                "users",
                currentUser.uid
            ),
            {
                notificationToken:
                    token,

                notificationUpdatedAt:
                    serverTimestamp()
            },
            {
                merge:
                    true
            }
        );


    } catch (error) {

        console.error(
            "通知トークン保存エラー:",
            error
        );

    }

}


/* =========================================================
   アプリ内通知
========================================================= */

function showInAppNotification(
    payload
) {

    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "notification";


    const title =
        payload?.notification?.title ||
        payload?.data?.title ||
        "ゆうChat";


    const body =
        payload?.notification?.body ||
        payload?.data?.body ||
        "新しい通知があります。";


    notification.innerHTML =
        `
        <div class="notification-title"></div>
        <div class="notification-body"></div>
        `;


    const titleElement =
        notification.querySelector(
            ".notification-title"
        );


    const bodyElement =
        notification.querySelector(
            ".notification-body"
        );


    if (titleElement) {

        titleElement.textContent =
            title;

    }


    if (bodyElement) {

        bodyElement.textContent =
            body;

    }


    document.body.appendChild(
        notification
    );


    requestAnimationFrame(
        () => {

            notification.classList.add(
                "show"
            );

        }
    );


    setTimeout(
        () => {

            notification.classList.remove(
                "show"
            );


            setTimeout(
                () => {

                    notification.remove();

                },
                300
            );

        },
        4000
    );

}


/* =========================================================
   タブ切り替え
========================================================= */

const tabButtons =
    document.querySelectorAll(
        ".tab-button"
    );


tabButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const view =
                    button.dataset.view;


                if (!view) {
                    return;
                }


                switchView(
                    view
                );

            }
        );

    }
);


/* =========================================================
   画面切り替え
========================================================= */

function switchView(
    view
) {

    const views = {

        chat:
            chatView,

        derby:
            derbyView,

        games:
            gamesView,

        mypage:
            mypageView

    };


    Object.entries(
        views
    ).forEach(
        ([name, element]) => {

            if (!element) {
                return;
            }


            if (
                name === view
            ) {

                element.classList.remove(
                    "hidden"
                );

            } else {

                element.classList.add(
                    "hidden"
                );

            }

        }
    );


    tabButtons.forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.view ===
                    view
            );

        }
    );


    if (
        view === "mypage"
    ) {

        loadMyPage();

    }


    if (
        view === "derby"
    ) {

        renderRaceInfo();

    }


    if (
        view === "games"
    ) {

        loadGameRooms();

    }

}


/* =========================================================
   プロフィール画像読み込み
========================================================= */

function loadProfileImage() {

    if (!currentUser) {
        return;
    }


    const key =
        `yuuchat_profile_${currentUser.uid}`;


    const savedImage =
        localStorage.getItem(
            key
        );


    if (
        savedImage &&
        myProfileImage
    ) {

        myProfileImage.src =
            savedImage;


        myProfileImage.classList.remove(
            "hidden"
        );


        profileImagePlaceholder?.classList.add(
            "hidden"
        );

    } else {

        myProfileImage?.classList.add(
            "hidden"
        );


        profileImagePlaceholder?.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   プロフィール画像変更
========================================================= */

myProfileImage?.addEventListener(
    "click",
    () => {

        profileImageInput?.click();

    }
);


profileImagePlaceholder?.addEventListener(
    "click",
    () => {

        profileImageInput?.click();

    }
);


profileImageInput?.addEventListener(
    "change",
    event => {

        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "画像ファイルを選択してください。"
            );

            return;
        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            alert(
                "画像は5MB以下にしてください。"
            );

            profileImageInput.value =
                "";

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            event => {

                const imageData =
                    event.target.result;


                const key =
                    `yuuchat_profile_${currentUser.uid}`;


                localStorage.setItem(
                    key,
                    imageData
                );


                loadProfileImage();

            };


        reader.onerror =
            () => {

                alert(
                    "画像の読み込みに失敗しました。"
                );

            };


        reader.readAsDataURL(
            file
        );

    }
);


/* =========================================================
   名前変更ボタン
========================================================= */

changeNameButton?.addEventListener(
    "click",
    async () => {

        if (
            !currentUser ||
            !username
        ) {
            return;
        }


        const newName =
            prompt(
                "新しい名前を入力してください。",
                username
            );


        if (
            newName === null
        ) {
            return;
        }


        const trimmed =
            newName.trim();


        if (!trimmed) {

            alert(
                "名前を入力してください。"
            );

            return;
        }


        if (
            trimmed === username
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

            await changeUsername(
                trimmed
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

    }
);


/* =========================================================
   ログアウト
========================================================= */

logoutButton?.addEventListener(
    "click",
    async () => {

        const ok =
            confirm(
                "ログアウトしますか？"
            );


        if (!ok) {
            return;
        }


        try {

            if (
                unsubscribeFriends
            ) {

                unsubscribeFriends();

                unsubscribeFriends =
                    null;

            }


            if (
                unsubscribeGroups
            ) {

                unsubscribeGroups();

                unsubscribeGroups =
                    null;

            }


            if (
                unsubscribeMessages
            ) {

                unsubscribeMessages();

                unsubscribeMessages =
                    null;

            }


            if (
                unsubscribeAllMessages
            ) {

                unsubscribeAllMessages();

                unsubscribeAllMessages =
                    null;

            }


            await signOut(
                auth
            );


        } catch (error) {

            console.error(
                "ログアウトエラー:",
                error
            );


            alert(
                "ログアウトに失敗しました。"
            );

        }

    }
);


/* =========================================================
   ユーザー表示更新
========================================================= */

function updateUserDisplay() {

    if (myName) {

        myName.textContent =
            username ||
            "ゲスト";

    }


    if (status) {

        status.textContent =
            "オンライン";

    }


    loadProfileImage();

}

/* =========================================================
   マイページ
========================================================= */

async function loadMyPage() {

    if (!currentUser) {
        return;
    }

    updateMyPageProfile();

    await loadMyPageStats();

    await loadSafeRaceRanking();

}


/* =========================================================
   マイページプロフィール
========================================================= */

function updateMyPageProfile() {

    if (myName) {

        myName.textContent =
            username ||
            "ゲスト";

    }

    if (myCoinLarge) {

        myCoinLarge.textContent =
            "—";

    }

}


/* =========================================================
   マイページ統計
========================================================= */

async function loadMyPageStats() {

    if (
        !currentUser ||
        !username
    ) {
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


        let sentCount = 0;

        snapshot.forEach(
            item => {

                const data =
                    item.data();


                const sender =
                    data.sender ||
                    data.username;


                if (
                    sender === username &&
                    !data.deleted
                ) {

                    sentCount++;

                }

            }
        );


        if (myBetCount) {

            myBetCount.textContent =
                sentCount;

        }


        if (myHitCount) {

            myHitCount.textContent =
                "—";

        }


        if (myProfit) {

            myProfit.textContent =
                "—";

        }


    } catch (error) {

        console.error(
            "マイページ統計エラー:",
            error
        );

    }

}


/* =========================================================
   安全なレースランキング
   ※賭け・コイン増減ではなく観戦参加数を集計
========================================================= */

async function loadSafeRaceRanking() {

    if (!ranking) {
        return;
    }

    ranking.innerHTML =
        `
        <div class="loading">
            ランキングを読み込み中...
        </div>
        `;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "raceParticipants"
                )
            );


        const counts = {};


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                const name =
                    data.username;


                if (!name) {
                    return;
                }


                counts[name] =
                    (counts[name] || 0) + 1;

            }
        );


        const list =
            Object.entries(
                counts
            )
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )
                .slice(
                    0,
                    20
                );


        ranking.innerHTML =
            "";


        if (
            list.length === 0
        ) {

            ranking.innerHTML =
                `
                <div class="empty-state">
                    まだランキングデータがありません
                </div>
                `;

            return;

        }


        list.forEach(
            ([name, count], index) => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "ranking-item";


                const number =
                    document.createElement(
                        "div"
                    );


                number.className =
                    "ranking-number";


                number.textContent =
                    index + 1;


                const info =
                    document.createElement(
                        "div"
                    );


                info.className =
                    "ranking-info";


                const user =
                    document.createElement(
                        "div"
                    );


                user.className =
                    "ranking-name";


                user.textContent =
                    name;


                const score =
                    document.createElement(
                        "div"
                    );


                score.className =
                    "ranking-score";


                score.textContent =
                    `観戦 ${count}回`;


                info.appendChild(
                    user
                );


                info.appendChild(
                    score
                );


                item.appendChild(
                    number
                );


                item.appendChild(
                    info
                );


                ranking.appendChild(
                    item
                );

            }
        );


    } catch (error) {

        console.error(
            "ランキング取得エラー:",
            error
        );


        ranking.innerHTML =
            `
            <div class="empty-state">
                ランキングを取得できませんでした
            </div>
            `;

    }

}


/* =========================================================
   レース参加記録
========================================================= */

async function recordRaceParticipation(
    raceId
) {

    if (
        !currentUser ||
        !username ||
        !raceId
    ) {
        return;
    }


    try {

        const participationId =
            `${raceId}_${currentUser.uid}`;


        await setDoc(
            doc(
                db,
                "raceParticipants",
                participationId
            ),
            {
                username:
                    username,

                uid:
                    currentUser.uid,

                raceId:
                    raceId,

                participatedAt:
                    serverTimestamp()
            },
            {
                merge:
                    true
            }
        );


    } catch (error) {

        console.error(
            "レース参加記録エラー:",
            error
        );

    }

}


/* =========================================================
   レース用固定馬
========================================================= */

const SAFE_RACE_HORSES = [

    {
        number: 1,
        name: "ユウウキ"
    },

    {
        number: 2,
        name: "ユウセイ"
    },

    {
        number: 3,
        name: "ユウヤン"
    },

    {
        number: 4,
        name: "ユウチュウ"
    },

    {
        number: 5,
        name: "ユウガ"
    },

    {
        number: 6,
        name: "ユウバエ"
    },

    {
        number: 7,
        name: "ユウキカイ"
    },

    {
        number: 8,
        name: "ユウマグレ"
    },

    {
        number: 9,
        name: "ユウジン"
    },

    {
        number: 10,
        name: "ユウシャ"
    }

];


/* =========================================================
   レース結果生成
   ※観戦用。賭け・オッズ・コイン変更なし
========================================================= */

function generateSafeRaceResult() {

    const result =
        SAFE_RACE_HORSES.map(
            horse => ({
                ...horse,
                random:
                    Math.random()
            })
        );


    result.sort(
        (a, b) =>
            b.random -
            a.random
    );


    return result;

}


/* =========================================================
   レース画面描画
========================================================= */

function renderSafeRaceTrack(
    result
) {

    if (!raceTrack) {
        return;
    }


    raceTrack.innerHTML =
        "";


    result.forEach(
        (horse, index) => {

            const lane =
                document.createElement(
                    "div"
                );


            lane.className =
                "race-lane";


            const number =
                document.createElement(
                    "div"
                );


            number.className =
                "horse-number";


            number.textContent =
                horse.number;


            const body =
                document.createElement(
                    "div"
                );


            body.className =
                "horse-body";


            body.textContent =
                horse.name;


            lane.appendChild(
                number
            );


            lane.appendChild(
                body
            );


            raceTrack.appendChild(
                lane
            );


            setTimeout(
                () => {

                    body.classList.add(
                        "running"
                    );

                },
                index * 100
            );

        }
    );

}


/* =========================================================
   レース開始
========================================================= */

window.startSafeRace =
    async function () {

        const raceId =
            getTodayRaceId();


        await recordRaceParticipation(
            raceId
        );


        if (derbyCountdown) {

            derbyCountdown.textContent =
                "レース開始！";

        }


        const result =
            generateSafeRaceResult();


        renderSafeRaceTrack(
            result
        );


        if (raceInfo) {

            raceInfo.innerHTML =
                `
                <strong>レース結果</strong>
                <br>
                1着：${result[0].name}
                <br>
                2着：${result[1].name}
                <br>
                3着：${result[2].name}
                `;

        }


        if (horseList) {

            horseList.innerHTML =
                "";


            result.forEach(
                (horse, index) => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "horse-card";


                    item.textContent =
                        `${index + 1}着　${horse.number}番 ${horse.name}`;


                    horseList.appendChild(
                        item
                    );

                }
            );

        }

    };


/* =========================================================
   今日の日付をレースIDにする
========================================================= */

function getTodayRaceId() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/* =========================================================
   レース情報
========================================================= */

function renderRaceInfo() {

    if (!raceInfo) {
        return;
    }


    raceInfo.innerHTML =
        `
        <div>
            <strong>本日のレース</strong>
        </div>

        <div>
            10頭の馬が出走します。
        </div>

        <div>
            観戦用レースです。
        </div>
        `;


    if (oddsList) {

        oddsList.innerHTML =
            `
            <div class="empty-state">
                オッズ・ベット機能はありません
            </div>
            `;

    }


    if (betButton) {

        betButton.disabled =
            true;

    }


    if (betType) {

        betType.disabled =
            true;

    }


    if (betHorses) {

        betHorses.disabled =
            true;

    }


    if (betAmount) {

        betAmount.disabled =
            true;

    }

}


/* =========================================================
   レース自動表示
========================================================= */

function initializeSafeRace() {

    if (!raceTrack) {
        return;
    }


    renderSafeRaceTrack(
        SAFE_RACE_HORSES
    );


    renderRaceInfo();

}


/* =========================================================
   起動時に安全なレース画面を準備
========================================================= */

try {

    initializeSafeRace();

} catch (error) {

    console.error(
        "レース初期化エラー:",
        error
    );

}

/* =========================================================
   ②-7 ゲーム共通システム
========================================================= */

let currentGameRoom = null;
let currentGameType = null;
let unsubscribeGameRooms = null;
let unsubscribeCurrentGame = null;


/* =========================================================
   ゲームルーム監視開始
========================================================= */

function loadGameRooms() {

    if (!gameRooms) {
        return;
    }


    if (unsubscribeGameRooms) {

        unsubscribeGameRooms();

        unsubscribeGameRooms =
            null;

    }


    try {

        const roomsQuery =
            query(
                collection(
                    db,
                    "gameRooms"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                )
            );


        unsubscribeGameRooms =
            onSnapshot(
                roomsQuery,
                snapshot => {

                    const rooms =
                        snapshot.docs.map(
                            item => ({
                                id:
                                    item.id,

                                ...item.data()
                            })
                        );


                    renderGameRooms(
                        rooms
                    );

                },
                error => {

                    console.error(
                        "ゲームルーム監視エラー:",
                        error
                    );


                    if (gameRooms) {

                        gameRooms.innerHTML =
                            `
                            <div class="empty-state">
                                ゲームルームを読み込めませんでした
                            </div>
                            `;

                    }

                }
            );


    } catch (error) {

        console.error(
            "ゲームルーム読み込みエラー:",
            error
        );

    }

}


/* =========================================================
   ゲームルーム一覧表示
========================================================= */

function renderGameRooms(
    rooms
) {

    if (!gameRooms) {
        return;
    }


    gameRooms.innerHTML =
        "";


    if (
        !rooms ||
        rooms.length === 0
    ) {

        gameRooms.innerHTML =
            `
            <div class="empty-state">
                参加できるゲームルームはありません
            </div>
            `;

        return;

    }


    rooms.forEach(
        room => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "room-card";


            const title =
                document.createElement(
                    "div"
                );


            title.className =
                "room-title";


            title.textContent =
                getGameTypeName(
                    room.gameType
                );


            const owner =
                document.createElement(
                    "div"
                );


            owner.className =
                "room-owner";


            owner.textContent =
                `作成者：${room.owner || "不明"}`;


            const members =
                document.createElement(
                    "div"
                );


            members.className =
                "room-members";


            const memberList =
                Array.isArray(
                    room.members
                )
                    ? room.members
                    : [];


            members.textContent =
                `参加者 ${memberList.length}/${getMaxGamePlayers(room.gameType)}人`;


            const status =
                document.createElement(
                    "div"
                );


            status.className =
                "room-status";


            status.textContent =
                room.status === "playing"
                    ? "プレイ中"
                    : "参加者募集中";


            const joinButton =
                document.createElement(
                    "button"
                );


            joinButton.type =
                "button";


            joinButton.className =
                "primary-button";


            joinButton.textContent =
                room.status === "playing"
                    ? "観戦"
                    : "参加";


            joinButton.addEventListener(
                "click",
                () => {

                    joinGameRoom(
                        room
                    );

                }
            );


            card.appendChild(
                title
            );


            card.appendChild(
                owner
            );


            card.appendChild(
                members
            );


            card.appendChild(
                status
            );


            card.appendChild(
                joinButton
            );


            gameRooms.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   ゲーム名
========================================================= */

function getGameTypeName(
    type
) {

    switch (type) {

        case "daifugo":
            return "大富豪";

        case "othello":
            return "オセロ";

        case "shogi":
            return "将棋";

        default:
            return "ゲーム";

    }

}


/* =========================================================
   最大プレイヤー数
========================================================= */

function getMaxGamePlayers(
    type
) {

    switch (type) {

        case "daifugo":
            return 4;

        case "othello":
            return 2;

        case "shogi":
            return 2;

        default:
            return 2;

    }

}


/* =========================================================
   ゲーム種類選択
========================================================= */

const gameTypeButtons =
    document.querySelectorAll(
        ".game-type"
    );


gameTypeButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const type =
                    button.dataset.type ||
                    button.dataset.game ||
                    button.dataset.gameType;


                if (!type) {
                    return;
                }


                gameTypeButtons.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );


                currentGameType =
                    type;

            }
        );

    }
);


/* =========================================================
   ゲームルーム作成
========================================================= */

createGameRoom?.addEventListener(
    "click",
    async () => {

        if (
            !currentUser ||
            !username
        ) {

            alert(
                "ログインしてください。"
            );

            return;

        }


        const type =
            currentGameType ||
            "othello";


        try {

            const maxPlayers =
                getMaxGamePlayers(
                    type
                );


            const roomData = {

                gameType:
                    type,

                owner:
                    username,

                ownerUid:
                    currentUser.uid,

                members:
                    [
                        username
                    ],

                memberUids:
                    [
                        currentUser.uid
                    ],

                maxPlayers:
                    maxPlayers,

                status:
                    "waiting",

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp(),

                gameState:
                    createInitialGameState(
                        type
                    )

            };


            const roomRef =
                await addDoc(
                    collection(
                        db,
                        "gameRooms"
                    ),
                    roomData
                );


            alert(
                `${getGameTypeName(type)}のルームを作成しました。`
            );


            const createdRoom =
                {
                    id:
                        roomRef.id,

                    ...roomData,

                    members:
                        [
                            username
                        ],

                    memberUids:
                        [
                            currentUser.uid
                        ]
                };


            joinGameRoom(
                createdRoom
            );


        } catch (error) {

            console.error(
                "ゲームルーム作成エラー:",
                error
            );


            alert(
                "ゲームルームを作成できませんでした。"
            );

        }

    }
);


/* =========================================================
   初期ゲーム状態
========================================================= */

function createInitialGameState(
    type
) {

    if (
        type === "othello"
    ) {

        return {
            board:
                createInitialOthelloBoard(),

            currentPlayer:
                "black",

            started:
                false,

            winner:
                null

        };

    }


    if (
        type === "shogi"
    ) {

        return {
            board:
                createInitialShogiBoard(),

            currentPlayer:
                "sente",

            started:
                false,

            winner:
                null

        };

    }


    if (
        type === "daifugo"
    ) {

        return {

            hands:
                {},

            currentPlayer:
                null,

            started:
                false,

            winner:
                null

        };

    }


    return {};

}


/* =========================================================
   オセロ初期盤面
========================================================= */

function createInitialOthelloBoard() {

    const board =
        Array.from(
            {
                length: 8
            },
            () =>
                Array(
                    8
                ).fill(
                    null
                )
        );


    board[3][3] =
        "white";


    board[3][4] =
        "black";


    board[4][3] =
        "black";


    board[4][4] =
        "white";


    return board;

}


/* =========================================================
   将棋初期盤面
========================================================= */

function createInitialShogiBoard() {

    return [

        [
            "香",
            "桂",
            "銀",
            "金",
            "王",
            "金",
            "銀",
            "桂",
            "香"
        ],

        [
            null,
            "飛",
            null,
            null,
            null,
            null,
            null,
            "角",
            null
        ],

        [
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩"
        ],

        [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        ],

        [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        ],

        [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        ],

        [
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩",
            "歩"
        ],

        [
            null,
            "角",
            null,
            null,
            null,
            null,
            null,
            "飛",
            null
        ],

        [
            "香",
            "桂",
            "銀",
            "金",
            "玉",
            "金",
            "銀",
            "桂",
            "香"
        ]

    ];

}


/* =========================================================
   ゲームルーム参加
========================================================= */

async function joinGameRoom(
    room
) {

    if (
        !currentUser ||
        !username ||
        !room?.id
    ) {
        return;
    }


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                room.id
            );


        const snapshot =
            await getDoc(
                roomRef
            );


        if (!snapshot.exists()) {

            alert(
                "このルームは存在しません。"
            );

            return;

        }


        const data =
            snapshot.data();


        const members =
            Array.isArray(
                data.members
            )
                ? [
                    ...data.members
                ]
                : [];


        const memberUids =
            Array.isArray(
                data.memberUids
            )
                ? [
                    ...data.memberUids
                ]
                : [];


        const maxPlayers =
            getMaxGamePlayers(
                data.gameType
            );


        if (
            !members.includes(
                username
            )
        ) {

            if (
                members.length >=
                maxPlayers
            ) {

                alert(
                    "このルームは満員です。"
                );

                return;

            }


            members.push(
                username
            );


            memberUids.push(
                currentUser.uid
            );


            const nextStatus =
                members.length >=
                maxPlayers
                    ? "playing"
                    : "waiting";


            await updateDoc(
                roomRef,
                {
                    members:
                        members,

                    memberUids:
                        memberUids,

                    status:
                        nextStatus,

                    updatedAt:
                        serverTimestamp()
                }
            );

        }


        currentGameRoom =
            room.id;


        currentGameType =
            data.gameType;


        openGameArea(
            room.id,
            data.gameType
        );


        listenCurrentGameRoom(
            room.id
        );


    } catch (error) {

        console.error(
            "ゲームルーム参加エラー:",
            error
        );


        alert(
            "ゲームルームに参加できませんでした。"
        );

    }

}


/* =========================================================
   ゲーム画面を開く
========================================================= */

function openGameArea(
    roomId,
    gameType
) {

    if (!gameArea) {
        return;
    }


    gameArea.classList.remove(
        "hidden"
    );


    gameArea.innerHTML =
        `
        <div class="panel">
            <div class="panel-head">
                <strong>
                    ${getGameTypeName(gameType)}
                </strong>

                <button
                    type="button"
                    id="leaveGameRoomButton"
                >
                    ルームを閉じる
                </button>
            </div>

            <div
                id="currentGameStatus"
                class="game-status"
            >
                読み込み中...
            </div>

            <div
                id="currentGameBoard"
                class="game-board"
            >
            </div>
        </div>
        `;


    const leaveButton =
        document.getElementById(
            "leaveGameRoomButton"
        );


    leaveButton?.addEventListener(
        "click",
        () => {

            leaveGameRoom(
                roomId
            );

        }
    );

}


/* =========================================================
   現在のゲームルーム監視
========================================================= */

function listenCurrentGameRoom(
    roomId
) {

    if (
        unsubscribeCurrentGame
    ) {

        unsubscribeCurrentGame();

        unsubscribeCurrentGame =
            null;

    }


    const roomRef =
        doc(
            db,
            "gameRooms",
            roomId
        );


    unsubscribeCurrentGame =
        onSnapshot(
            roomRef,
            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    closeGameArea();

                    return;

                }


                const data =
                    snapshot.data();


                currentGameRoom =
                    roomId;


                currentGameType =
                    data.gameType;


                renderCurrentGame(
                    data
                );

            },
            error => {

                console.error(
                    "現在のゲーム監視エラー:",
                    error
                );

            }
        );

}


/* =========================================================
   現在のゲーム描画
========================================================= */

function renderCurrentGame(
    room
) {

    const status =
        document.getElementById(
            "currentGameStatus"
        );


    const board =
        document.getElementById(
            "currentGameBoard"
        );


    if (status) {

        const members =
            Array.isArray(
                room.members
            )
                ? room.members
                : [];


        status.textContent =
            `参加者 ${members.length}/${getMaxGamePlayers(room.gameType)}人`;

    }


    if (!board) {
        return;
    }


    if (
        room.gameType ===
        "othello"
    ) {

        renderOthelloBoard(
            board,
            room
        );

        return;

    }


    if (
        room.gameType ===
        "shogi"
    ) {

        renderShogiBoard(
            board,
            room
        );

        return;

    }


    if (
        room.gameType ===
        "daifugo"
    ) {

        renderDaifugoBoard(
            board,
            room
        );

        return;

    }


    board.innerHTML =
        `
        <div class="empty-state">
            ゲームを準備中です
        </div>
        `;

}


/* =========================================================
   ゲームルーム退出
========================================================= */

async function leaveGameRoom(
    roomId
) {

    if (
        !currentUser ||
        !roomId
    ) {
        return;
    }


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        const snapshot =
            await getDoc(
                roomRef
            );


        if (
            !snapshot.exists()
        ) {

            closeGameArea();

            return;

        }


        const data =
            snapshot.data();


        const members =
            Array.isArray(
                data.members
            )
                ? data.members.filter(
                    name =>
                        name !== username
                )
                : [];


        const memberUids =
            Array.isArray(
                data.memberUids
            )
                ? data.memberUids.filter(
                    uid =>
                        uid !==
                        currentUser.uid
                )
                : [];


        if (
            members.length === 0
        ) {

            await deleteDoc(
                roomRef
            );

        } else {

            await updateDoc(
                roomRef,
                {
                    members:
                        members,

                    memberUids:
                        memberUids,

                    status:
                        "waiting",

                    updatedAt:
                        serverTimestamp()
                }
            );

        }


        closeGameArea();


    } catch (error) {

        console.error(
            "ゲームルーム退出エラー:",
            error
        );

    }

}


/* =========================================================
   ゲーム画面を閉じる
========================================================= */

function closeGameArea() {

    if (unsubscribeCurrentGame) {

        unsubscribeCurrentGame();

        unsubscribeCurrentGame =
            null;

    }


    currentGameRoom =
        null;


    currentGameType =
        null;


    if (gameArea) {

        gameArea.innerHTML =
            `
            <div class="empty-state">
                ゲームルームを選択してください
            </div>
            `;

    }

}

/* =========================================================
   ②-8 オセロゲーム
========================================================= */


/* =========================================================
   オセロ盤描画
========================================================= */

function renderOthelloBoard(
    container,
    room
) {

    if (!container) {
        return;
    }


    const state =
        room.gameState ||
        createInitialGameState(
            "othello"
        );


    const board =
        Array.isArray(
            state.board
        )
            ? state.board
            : createInitialOthelloBoard();


    container.innerHTML =
        "";


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "othello-wrapper";


    const boardElement =
        document.createElement(
            "div"
        );


    boardElement.className =
        "othello-board";


    for (
        let row = 0;
        row < 8;
        row++
    ) {

        for (
            let col = 0;
            col < 8;
            col++
        ) {

            const cell =
                document.createElement(
                    "button"
                );


            cell.type =
                "button";


            cell.className =
                "othello-cell";


            const value =
                board[row]?.[col] ||
                null;


            if (value) {

                const stone =
                    document.createElement(
                        "span"
                    );


                stone.className =
                    `othello-stone ${value}`;


                cell.appendChild(
                    stone
                );

            }


            cell.addEventListener(
                "click",
                () => {

                    playOthelloMove(
                        room,
                        row,
                        col
                    );

                }
            );


            boardElement.appendChild(
                cell
            );

        }

    }


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "game-info";


    const currentPlayer =
        state.currentPlayer ||
        "black";


    info.textContent =
        currentPlayer === "black"
            ? "黒の番"
            : "白の番";


    wrapper.appendChild(
        info
    );


    wrapper.appendChild(
        boardElement
    );


    container.appendChild(
        wrapper
    );

}


/* =========================================================
   オセロ手を打つ
========================================================= */

async function playOthelloMove(
    room,
    row,
    col
) {

    if (
        !currentUser ||
        !username ||
        !room?.id
    ) {
        return;
    }


    const state =
        room.gameState;


    if (!state) {
        return;
    }


    const board =
        state.board;


    if (
        !Array.isArray(board) ||
        !board[row] ||
        board[row][col]
    ) {
        return;
    }


    const members =
        Array.isArray(
            room.members
        )
            ? room.members
            : [];


    if (
        members.length < 2
    ) {

        alert(
            "2人そろってから開始できます。"
        );

        return;

    }


    const playerColor =
        getOthelloPlayerColor(
            room
        );


    if (!playerColor) {

        alert(
            "このゲームの参加者ではありません。"
        );

        return;

    }


    if (
        state.started &&
        state.currentPlayer !==
            playerColor
    ) {

        return;

    }


    const flips =
        getOthelloFlips(
            board,
            row,
            col,
            playerColor
        );


    if (
        flips.length === 0
    ) {

        alert(
            "そこには置けません。"
        );

        return;

    }


    const newBoard =
        board.map(
            line =>
                [...line]
        );


    newBoard[row][col] =
        playerColor;


    flips.forEach(
        ([r, c]) => {

            newBoard[r][c] =
                playerColor;

        }
    );


    const nextPlayer =
        playerColor === "black"
            ? "white"
            : "black";


    const nextState = {

        ...state,

        board:
            newBoard,

        currentPlayer:
            nextPlayer,

        started:
            true,

        lastMove:
            {
                row:
                    row,

                col:
                    col,

                color:
                    playerColor
            }

    };


    try {

        await updateDoc(
            doc(
                db,
                "gameRooms",
                room.id
            ),
            {
                gameState:
                    nextState,

                updatedAt:
                    serverTimestamp()
            }
        );


    } catch (error) {

        console.error(
            "オセロ更新エラー:",
            error
        );


        alert(
            "盤面の更新に失敗しました。"
        );

    }

}


/* =========================================================
   自分のオセロ色
========================================================= */

function getOthelloPlayerColor(
    room
) {

    if (
        !currentUser ||
        !room
    ) {
        return null;
    }


    const members =
        Array.isArray(
            room.members
        )
            ? room.members
            : [];


    const index =
        members.indexOf(
            username
        );


    if (index === 0) {

        return "black";

    }


    if (index === 1) {

        return "white";

    }


    return null;

}


/* =========================================================
   オセロでひっくり返せるマス
========================================================= */

function getOthelloFlips(
    board,
    row,
    col,
    color
) {

    const opponent =
        color === "black"
            ? "white"
            : "black";


    const directions = [

        [-1, -1],

        [-1, 0],

        [-1, 1],

        [0, -1],

        [0, 1],

        [1, -1],

        [1, 0],

        [1, 1]

    ];


    const result = [];


    directions.forEach(
        ([dr, dc]) => {

            const line = [];


            let r =
                row + dr;


            let c =
                col + dc;


            while (
                r >= 0 &&
                r < 8 &&
                c >= 0 &&
                c < 8
            ) {

                const value =
                    board[r][c];


                if (
                    value === opponent
                ) {

                    line.push(
                        [r, c]
                    );

                } else {

                    if (
                        value === color &&
                        line.length > 0
                    ) {

                        result.push(
                            ...line
                        );

                    }

                    break;

                }


                r += dr;

                c += dc;

            }

        }
    );


    return result;

}


/* =========================================================
   オセロ合法手一覧
========================================================= */

function getOthelloValidMoves(
    board,
    color
) {

    const moves = [];


    for (
        let row = 0;
        row < 8;
        row++
    ) {

        for (
            let col = 0;
            col < 8;
            col++
        ) {

            if (
                board[row][col]
            ) {
                continue;
            }


            const flips =
                getOthelloFlips(
                    board,
                    row,
                    col,
                    color
                );


            if (
                flips.length > 0
            ) {

                moves.push(
                    {
                        row,
                        col
                    }
                );

            }

        }

    }


    return moves;

}


/* =========================================================
   オセロ勝敗判定
========================================================= */

function getOthelloWinner(
    board
) {

    let black = 0;

    let white = 0;


    board.forEach(
        row => {

            row.forEach(
                cell => {

                    if (
                        cell === "black"
                    ) {

                        black++;

                    }


                    if (
                        cell === "white"
                    ) {

                        white++;

                    }

                }
            );

        }
    );


    const blackMoves =
        getOthelloValidMoves(
            board,
            "black"
        );


    const whiteMoves =
        getOthelloValidMoves(
            board,
            "white"
        );


    const full =
        board.every(
            row =>
                row.every(
                    cell =>
                        cell !== null
                )
        );


    if (
        !full &&
        (
            blackMoves.length > 0 ||
            whiteMoves.length > 0
        )
    ) {

        return null;

    }


    if (
        black > white
    ) {

        return "black";

    }


    if (
        white > black
    ) {

        return "white";

    }


    return "draw";

}


/* =========================================================
   オセロの手番を自動調整
========================================================= */

async function updateOthelloTurn(
    room
) {

    if (!room?.id) {
        return;
    }


    const state =
        room.gameState;


    if (!state?.board) {
        return;
    }


    const current =
        state.currentPlayer ||
        "black";


    const currentMoves =
        getOthelloValidMoves(
            state.board,
            current
        );


    if (
        currentMoves.length > 0
    ) {
        return;
    }


    const next =
        current === "black"
            ? "white"
            : "black";


    const nextMoves =
        getOthelloValidMoves(
            state.board,
            next
        );


    if (
        nextMoves.length === 0
    ) {

        const winner =
            getOthelloWinner(
                state.board
            );


        await updateDoc(
            doc(
                db,
                "gameRooms",
                room.id
            ),
            {
                "gameState.winner":
                    winner,

                updatedAt:
                    serverTimestamp()
            }
        );


        return;

    }


    await updateDoc(
        doc(
            db,
            "gameRooms",
            room.id
        ),
        {
            "gameState.currentPlayer":
                next,

            updatedAt:
                serverTimestamp()
        }
    );

}


/* =========================================================
   オセロ盤の勝敗表示
========================================================= */

function getOthelloResultText(
    winner
) {

    if (
        winner === "black"
    ) {

        return "黒の勝ち！";

    }


    if (
        winner === "white"
    ) {

        return "白の勝ち！";

    }


    if (
        winner === "draw"
    ) {

        return "引き分け";

    }


    return "";

}


/* =========================================================
   オセロ盤の結果を確認
========================================================= */

async function checkOthelloGameResult(
    room
) {

    if (
        !room?.gameState?.board
    ) {
        return;
    }


    const winner =
        getOthelloWinner(
            room.gameState.board
        );


    if (!winner) {
        return;
    }


    if (
        room.gameState.winner ===
        winner
    ) {
        return;
    }


    try {

        await updateDoc(
            doc(
                db,
                "gameRooms",
                room.id
            ),
            {
                "gameState.winner":
                    winner,

                updatedAt:
                    serverTimestamp()
            }
        );


    } catch (error) {

        console.error(
            "オセロ結果保存エラー:",
            error
        );

    }

}


/* =========================================================
   オセロ表示を拡張
========================================================= */

const originalRenderCurrentGame =
    renderCurrentGame;


renderCurrentGame =
    function (room) {

        originalRenderCurrentGame(
            room
        );


        if (
            room?.gameType ===
            "othello"
        ) {

            const status =
                document.getElementById(
                    "currentGameStatus"
                );


            const winner =
                room.gameState?.winner;


            if (
                winner &&
                status
            ) {

                status.textContent =
                    getOthelloResultText(
                        winner
                    );

            }

        }

    };

/* =========================================================
   ②-9 将棋ゲーム
========================================================= */

let selectedShogiPiece = null;


/* =========================================================
   将棋盤描画
========================================================= */

function renderShogiBoard(
    container,
    room
) {

    if (!container) {
        return;
    }

    const state =
        room.gameState ||
        createInitialGameState(
            "shogi"
        );

    const board =
        Array.isArray(state.board)
            ? state.board
            : createInitialShogiBoard();

    container.innerHTML = "";

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "shogi-wrapper";

    const info =
        document.createElement(
            "div"
        );

    info.className =
        "game-info";

    const currentPlayer =
        state.currentPlayer ||
        "sente";

    if (state.winner) {

        info.textContent =
            state.winner === "sente"
                ? "☗ 先手の勝ち"
                : "☖ 後手の勝ち";

    } else {

        info.textContent =
            currentPlayer === "sente"
                ? "☗ 先手の番"
                : "☖ 後手の番";

    }

    const boardElement =
        document.createElement(
            "div"
        );

    boardElement.className =
        "shogi-board";

    for (
        let row = 0;
        row < 9;
        row++
    ) {

        for (
            let col = 0;
            col < 9;
            col++
        ) {

            const cell =
                document.createElement(
                    "button"
                );

            cell.type =
                "button";

            cell.className =
                "shogi-cell";

            const piece =
                board[row]?.[col] ||
                null;

            if (piece) {

                const pieceElement =
                    document.createElement(
                        "span"
                    );

                pieceElement.className =
                    "shogi-piece";

                pieceElement.textContent =
                    piece;

                if (
                    isShogiOpponentPiece(
                        piece,
                        row
                    )
                ) {

                    pieceElement.classList.add(
                        "opponent"
                    );

                }

                cell.appendChild(
                    pieceElement
                );

            }

            if (
                selectedShogiPiece &&
                selectedShogiPiece.row === row &&
                selectedShogiPiece.col === col
            ) {

                cell.classList.add(
                    "selected"
                );

            }

            cell.addEventListener(
                "click",
                () => {

                    handleShogiCellClick(
                        room,
                        row,
                        col
                    );

                }
            );

            boardElement.appendChild(
                cell
            );

        }

    }

    wrapper.appendChild(
        info
    );

    wrapper.appendChild(
        boardElement
    );

    container.appendChild(
        wrapper
    );

}


/* =========================================================
   将棋の駒が相手側か判定
========================================================= */

function isShogiOpponentPiece(
    piece,
    row
) {

    if (!piece) {
        return false;
    }

    const upperRows =
        row < 4;

    const lowerRows =
        row > 4;

    return (
        (upperRows && currentShogiPlayer === "sente") ||
        (lowerRows && currentShogiPlayer === "gote")
    );

}


/* =========================================================
   現在の将棋プレイヤー
========================================================= */

let currentShogiPlayer =
    "sente";


/* =========================================================
   将棋マスクリック
========================================================= */

async function handleShogiCellClick(
    room,
    row,
    col
) {

    if (
        !room ||
        !room.gameState
    ) {
        return;
    }

    if (
        room.gameState.winner
    ) {
        return;
    }

    const player =
        getShogiPlayer(
            room
        );

    if (!player) {

        alert(
            "このゲームの参加者ではありません。"
        );

        return;
    }

    currentShogiPlayer =
        player;

    const board =
        room.gameState.board;

    const piece =
        board[row]?.[col] ||
        null;

    const isMyTurn =
        room.gameState.currentPlayer ===
        player;

    if (!isMyTurn) {
        return;
    }


    /* -----------------------------------------
       まだ駒を選択していない
    ----------------------------------------- */

    if (!selectedShogiPiece) {

        if (!piece) {
            return;
        }

        if (
            !isPieceOwnedByPlayer(
                piece,
                row,
                player
            )
        ) {
            return;
        }

        selectedShogiPiece = {
            row,
            col
        };

        renderCurrentGame(
            room
        );

        return;
    }


    /* -----------------------------------------
       同じ駒をもう一度押す
    ----------------------------------------- */

    if (
        selectedShogiPiece.row === row &&
        selectedShogiPiece.col === col
    ) {

        selectedShogiPiece =
            null;

        renderCurrentGame(
            room
        );

        return;
    }


    /* -----------------------------------------
       自分の別の駒を押した
    ----------------------------------------- */

    if (
        piece &&
        isPieceOwnedByPlayer(
            piece,
            row,
            player
        )
    ) {

        selectedShogiPiece = {
            row,
            col
        };

        renderCurrentGame(
            room
        );

        return;
    }


    /* -----------------------------------------
       移動可能か確認
    ----------------------------------------- */

    const from =
        selectedShogiPiece;

    const movingPiece =
        board[from.row]?.[from.col];

    if (!movingPiece) {

        selectedShogiPiece =
            null;

        renderCurrentGame(
            room
        );

        return;
    }


    const valid =
        isValidShogiMove(
            board,
            from.row,
            from.col,
            row,
            col,
            movingPiece,
            player
        );

    if (!valid) {

        return;
    }


    await executeShogiMove(
        room,
        from,
        {
            row,
            col
        },
        movingPiece,
        player
    );

}


/* =========================================================
   将棋プレイヤー判定
========================================================= */

function getShogiPlayer(
    room
) {

    if (
        !currentUser ||
        !room
    ) {
        return null;
    }

    const members =
        Array.isArray(
            room.members
        )
            ? room.members
            : [];

    const index =
        members.indexOf(
            username
        );

    if (index === 0) {
        return "sente";
    }

    if (index === 1) {
        return "gote";
    }

    return null;

}


/* =========================================================
   駒の所有者判定
========================================================= */

function isPieceOwnedByPlayer(
    piece,
    row,
    player
) {

    if (!piece) {
        return false;
    }

    const upper =
        row < 4;

    const lower =
        row > 4;

    if (player === "sente") {

        return !(
            upper
        );

    }

    if (player === "gote") {

        return !(
            lower
        );

    }

    return false;

}


/* =========================================================
   将棋の基本移動判定
========================================================= */

function isValidShogiMove(
    board,
    fromRow,
    fromCol,
    toRow,
    toCol,
    piece,
    player
) {

    if (
        fromRow === toRow &&
        fromCol === toCol
    ) {
        return false;
    }

    if (
        toRow < 0 ||
        toRow >= 9 ||
        toCol < 0 ||
        toCol >= 9
    ) {
        return false;
    }


    const destination =
        board[toRow]?.[toCol] ||
        null;


    if (
        destination &&
        isPieceOwnedByPlayer(
            destination,
            toRow,
            player
        )
    ) {
        return false;
    }


    const direction =
        player === "sente"
            ? -1
            : 1;

    const dr =
        toRow -
        fromRow;

    const dc =
        toCol -
        fromCol;


    switch (piece) {

        /* -------------------------------------
           歩
        ------------------------------------- */

        case "歩":

            return (
                dc === 0 &&
                dr === direction
            );


        /* -------------------------------------
           香
        ------------------------------------- */

        case "香":

            if (dc !== 0) {
                return false;
            }

            if (
                Math.sign(dr) !==
                direction
            ) {
                return false;
            }

            return isClearShogiPath(
                board,
                fromRow,
                fromCol,
                toRow,
                toCol
            );


        /* -------------------------------------
           桂
        ------------------------------------- */

        case "桂":

            return (
                Math.abs(dc) === 1 &&
                dr === direction * 2
            );


        /* -------------------------------------
           銀
        ------------------------------------- */

        case "銀":

            return (
                (
                    dc === 0 &&
                    dr === direction
                ) ||
                (
                    Math.abs(dc) === 1 &&
                    Math.abs(dr) === 1
                )
            );


        /* -------------------------------------
           金
        ------------------------------------- */

        case "金":

            return (
                (
                    dc === 0 &&
                    dr === direction
                ) ||
                (
                    Math.abs(dc) === 1 &&
                    dr === 0
                ) ||
                (
                    Math.abs(dc) === 1 &&
                    dr === -direction
                )
            );


        /* -------------------------------------
           王・玉
        ------------------------------------- */

        case "王":
        case "玉":

            return (
                Math.abs(dr) <= 1 &&
                Math.abs(dc) <= 1
            );


        /* -------------------------------------
           飛
        ------------------------------------- */

        case "飛":

            if (
                dr !== 0 &&
                dc !== 0
            ) {
                return false;
            }

            return isClearShogiPath(
                board,
                fromRow,
                fromCol,
                toRow,
                toCol
            );


        /* -------------------------------------
           角
        ------------------------------------- */

        case "角":

            if (
                Math.abs(dr) !==
                Math.abs(dc)
            ) {
                return false;
            }

            return isClearShogiPath(
                board,
                fromRow,
                fromCol,
                toRow,
                toCol
            );


        default:

            return false;

    }

}


/* =========================================================
   将棋の移動経路確認
========================================================= */

function isClearShogiPath(
    board,
    fromRow,
    fromCol,
    toRow,
    toCol
) {

    const rowStep =
        Math.sign(
            toRow -
            fromRow
        );

    const colStep =
        Math.sign(
            toCol -
            fromCol
        );

    let row =
        fromRow +
        rowStep;

    let col =
        fromCol +
        colStep;

    while (
        row !== toRow ||
        col !== toCol
    ) {

        if (
            board[row]?.[col]
        ) {
            return false;
        }

        row +=
            rowStep;

        col +=
            colStep;

    }

    return true;

}


/* =========================================================
   将棋の駒移動
========================================================= */

async function executeShogiMove(
    room,
    from,
    to,
    piece,
    player
) {

    const roomRef =
        doc(
            db,
            "gameRooms",
            room.id
        );

    try {

        await runTransaction(
            db,
            async transaction => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );

                if (
                    !snapshot.exists()
                ) {
                    throw new Error(
                        "ルームが存在しません"
                    );
                }

                const latest =
                    snapshot.data();

                const state =
                    latest.gameState;

                if (!state?.board) {
                    throw new Error(
                        "ゲーム状態がありません"
                    );
                }

                if (
                    state.currentPlayer !==
                    player
                ) {
                    throw new Error(
                        "現在の手番ではありません"
                    );
                }

                const board =
                    state.board.map(
                        line =>
                            [...line]
                    );

                const latestPiece =
                    board[from.row]?.[from.col];

                if (
                    !latestPiece
                ) {
                    throw new Error(
                        "駒がありません"
                    );
                }

                const destination =
                    board[to.row]?.[to.col] ||
                    null;

                if (
                    destination &&
                    isPieceOwnedByPlayer(
                        destination,
                        to.row,
                        player
                    )
                ) {
                    throw new Error(
                        "自分の駒があるマスです"
                    );
                }

                if (
                    !isValidShogiMove(
                        board,
                        from.row,
                        from.col,
                        to.row,
                        to.col,
                        latestPiece,
                        player
                    )
                ) {
                    throw new Error(
                        "不正な手です"
                    );
                }

                board[to.row][to.col] =
                    latestPiece;

                board[from.row][from.col] =
                    null;

                const nextPlayer =
                    player === "sente"
                        ? "gote"
                        : "sente";

                let winner =
                    null;

                if (
                    destination === "王" ||
                    destination === "玉"
                ) {

                    winner =
                        player;

                }

                const nextState = {

                    ...state,

                    board:
                        board,

                    currentPlayer:
                        nextPlayer,

                    started:
                        true,

                    winner:
                        winner,

                    lastMove:
                        {
                            from:
                                from,

                            to:
                                to,

                            piece:
                                latestPiece,

                            player:
                                player
                        }

                };

                transaction.update(
                    roomRef,
                    {
                        gameState:
                            nextState,

                        updatedAt:
                            serverTimestamp()
                    }
                );

            }
        );

        selectedShogiPiece =
            null;

    } catch (error) {

        console.error(
            "将棋の手エラー:",
            error
        );

        alert(
            error.message ||
            "駒を動かせませんでした。"
        );

    }

}


/* =========================================================
   将棋結果表示
========================================================= */

function getShogiResultText(
    winner
) {

    if (
        winner === "sente"
    ) {
        return "☗ 先手の勝ち！";
    }

    if (
        winner === "gote"
    ) {
        return "☖ 後手の勝ち！";
    }

    return "";

}


/* =========================================================
   将棋描画を結果表示対応にする
========================================================= */

const previousShogiRender =
    renderCurrentGame;


renderCurrentGame =
    function (room) {

        previousShogiRender(
            room
        );

        if (
            room?.gameType ===
            "shogi"
        ) {

            const status =
                document.getElementById(
                    "currentGameStatus"
                );

            const winner =
                room.gameState?.winner;

            if (
                winner &&
                status
            ) {

                status.textContent =
                    getShogiResultText(
                        winner
                    );

            }

        }

    };


/* =========================================================
   将棋選択状態リセット
========================================================= */

function resetShogiSelection() {

    selectedShogiPiece =
        null;

}


/* =========================================================
   ゲームルームを閉じたときに選択状態も解除
========================================================= */

const originalCloseGameArea =
    closeGameArea;


closeGameArea =
    function () {

        resetShogiSelection();

        originalCloseGameArea();

    };

/* =========================================================
   ②-10 大富豪ゲーム本体
   ※コイン・賭け・賞金などは使用しません
========================================================= */

let selectedDaifugoCards = [];


/* =========================================================
   大富豪カード生成
========================================================= */

function createDaifugoDeck() {

    const suits = [
        "♠",
        "♥",
        "♦",
        "♣"
    ];

    const deck = [];

    for (const suit of suits) {

        for (
            let rank = 3;
            rank <= 13;
            rank++
        ) {

            deck.push({
                suit: suit,
                rank: rank,
                id:
                    `${suit}-${rank}-${Math.random()}`
            });

        }

        deck.push({
            suit: suit,
            rank: 14,
            id:
                `${suit}-14-${Math.random()}`
        });

    }

    /* 2を追加 */

    for (const suit of suits) {

        deck.push({
            suit: suit,
            rank: 15,
            id:
                `${suit}-15-${Math.random()}`
        });

    }

    /* ジョーカー */

    deck.push({
        suit: "J",
        rank: 16,
        joker: true,
        id:
            `joker-${Math.random()}`
    });

    return deck;

}


/* =========================================================
   大富豪カード表示名
========================================================= */

function getDaifugoCardName(card) {

    if (!card) {
        return "";
    }

    if (card.joker) {
        return "🃏";
    }

    const names = {
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
        10: "10",
        11: "J",
        12: "Q",
        13: "K",
        14: "A",
        15: "2"
    };

    return (
        card.suit +
        names[card.rank]
    );

}


/* =========================================================
   デッキシャッフル
========================================================= */

function shuffleDaifugoDeck(deck) {

    const result =
        [...deck];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            result[i],
            result[j]
        ] =
        [
            result[j],
            result[i]
        ];

    }

    return result;

}


/* =========================================================
   大富豪カード配布
========================================================= */

function dealDaifugoCards(
    deck,
    playerCount
) {

    const hands =
        Array.from(
            {
                length:
                    playerCount
            },
            () => []
        );

    deck.forEach(
        (card, index) => {

            hands[
                index %
                playerCount
            ].push(card);

        }
    );

    for (const hand of hands) {

        hand.sort(
            (a, b) =>
                a.rank -
                b.rank
        );

    }

    return hands;

}


/* =========================================================
   大富豪の初期ゲーム状態
========================================================= */

function createDaifugoGameState(
    members
) {

    const playerCount =
        Math.min(
            members.length,
            4
        );

    const deck =
        shuffleDaifugoDeck(
            createDaifugoDeck()
        );

    const hands =
        dealDaifugoCards(
            deck,
            playerCount
        );

    const players =
        members
            .slice(0, playerCount)
            .map(
                (name, index) => ({
                    name: name,
                    hand:
                        hands[index],
                    passed: false,
                    finished: false,
                    rank: null
                })
            );

    return {

        players:
            players,

        currentPlayer:
            0,

        lastPlay:
            null,

        lastPlayer:
            null,

        consecutivePasses:
            0,

        finishedPlayers:
            [],

        revolution:
            false,

        started:
            true,

        winner:
            null,

        rules: {

            revolution: true,

            staircase: true,

            bind: true,

            eightCut: true,

            elevenBack: true,

            joker: true,

            skip: true,

            sevenTransfer: true,

            tenDiscard: true,

            twelveBomb: true,

            downNumber: true

        }

    };

}


/* =========================================================
   カード選択
========================================================= */

function toggleDaifugoCard(
    room,
    cardIndex
) {

    if (
        !room ||
        !room.gameState
    ) {
        return;
    }

    const player =
        room.gameState.players[
            room.gameState.currentPlayer
        ];

    if (!player) {
        return;
    }

    if (
        player.name !==
        username
    ) {
        return;
    }

    const index =
        selectedDaifugoCards.indexOf(
            cardIndex
        );

    if (index >= 0) {

        selectedDaifugoCards.splice(
            index,
            1
        );

    } else {

        selectedDaifugoCards.push(
            cardIndex
        );

    }

    selectedDaifugoCards.sort(
        (a, b) =>
            a - b
    );

    renderCurrentGame(
        room
    );

}


/* =========================================================
   大富豪のカード組み合わせ判定
========================================================= */

function analyzeDaifugoPlay(
    cards
) {

    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        return {
            valid: false,
            type: null,
            power: 0
        };

    }

    const normalCards =
        cards.filter(
            card =>
                !card.joker
        );

    const jokerCount =
        cards.filter(
            card =>
                card.joker
        ).length;

    const ranks =
        normalCards.map(
            card =>
                card.rank
        );

    const counts = {};

    for (const rank of ranks) {

        counts[rank] =
            (counts[rank] || 0) + 1;

    }

    const uniqueRanks =
        Object.keys(
            counts
        )
            .map(Number)
            .sort(
                (a, b) =>
                    a - b
            );

    /* 1枚 */

    if (
        cards.length === 1
    ) {

        const card =
            cards[0];

        return {

            valid: true,

            type:
                card.joker
                    ? "joker"
                    : "single",

            power:
                card.rank

        };

    }


    /* 同じ数字 */

    if (
        uniqueRanks.length === 1
    ) {

        return {

            valid: true,

            type:
                cards.length === 4 &&
                normalCards.length === 3
                    ? "four-joker"
                    : "group",

            power:
                uniqueRanks[0]

        };

    }


    /* 階段 */

    if (
        jokerCount === 0 &&
        cards.length >= 3
    ) {

        let staircase =
            true;

        for (
            let i = 1;
            i < uniqueRanks.length;
            i++
        ) {

            if (
                uniqueRanks[i] !==
                uniqueRanks[i - 1] + 1
            ) {

                staircase =
                    false;

                break;

            }

        }

        if (
            staircase &&
            uniqueRanks.length ===
            cards.length
        ) {

            return {

                valid: true,

                type:
                    "staircase",

                power:
                    uniqueRanks[
                        uniqueRanks.length - 1
                    ]

            };

        }

    }

    return {

        valid: false,

        type: null,

        power: 0

    };

}


/* =========================================================
   大富豪の場に出せるか
========================================================= */

function canPlayDaifugo(
    cards,
    lastPlay,
    revolution
) {

    const current =
        analyzeDaifugoPlay(
            cards
        );

    if (
        !current.valid
    ) {
        return false;
    }

    if (!lastPlay) {
        return true;
    }

    const previous =
        lastPlay;

    /* 同じ枚数 */

    if (
        cards.length !==
        previous.count
    ) {

        return false;

    }

    /* 同じ種類 */

    if (
        current.type !==
        previous.type
    ) {

        return false;

    }

    /* 強さ */

    if (revolution) {

        return (
            current.power <
            previous.power
        );

    }

    return (
        current.power >
        previous.power
    );

}


/* =========================================================
   大富豪カードを出す
========================================================= */

async function playDaifugoCards(
    room
) {

    if (
        !room ||
        !room.gameState
    ) {
        return;
    }

    const state =
        room.gameState;

    const playerIndex =
        state.currentPlayer;

    const player =
        state.players[
            playerIndex
        ];

    if (!player) {
        return;
    }

    if (
        player.name !==
        username
    ) {

        alert(
            "今はあなたの番ではありません。"
        );

        return;
    }

    if (
        selectedDaifugoCards.length === 0
    ) {

        alert(
            "カードを選択してください。"
        );

        return;
    }

    const cards =
        selectedDaifugoCards.map(
            index =>
                player.hand[index]
        );

    const analysis =
        analyzeDaifugoPlay(
            cards
        );

    if (
        !analysis.valid
    ) {

        alert(
            "そのカードの組み合わせは出せません。"
        );

        return;
    }

    const lastPlay =
        state.lastPlay;

    if (
        lastPlay &&
        !canPlayDaifugo(
            cards,
            lastPlay,
            state.revolution
        )
    ) {

        alert(
            "場に出ているカードより強い組み合わせを選んでください。"
        );

        return;
    }

    const roomRef =
        doc(
            db,
            "gameRooms",
            room.id
        );

    try {

        await runTransaction(
            db,
            async transaction => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );

                if (
                    !snapshot.exists()
                ) {

                    throw new Error(
                        "ゲームルームがありません。"
                    );

                }

                const latest =
                    snapshot.data();

                const latestState =
                    latest.gameState;

                const latestPlayer =
                    latestState.players[
                        latestState.currentPlayer
                    ];

                if (
                    latestPlayer.name !==
                    username
                ) {

                    throw new Error(
                        "現在の手番ではありません。"
                    );

                }

                const newHand =
                    [
                        ...latestPlayer.hand
                    ];

                const indexes =
                    [...selectedDaifugoCards]
                        .sort(
                            (a, b) =>
                                b - a
                        );

                const playedCards =
                    [];

                for (
                    const index of indexes
                ) {

                    if (
                        !newHand[index]
                    ) {
                        throw new Error(
                            "カード情報が不正です。"
                        );
                    }

                    playedCards.push(
                        newHand[index]
                    );

                    newHand.splice(
                        index,
                        1
                    );

                }

                playedCards.reverse();

                const newPlayers =
                    latestState.players.map(
                        p => ({
                            ...p,
                            hand:
                                [...p.hand]
                        })
                    );

                newPlayers[
                    latestState.currentPlayer
                ].hand =
                    newHand;

                let winner =
                    latestState.winner;

                if (
                    newHand.length === 0
                ) {

                    winner =
                        username;

                }

                let nextPlayer =
                    findNextDaifugoPlayer(
                        latestState,
                        latestState.currentPlayer
                    );

                const newLastPlay = {

                    cards:
                        playedCards,

                    count:
                        playedCards.length,

                    type:
                        analysis.type,

                    power:
                        analysis.power,

                    player:
                        username

                };

                let revolution =
                    latestState.revolution;

                if (
                    latestState.rules.revolution &&
                    playedCards.length === 4
                ) {

                    revolution =
                        !revolution;

                }

                const newState = {

                    ...latestState,

                    players:
                        newPlayers,

                    currentPlayer:
                        nextPlayer,

                    lastPlay:
                        newLastPlay,

                    lastPlayer:
                        latestState.currentPlayer,

                    consecutivePasses:
                        0,

                    revolution:
                        revolution,

                    winner:
                        winner

                };

                transaction.update(
                    roomRef,
                    {
                        gameState:
                            newState,

                        updatedAt:
                            serverTimestamp()
                    }
                );

            }
        );

        selectedDaifugoCards =
            [];

    } catch (error) {

        console.error(
            "大富豪エラー:",
            error
        );

        alert(
            error.message ||
            "カードを出せませんでした。"
        );

    }

}


/* =========================================================
   次のプレイヤー
========================================================= */

function findNextDaifugoPlayer(
    state,
    currentIndex
) {

    const players =
        state.players;

    for (
        let i = 1;
        i <= players.length;
        i++
    ) {

        const index =
            (
                currentIndex + i
            ) %
            players.length;

        const player =
            players[index];

        if (
            player &&
            !player.finished &&
            player.hand.length > 0
        ) {

            return index;

        }

    }

    return currentIndex;

}


/* =========================================================
   パス
========================================================= */

async function passDaifugoTurn(
    room
) {

    if (
        !room?.gameState
    ) {
        return;
    }

    const state =
        room.gameState;

    const currentIndex =
        state.currentPlayer;

    const player =
        state.players[
            currentIndex
        ];

    if (
        !player ||
        player.name !==
        username
    ) {

        return;
    }

    if (!state.lastPlay) {

        alert(
            "最初のカードはパスできません。"
        );

        return;
    }

    const roomRef =
        doc(
            db,
            "gameRooms",
            room.id
        );

    try {

        await runTransaction(
            db,
            async transaction => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );

                if (
                    !snapshot.exists()
                ) {
                    throw new Error(
                        "ルームがありません。"
                    );
                }

                const latest =
                    snapshot.data();

                const latestState =
                    latest.gameState;

                const latestPlayer =
                    latestState.players[
                        latestState.currentPlayer
                    ];

                if (
                    latestPlayer.name !==
                    username
                ) {
                    throw new Error(
                        "現在の手番ではありません。"
                    );
                }

                let passes =
                    (
                        latestState.consecutivePasses ||
                        0
                    ) + 1;

                let nextPlayer =
                    findNextDaifugoPlayer(
                        latestState,
                        latestState.currentPlayer
                    );

                /*
                 * 全員がパスしたら場を流す
                 */

                const activePlayers =
                    latestState.players.filter(
                        p =>
                            !p.finished &&
                            p.hand.length > 0
                    );

                if (
                    passes >=
                    activePlayers.length - 1
                ) {

                    passes = 0;

                    const newState = {

                        ...latestState,

                        lastPlay:
                            null,

                        lastPlayer:
                            null,

                        consecutivePasses:
                            0,

                        currentPlayer:
                            nextPlayer

                    };

                    transaction.update(
                        roomRef,
                        {
                            gameState:
                                newState,

                            updatedAt:
                                serverTimestamp()
                        }
                    );

                    return;

                }

                const newState = {

                    ...latestState,

                    currentPlayer:
                        nextPlayer,

                    consecutivePasses:
                        passes

                };

                transaction.update(
                    roomRef,
                    {
                        gameState:
                            newState,

                        updatedAt:
                            serverTimestamp()
                    }
                );

            }
        );

        selectedDaifugoCards =
            [];

    } catch (error) {

        console.error(
            "大富豪パスエラー:",
            error
        );

        alert(
            error.message ||
            "パスできませんでした。"
        );

    }

}


/* =========================================================
   大富豪画面描画
========================================================= */

function renderDaifugoGame(
    container,
    room
) {

    if (!container) {
        return;
    }

    const state =
        room.gameState;

    if (!state) {
        return;
    }

    container.innerHTML = "";

    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "🃏 大富豪";

    container.appendChild(
        title
    );


    /* 現在の状態 */

    const status =
        document.createElement(
            "div"
        );

    status.className =
        "game-status";

    const current =
        state.players[
            state.currentPlayer
        ];

    if (
        state.winner
    ) {

        status.textContent =
            `🏆 ${state.winner} の勝ち！`;

    } else {

        status.textContent =
            `現在の番：${current?.name || ""}`;

        if (
            state.revolution
        ) {

            status.textContent +=
                "　🔄 革命中";

        }

    }

    container.appendChild(
        status
    );


    /* 場 */

    const field =
        document.createElement(
            "div"
        );

    field.className =
        "daifugo-field";

    if (
        state.lastPlay &&
        state.lastPlay.cards
    ) {

        field.textContent =
            "場： " +
            state.lastPlay.cards
                .map(
                    getDaifugoCardName
                )
                .join(" ");

    } else {

        field.textContent =
            "場：なし";

    }

    container.appendChild(
        field
    );


    /* 自分の手札 */

    const me =
        state.players.find(
            player =>
                player.name ===
                username
        );

    if (!me) {
        return;
    }

    const handTitle =
        document.createElement(
            "h4"
        );

    handTitle.textContent =
        `あなたの手札（${me.hand.length}枚）`;

    container.appendChild(
        handTitle
    );

    const hand =
        document.createElement(
            "div"
        );

    hand.className =
        "daifugo-hand";


    me.hand.forEach(
        (card, index) => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "daifugo-card";

            if (
                selectedDaifugoCards.includes(
                    index
                )
            ) {

                button.classList.add(
                    "selected"
                );

            }

            button.textContent =
                getDaifugoCardName(
                    card
                );

            button.addEventListener(
                "click",
                () => {

                    toggleDaifugoCard(
                        room,
                        index
                    );

                }
            );

            hand.appendChild(
                button
            );

        }
    );

    container.appendChild(
        hand
    );


    /* 操作ボタン */

    const controls =
        document.createElement(
            "div"
        );

    controls.className =
        "game-controls";


    const playButton =
        document.createElement(
            "button"
        );

    playButton.type =
        "button";

    playButton.textContent =
        "カードを出す";

    playButton.className =
        "primary-button";

    playButton.disabled =
        !(
            current &&
            current.name ===
            username &&
            !state.winner
        );

    playButton.addEventListener(
        "click",
        () => {

            playDaifugoCards(
                room
            );

        }
    );


    const passButton =
        document.createElement(
            "button"
        );

    passButton.type =
        "button";

    passButton.textContent =
        "パス";

    passButton.className =
        "secondary-button";

    passButton.disabled =
        !(
            current &&
            current.name ===
            username &&
            !state.winner
        );

    passButton.addEventListener(
        "click",
        () => {

            passDaifugoTurn(
                room
            );

        }
    );


    controls.appendChild(
        playButton
    );

    controls.appendChild(
        passButton
    );

    container.appendChild(
        controls
    );


    /* プレイヤー一覧 */

    const playersTitle =
        document.createElement(
            "h4"
        );

    playersTitle.textContent =
        "プレイヤー";

    container.appendChild(
        playersTitle
    );

    const players =
        document.createElement(
            "div"
        );

    players.className =
        "daifugo-players";

    state.players.forEach(
        (player, index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "daifugo-player";

            if (
                index ===
                state.currentPlayer
            ) {

                item.classList.add(
                    "current"
                );

            }

            item.textContent =
                `${player.name}　${player.hand.length}枚`;

            players.appendChild(
                item
            );

        }
    );

    container.appendChild(
        players
    );

}


/* =========================================================
   大富豪ゲーム描画を接続
========================================================= */

const oldRenderGameBeforeDaifugo =
    renderCurrentGame;

renderCurrentGame =
    function (room) {

        oldRenderGameBeforeDaifugo(
            room
        );

        if (
            room?.gameType ===
            "daifugo"
        ) {

            const area =
                document.getElementById(
                    "gameArea"
                );

            if (area) {

                renderDaifugoGame(
                    area,
                    room
                );

            }

        }

    };


/* =========================================================
   ゲームを開いたときのカード選択解除
========================================================= */

function resetDaifugoSelection() {

    selectedDaifugoCards =
        [];

}

/* =========================================================
   ②-11 大富豪 特殊ルール
   革命 / 8切り / 11バック / 縛り / スキップ
========================================================= */


/* =========================================================
   特殊ルール用の状態を初期化
========================================================= */

function ensureDaifugoRuleState(state) {

    if (!state) {
        return state;
    }

    if (!state.rules) {

        state.rules = {};

    }

    const defaults = {

        revolution: true,
        staircase: true,
        bind: true,
        eightCut: true,
        elevenBack: true,
        joker: true,
        skip: true,
        sevenTransfer: true,
        tenDiscard: true,
        twelveBomb: true,
        downNumber: true

    };

    for (const key of Object.keys(defaults)) {

        if (
            typeof state.rules[key] !==
            "boolean"
        ) {

            state.rules[key] =
                defaults[key];

        }

    }

    if (
        typeof state.revolution !==
        "boolean"
    ) {

        state.revolution =
            false;

    }

    if (
        typeof state.elevenBack !==
        "boolean"
    ) {

        state.elevenBack =
            false;

    }

    if (
        typeof state.skipCount !==
        "number"
    ) {

        state.skipCount =
            0;

    }

    if (
        typeof state.bindSuit !==
        "string"
    ) {

        state.bindSuit =
            "";

    }

    return state;

}


/* =========================================================
   カードの数字を取得
========================================================= */

function getDaifugoRank(card) {

    if (!card) {
        return 0;
    }

    if (card.joker) {
        return 16;
    }

    return Number(
        card.rank || 0
    );

}


/* =========================================================
   革命時の強さ
========================================================= */

function getDaifugoPower(
    card,
    revolution
) {

    const rank =
        getDaifugoRank(
            card
        );

    if (!revolution) {

        return rank;

    }

    /*
     * 革命時は3が最強、
     * 2が最弱になる
     */

    const revolutionPower = {

        3: 15,
        4: 14,
        5: 13,
        6: 12,
        7: 11,
        8: 10,
        9: 9,
        10: 8,
        11: 7,
        12: 6,
        13: 5,
        14: 4,
        15: 3,
        16: 2

    };

    return (
        revolutionPower[rank] ||
        rank
    );

}


/* =========================================================
   場に出すカードの強さを計算
========================================================= */

function getDaifugoPlayPower(
    cards,
    revolution
) {

    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        return 0;

    }

    const powers =
        cards.map(
            card =>
                getDaifugoPower(
                    card,
                    revolution
                )
        );

    return Math.max(
        ...powers
    );

}


/* =========================================================
   8切り
========================================================= */

function isDaifugoEightCut(
    cards,
    rules
) {

    if (
        !rules?.eightCut
    ) {

        return false;

    }

    return cards.some(
        card =>
            !card.joker &&
            Number(card.rank) === 8
    );

}


/* =========================================================
   11バック
========================================================= */

function isDaifugoElevenBack(
    cards,
    rules
) {

    if (
        !rules?.elevenBack
    ) {

        return false;

    }

    return cards.some(
        card =>
            !card.joker &&
            Number(card.rank) === 11
    );

}


/* =========================================================
   革命
========================================================= */

function isDaifugoRevolution(
    cards,
    rules
) {

    if (
        !rules?.revolution
    ) {

        return false;

    }

    /*
     * 一般的な4枚以上の同時出しを
     * 革命として扱う
     */

    return (
        cards.length >= 4 &&
        analyzeDaifugoPlay(
            cards
        ).valid
    );

}


/* =========================================================
   縛り判定
========================================================= */

function getDaifugoSuit(
    card
) {

    if (
        !card ||
        card.joker
    ) {

        return "";

    }

    return (
        card.suit ||
        ""
    );

}


function canApplyDaifugoBind(
    previousCards,
    currentCards,
    rules
) {

    if (
        !rules?.bind
    ) {

        return false;

    }

    if (
        !Array.isArray(
            previousCards
        ) ||
        !Array.isArray(
            currentCards
        )
    ) {

        return false;

    }

    if (
        previousCards.length !==
        currentCards.length
    ) {

        return false;

    }

    /*
     * ジョーカーを含む場合は
     * 今回は縛り対象外
     */

    if (
        previousCards.some(
            card => card.joker
        ) ||
        currentCards.some(
            card => card.joker
        )
    ) {

        return false;

    }

    const previousSuits =
        [
            ...new Set(
                previousCards.map(
                    getDaifugoSuit
                )
            )
        ];

    const currentSuits =
        [
            ...new Set(
                currentCards.map(
                    getDaifugoSuit
                )
            )
        ];

    if (
        previousSuits.length !== 1 ||
        currentSuits.length !== 1
    ) {

        return false;

    }

    return (
        previousSuits[0] ===
        currentSuits[0]
    );

}


/* =========================================================
   縛りを状態に反映
========================================================= */

function updateDaifugoBindState(
    state,
    previousCards,
    currentCards
) {

    if (
        !state?.rules?.bind
    ) {

        state.bindSuit =
            "";

        return state;

    }

    if (
        canApplyDaifugoBind(
            previousCards,
            currentCards,
            state.rules
        )
    ) {

        state.bindSuit =
            getDaifugoSuit(
                currentCards[0]
            );

    } else {

        state.bindSuit =
            "";

    }

    return state;

}


/* =========================================================
   縛り中か確認
========================================================= */

function isDaifugoBindSatisfied(
    state,
    cards
) {

    if (
        !state?.bindSuit
    ) {

        return true;

    }

    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        return false;

    }

    if (
        cards.some(
            card =>
                card.joker
        )
    ) {

        return false;

    }

    return cards.every(
        card =>
            getDaifugoSuit(
                card
            ) ===
            state.bindSuit
    );

}


/* =========================================================
   スキップ
========================================================= */

function applyDaifugoSkip(
    state
) {

    if (
        !state?.rules?.skip
    ) {

        return state;

    }

    if (
        !state.lastPlay
    ) {

        state.skipCount =
            0;

        return state;

    }

    /*
     * パス回数を使って
     * 次のプレイヤーを決める
     */

    state.skipCount =
        Number(
            state.skipCount || 0
        ) + 1;

    return state;

}


/* =========================================================
   場が流れたときのリセット
========================================================= */

function resetDaifugoField(
    state
) {

    if (!state) {
        return state;
    }

    state.lastPlay =
        null;

    state.lastPlayer =
        null;

    state.consecutivePasses =
        0;

    state.skipCount =
        0;

    state.bindSuit =
        "";

    return state;

}


/* =========================================================
   特殊効果をまとめて適用
========================================================= */

function applyDaifugoSpecialRules(
    state,
    cards,
    previousCards
) {

    ensureDaifugoRuleState(
        state
    );


    /* 革命 */

    if (
        isDaifugoRevolution(
            cards,
            state.rules
        )
    ) {

        state.revolution =
            !state.revolution;

    }


    /* 11バック */

    if (
        isDaifugoElevenBack(
            cards,
            state.rules
        )
    ) {

        state.elevenBack =
            !state.elevenBack;

    }


    /* 縛り */

    updateDaifugoBindState(
        state,
        previousCards,
        cards
    );


    /* 8切り */

    if (
        isDaifugoEightCut(
            cards,
            state.rules
        )
    ) {

        resetDaifugoField(
            state
        );

    }

    return state;

}


/* =========================================================
   特殊ルール込みの強さ比較
========================================================= */

function canPlayDaifugoWithRules(
    state,
    cards
) {

    if (
        !state
    ) {

        return false;

    }

    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        return false;

    }

    const analysis =
        analyzeDaifugoPlay(
            cards
        );

    if (
        !analysis.valid
    ) {

        return false;

    }


    /* 場がない */

    if (
        !state.lastPlay
    ) {

        return true;

    }


    /* 枚数 */

    if (
        cards.length !==
        state.lastPlay.count
    ) {

        return false;

    }


    /* 種類 */

    if (
        analysis.type !==
        state.lastPlay.type
    ) {

        return false;

    }


    /* 縛り */

    if (
        !isDaifugoBindSatisfied(
            state,
            cards
        )
    ) {

        return false;

    }


    const currentPower =
        getDaifugoPlayPower(
            cards,
            state.revolution
        );

    const previousPower =
        Number(
            state.lastPlay.power || 0
        );


    /*
     * 11バック中は
     * 強さの比較を逆にする
     */

    const reverse =
        Boolean(
            state.elevenBack
        );


    if (reverse) {

        return (
            currentPower <
            previousPower
        );

    }

    return (
        currentPower >
        previousPower
    );

}


/* =========================================================
   大富豪の現在状態を画面表示
========================================================= */

function renderDaifugoRuleStatus(
    container,
    state
) {

    if (!container) {
        return;
    }

    const rules =
        state?.rules || {};

    const ruleBox =
        document.createElement(
            "div"
        );

    ruleBox.className =
        "daifugo-rule-status";

    const title =
        document.createElement(
            "div"
        );

    title.textContent =
        "現在の特殊状態";

    title.className =
        "rule-title";

    ruleBox.appendChild(
        title
    );


    const states = [];


    if (
        state?.revolution
    ) {

        states.push(
            "🔄 革命"
        );

    }


    if (
        state?.elevenBack
    ) {

        states.push(
            "↩️ 11バック"
        );

    }


    if (
        state?.bindSuit
    ) {

        states.push(
            `🔒 ${state.bindSuit}縛り`
        );

    }


    if (
        states.length === 0
    ) {

        states.push(
            "通常状態"
        );

    }


    const text =
        document.createElement(
            "div"
        );

    text.textContent =
        states.join(
            "　"
        );

    ruleBox.appendChild(
        text
    );

    container.appendChild(
        ruleBox
    );

}


/* =========================================================
   ②-11用：大富豪描画を拡張
========================================================= */

const daifugoRenderWithRules =
    renderCurrentGame;

renderCurrentGame =
    function (room) {

        daifugoRenderWithRules(
            room
        );

        if (
            room?.gameType !==
            "daifugo"
        ) {

            return;

        }

        const area =
            document.getElementById(
                "gameArea"
            );

        if (!area) {
            return;
        }

        const state =
            room.gameState;

        ensureDaifugoRuleState(
            state
        );

        renderDaifugoRuleStatus(
            area,
            state
        );

    };

/* =========================================================
   ②-12 将棋 拡張ルール
   成り / 持ち駒 / 二歩 / 王手チェック
========================================================= */


/* =========================================================
   将棋の駒情報
========================================================= */

const SHOGI_PIECES = {

    FU: "歩",
    KY: "香",
    KE: "桂",
    GI: "銀",
    KI: "金",
    KA: "角",
    HI: "飛",
    OU: "王"

};


/* =========================================================
   成り駒
========================================================= */

const SHOGI_PROMOTED = {

    "歩": "と",
    "香": "成香",
    "桂": "成桂",
    "銀": "成銀",
    "角": "馬",
    "飛": "龍"

};


const SHOGI_UNPROMOTED = {

    "と": "歩",
    "成香": "香",
    "成桂": "桂",
    "成銀": "銀",
    "馬": "角",
    "龍": "飛"

};


/* =========================================================
   成れる駒か
========================================================= */

function canPromoteShogiPiece(
    piece
) {

    return Boolean(
        SHOGI_PROMOTED[piece]
    );

}


/* =========================================================
   成り後の駒
========================================================= */

function getPromotedShogiPiece(
    piece
) {

    return (
        SHOGI_PROMOTED[piece] ||
        piece
    );

}


/* =========================================================
   元の駒に戻す
========================================================= */

function getUnpromotedShogiPiece(
    piece
) {

    return (
        SHOGI_UNPROMOTED[piece] ||
        piece
    );

}


/* =========================================================
   成りゾーン
========================================================= */

function isInShogiPromotionZone(
    row,
    player
) {

    if (
        player === "sente"
    ) {

        return row <= 2;

    }

    if (
        player === "gote"
    ) {

        return row >= 6;

    }

    return false;

}


/* =========================================================
   成り可能判定
========================================================= */

function canPromoteOnShogiMove(
    piece,
    fromRow,
    toRow,
    player
) {

    if (
        !canPromoteShogiPiece(
            piece
        )
    ) {

        return false;

    }

    return (
        isInShogiPromotionZone(
            fromRow,
            player
        ) ||
        isInShogiPromotionZone(
            toRow,
            player
        )
    );

}


/* =========================================================
   強制成り
========================================================= */

function mustPromoteShogiPiece(
    piece,
    toRow,
    player
) {

    if (
        piece === "歩" ||
        piece === "香"
    ) {

        if (
            player === "sente" &&
            toRow === 0
        ) {

            return true;

        }

        if (
            player === "gote" &&
            toRow === 8
        ) {

            return true;

        }

    }


    if (
        piece === "桂"
    ) {

        if (
            player === "sente" &&
            toRow <= 1
        ) {

            return true;

        }

        if (
            player === "gote" &&
            toRow >= 7
        ) {

            return true;

        }

    }

    return false;

}


/* =========================================================
   持ち駒を初期化
========================================================= */

function createInitialShogiCapturedPieces() {

    return {

        sente: [],
        gote: []

    };

}


/* =========================================================
   持ち駒に追加
========================================================= */

function addCapturedShogiPiece(
    captured,
    player,
    piece
) {

    if (!captured) {
        return;
    }

    if (
        !Array.isArray(
            captured[player]
        )
    ) {

        captured[player] =
            [];

    }

    const original =
        getUnpromotedShogiPiece(
            piece
        );

    captured[player].push(
        original
    );

}


/* =========================================================
   持ち駒から1枚削除
========================================================= */

function removeCapturedShogiPiece(
    captured,
    player,
    piece
) {

    if (
        !captured?.[player]
    ) {

        return false;

    }

    const index =
        captured[player].indexOf(
            piece
        );

    if (
        index === -1
    ) {

        return false;

    }

    captured[player].splice(
        index,
        1
    );

    return true;

}


/* =========================================================
   二歩チェック
========================================================= */

function hasShogiPawnInFile(
    board,
    player,
    col
) {

    for (
        let row = 0;
        row < 9;
        row++
    ) {

        const piece =
            board[row]?.[col];

        if (
            !piece
        ) {
            continue;
        }

        const basePiece =
            getUnpromotedShogiPiece(
                piece
            );

        if (
            basePiece !== "歩"
        ) {
            continue;
        }

        if (
            isPieceOwnedByPlayer(
                piece,
                row,
                player
            )
        ) {

            return true;

        }

    }

    return false;

}


/* =========================================================
   二歩判定
========================================================= */

function isNifu(
    board,
    player,
    col
) {

    return hasShogiPawnInFile(
        board,
        player,
        col
    );

}


/* =========================================================
   持ち駒の打ち込み可能判定
========================================================= */

function canDropShogiPiece(
    board,
    captured,
    player,
    piece,
    row,
    col
) {

    if (
        !captured?.[player]
    ) {

        return false;

    }

    if (
        !captured[player].includes(
            piece
        )
    ) {

        return false;

    }

    if (
        board[row]?.[col]
    ) {

        return false;

    }


    /* 歩 */

    if (
        piece === "歩"
    ) {

        /*
         * 二歩
         */

        if (
            isNifu(
                board,
                player,
                col
            )
        ) {

            return false;

        }

        /*
         * 最後列には歩を打てない
         */

        if (
            player === "sente" &&
            row === 0
        ) {

            return false;

        }

        if (
            player === "gote" &&
            row === 8
        ) {

            return false;

        }

    }


    /* 香 */

    if (
        piece === "香"
    ) {

        if (
            player === "sente" &&
            row === 0
        ) {

            return false;

        }

        if (
            player === "gote" &&
            row === 8
        ) {

            return false;

        }

    }


    /* 桂 */

    if (
        piece === "桂"
    ) {

        if (
            player === "sente" &&
            row <= 1
        ) {

            return false;

        }

        if (
            player === "gote" &&
            row >= 7
        ) {

            return false;

        }

    }

    return true;

}


/* =========================================================
   王の位置を探す
========================================================= */

function findShogiKing(
    board,
    player
) {

    const kingPieces = [
        "王",
        "玉"
    ];

    for (
        let row = 0;
        row < 9;
        row++
    ) {

        for (
            let col = 0;
            col < 9;
            col++
        ) {

            const piece =
                board[row]?.[col];

            if (
                !kingPieces.includes(
                    piece
                )
            ) {

                continue;

            }

            if (
                isPieceOwnedByPlayer(
                    piece,
                    row,
                    player
                )
            ) {

                return {
                    row,
                    col
                };

            }

        }

    }

    return null;

}


/* =========================================================
   王手チェック
========================================================= */

function isShogiInCheck(
    board,
    player
) {

    const king =
        findShogiKing(
            board,
            player
        );

    if (!king) {

        return true;

    }

    const opponent =
        player === "sente"
            ? "gote"
            : "sente";


    for (
        let row = 0;
        row < 9;
        row++
    ) {

        for (
            let col = 0;
            col < 9;
            col++
        ) {

            const piece =
                board[row]?.[col];

            if (!piece) {
                continue;
            }

            if (
                !isPieceOwnedByPlayer(
                    piece,
                    row,
                    opponent
                )
            ) {

                continue;

            }

            if (
                isValidShogiMove(
                    board,
                    row,
                    col,
                    king.row,
                    king.col,
                    piece,
                    opponent
                )
            ) {

                return true;

            }

        }

    }

    return false;

}


/* =========================================================
   仮に駒を動かした盤面を作る
========================================================= */

function simulateShogiMove(
    board,
    fromRow,
    fromCol,
    toRow,
    toCol
) {

    const newBoard =
        board.map(
            row =>
                [...row]
        );

    const piece =
        newBoard[fromRow]?.[fromCol];

    newBoard[toRow][toCol] =
        piece;

    newBoard[fromRow][fromCol] =
        null;

    return newBoard;

}


/* =========================================================
   自分の王手を残す手を禁止
========================================================= */

function isShogiMoveLeavingKingInCheck(
    board,
    fromRow,
    fromCol,
    toRow,
    toCol,
    player
) {

    const simulated =
        simulateShogiMove(
            board,
            fromRow,
            fromCol,
            toRow,
            toCol
        );

    return isShogiInCheck(
        simulated,
        player
    );

}


/* =========================================================
   王手表示
========================================================= */

function renderShogiCheckStatus(
    container,
    state
) {

    if (!container) {
        return;
    }

    if (
        !state ||
        state.winner
    ) {

        return;

    }

    const currentPlayer =
        state.currentPlayer;

    const board =
        state.board;

    if (
        !board
    ) {

        return;

    }

    if (
        isShogiInCheck(
            board,
            currentPlayer
        )
    ) {

        const check =
            document.createElement(
                "div"
            );

        check.className =
            "shogi-check";

        check.textContent =
            "⚠️ 王手！";

        container.appendChild(
            check
        );

    }

}


/* =========================================================
   将棋の状態を完全化
========================================================= */

function ensureShogiState(
    state
) {

    if (!state) {
        return state;
    }

    if (
        !Array.isArray(
            state.board
        )
    ) {

        state.board =
            createInitialShogiBoard();

    }

    if (
        !state.captured
    ) {

        state.captured =
            createInitialShogiCapturedPieces();

    }

    if (
        !state.currentPlayer
    ) {

        state.currentPlayer =
            "sente";

    }

    if (
        typeof state.winner ===
        "undefined"
    ) {

        state.winner =
            null;

    }

    return state;

}


/* =========================================================
   持ち駒表示
========================================================= */

function renderShogiCapturedPieces(
    container,
    state,
    player
) {

    if (!container) {
        return;
    }

    const pieces =
        state?.captured?.[player] ||
        [];

    const box =
        document.createElement(
            "div"
        );

    box.className =
        "shogi-captured";

    const title =
        document.createElement(
            "div"
        );

    title.textContent =
        player === "sente"
            ? "☗ 持ち駒"
            : "☖ 持ち駒";

    box.appendChild(
        title
    );

    const list =
        document.createElement(
            "div"
        );

    list.className =
        "shogi-captured-list";

    if (
        pieces.length === 0
    ) {

        list.textContent =
            "なし";

    } else {

        pieces.forEach(
            piece => {

                const item =
                    document.createElement(
                        "span"
                    );

                item.className =
                    "shogi-captured-piece";

                item.textContent =
                    piece;

                list.appendChild(
                    item
                );

            }
        );

    }

    box.appendChild(
        list
    );

    container.appendChild(
        box
    );

}


/* =========================================================
   将棋の状態表示を拡張
========================================================= */

const previousShogiRenderAdvanced =
    renderCurrentGame;

renderCurrentGame =
    function (room) {

        previousShogiRenderAdvanced(
            room
        );

        if (
            room?.gameType !==
            "shogi"
        ) {

            return;

        }

        const area =
            document.getElementById(
                "gameArea"
            );

        if (!area) {
            return;
        }

        const state =
            ensureShogiState(
                room.gameState
            );

        const capturedArea =
            document.createElement(
                "div"
            );

        capturedArea.className =
            "shogi-captured-area";

        renderShogiCapturedPieces(
            capturedArea,
            state,
            "gote"
        );

        renderShogiCapturedPieces(
            capturedArea,
            state,
            "sente"
        );

        area.appendChild(
            capturedArea
        );

        renderShogiCheckStatus(
            area,
            state
        );

    };

/* =========================================================
   ②-13 リアルタイムゲーム部屋 安定化
========================================================= */

/*
  この部分では
  ・ゲーム部屋のリアルタイム監視
  ・部屋一覧の自動更新
  ・現在参加している部屋の自動更新
  ・ゲーム終了時の表示
  を安定させます。
*/

let gameRoomsUnsubscribe = null;
let currentGameRoomUnsubscribe = null;


/* ---------------------------------------------------------
   ゲーム部屋一覧をリアルタイム監視
--------------------------------------------------------- */

function startGameRoomsListener() {

    if (gameRoomsUnsubscribe) {
        gameRoomsUnsubscribe();
        gameRoomsUnsubscribe = null;
    }

    const roomsRef = collection(db, "gameRooms");

    gameRoomsUnsubscribe = onSnapshot(
        query(
            roomsRef,
            orderBy("createdAt", "desc")
        ),
        (snapshot) => {

            const rooms = [];

            snapshot.forEach((docSnap) => {

                const data = docSnap.data();

                rooms.push({
                    id: docSnap.id,
                    ...data
                });
            });

            renderGameRooms(rooms);
        },
        (error) => {

            console.error(
                "ゲーム部屋監視エラー:",
                error
            );

            if (gameRoomsEl) {

                gameRoomsEl.innerHTML = `
                    <div class="empty-state">
                        ゲーム部屋を読み込めませんでした
                    </div>
                `;
            }
        }
    );
}


/* ---------------------------------------------------------
   ゲーム部屋へ入る
--------------------------------------------------------- */

async function enterGameRoom(roomId) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(db, "gameRooms", roomId);

        const roomSnap =
            await getDoc(roomRef);


        if (!roomSnap.exists()) {

            alert("このゲーム部屋は削除されています。");

            return;
        }


        const room =
            roomSnap.data();


        const members =
            Array.isArray(room.members)
                ? [...room.members]
                : [];


        const memberUids =
            Array.isArray(room.memberUids)
                ? [...room.memberUids]
                : [];


        /* すでに参加している場合 */

        if (
            memberUids.includes(currentUser.uid)
        ) {

            openGameRoom(roomId);

            return;
        }


        /* ゲーム開始後は新規参加不可 */

        if (room.status === "playing") {

            alert(
                "このゲームはすでに開始されています。"
            );

            return;
        }


        /* 満員 */

        const maxPlayers =
            Number(room.maxPlayers || 2);

        if (
            memberUids.length >= maxPlayers
        ) {

            alert("この部屋は満員です。");

            return;
        }


        members.push(username);

        memberUids.push(
            currentUser.uid
        );


        await updateDoc(
            roomRef,
            {
                members,
                memberUids,
                updatedAt: serverTimestamp()
            }
        );


        openGameRoom(roomId);


    } catch (error) {

        console.error(
            "ゲーム部屋参加エラー:",
            error
        );

        alert(
            "ゲーム部屋に入れませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   現在のゲーム部屋を開く
--------------------------------------------------------- */

function openGameRoom(roomId) {

    selectedGameRoomId = roomId;


    if (currentGameRoomUnsubscribe) {

        currentGameRoomUnsubscribe();

        currentGameRoomUnsubscribe = null;
    }


    const roomRef =
        doc(db, "gameRooms", roomId);


    currentGameRoomUnsubscribe =
        onSnapshot(
            roomRef,
            (snapshot) => {

                if (!snapshot.exists()) {

                    if (gameAreaEl) {

                        gameAreaEl.innerHTML = `
                            <div class="empty-state">
                                このゲーム部屋は削除されました
                            </div>
                        `;
                    }

                    return;
                }


                const room = {
                    id: snapshot.id,
                    ...snapshot.data()
                };


                renderCurrentGame(room);

            },
            (error) => {

                console.error(
                    "現在ゲーム部屋監視エラー:",
                    error
                );

                if (gameAreaEl) {

                    gameAreaEl.innerHTML = `
                        <div class="empty-state">
                            ゲームの接続に失敗しました
                        </div>
                    `;
                }
            }
        );
}


/* ---------------------------------------------------------
   ゲーム部屋監視を終了
--------------------------------------------------------- */

function closeGameRoomListener() {

    if (currentGameRoomUnsubscribe) {

        currentGameRoomUnsubscribe();

        currentGameRoomUnsubscribe = null;
    }

    selectedGameRoomId = null;
}


/* ---------------------------------------------------------
   ゲーム画面から戻る
--------------------------------------------------------- */

window.closeGameRoom = function () {

    closeGameRoomListener();

    if (gameAreaEl) {

        gameAreaEl.innerHTML = `
            <div class="empty-state">

                <div style="font-size:36px;">
                    🎮
                </div>

                <div style="margin-top:10px;">
                    ゲームを選択してください
                </div>

            </div>
        `;
    }
};


/* ---------------------------------------------------------
   ゲームタブを開いたとき
--------------------------------------------------------- */

function initializeGameSystem() {

    startGameRoomsListener();


    if (gameAreaEl) {

        gameAreaEl.innerHTML = `
            <div class="empty-state">

                <div style="font-size:36px;">
                    🎮
                </div>

                <div style="margin-top:10px;">
                    ゲームを選択してください
                </div>

                <div style="
                    font-size:13px;
                    margin-top:6px;
                    opacity:.7;
                ">
                    大富豪・オセロ・将棋
                </div>

            </div>
        `;
    }
}


/* ---------------------------------------------------------
   ゲームタブ切り替え時の処理
--------------------------------------------------------- */

document
    .querySelectorAll(".game-type")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const type =
                    button.dataset.type ||
                    button.dataset.game ||
                    button.dataset.gameType;


                if (!type) {

                    console.warn(
                        "ゲーム種類が取得できません:",
                        button
                    );

                    return;
                }


                createGameRoom(type);
            }
        );
    });


/* ---------------------------------------------------------
   ページ終了時
--------------------------------------------------------- */

window.addEventListener(
    "beforeunload",
    () => {

        if (gameRoomsUnsubscribe) {
            gameRoomsUnsubscribe();
        }

        if (currentGameRoomUnsubscribe) {
            currentGameRoomUnsubscribe();
        }
    }
);

/* =========================================================
   ②-14 ゲーム部屋作成・開始処理
========================================================= */


/* ---------------------------------------------------------
   ゲームごとの最大人数
--------------------------------------------------------- */

function getGameMaxPlayers(gameType) {

    if (gameType === "daifugo") {
        return 4;
    }

    if (gameType === "othello") {
        return 2;
    }

    if (gameType === "shogi") {
        return 2;
    }

    return 2;
}



/* ---------------------------------------------------------
   部屋を作成
--------------------------------------------------------- */

async function createGameRoom(gameType) {

    if (!currentUser) {

        alert("ログインしてください。");

        return;
    }


    const allowedTypes = [
        "daifugo",
        "othello",
        "shogi"
    ];


    if (!allowedTypes.includes(gameType)) {

        alert("対応していないゲームです。");

        return;
    }


    try {

        const maxPlayers =
            getGameMaxPlayers(gameType);


        const gameName =
            getGameTypeName(gameType);


        const roomRef =
            doc(collection(db, "gameRooms"));


        const initialState =
            createInitialGameState(
                gameType,
                [username]
            );


        await setDoc(
            roomRef,
            {

                gameType,

                gameName,

                hostUid:
                    currentUser.uid,

                hostName:
                    username,

                members: [
                    username
                ],

                memberUids: [
                    currentUser.uid
                ],

                maxPlayers,

                status: "waiting",

                gameState:
                    initialState,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()

            }
        );


        openGameRoom(roomRef.id);


    } catch (error) {

        console.error(
            "ゲーム部屋作成エラー:",
            error
        );

        alert(
            "ゲーム部屋を作成できませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   ゲーム開始
--------------------------------------------------------- */

async function startGameRoom(roomId) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(db, "gameRooms", roomId);


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const members =
                    Array.isArray(room.memberUids)
                        ? room.memberUids
                        : [];


                if (
                    room.hostUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_HOST"
                    );
                }


                if (
                    room.status !==
                    "waiting"
                ) {

                    throw new Error(
                        "ALREADY_STARTED"
                    );
                }


                const maxPlayers =
                    Number(
                        room.maxPlayers || 2
                    );


                if (
                    members.length < 2
                ) {

                    throw new Error(
                        "NOT_ENOUGH_PLAYERS"
                    );
                }


                if (
                    members.length >
                    maxPlayers
                ) {

                    throw new Error(
                        "TOO_MANY_PLAYERS"
                    );
                }


                const gameState =
                    room.gameState ||
                    createInitialGameState(
                        room.gameType,
                        room.members || []
                    );


                gameState.phase =
                    "playing";


                gameState.currentPlayerIndex =
                    0;


                gameState.turnCount =
                    0;


                transaction.update(
                    roomRef,
                    {

                        status: "playing",

                        gameState,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


    } catch (error) {

        console.error(
            "ゲーム開始エラー:",
            error
        );


        if (
            error.message ===
            "NOT_HOST"
        ) {

            alert(
                "ゲームを開始できるのは部屋の作成者です。"
            );

            return;
        }


        if (
            error.message ===
            "NOT_ENOUGH_PLAYERS"
        ) {

            alert(
                "2人以上参加してから開始してください。"
            );

            return;
        }


        if (
            error.message ===
            "ALREADY_STARTED"
        ) {

            alert(
                "このゲームはすでに開始されています。"
            );

            return;
        }


        alert(
            "ゲームを開始できませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   ゲーム終了
--------------------------------------------------------- */

async function finishGameRoom(
    roomId,
    winnerName
) {

    try {

        const roomRef =
            doc(db, "gameRooms", roomId);


        await updateDoc(
            roomRef,
            {

                status: "finished",

                "gameState.phase":
                    "finished",

                "gameState.winner":
                    winnerName || null,

                updatedAt:
                    serverTimestamp()

            }
        );


    } catch (error) {

        console.error(
            "ゲーム終了処理エラー:",
            error
        );
    }
}


/* ---------------------------------------------------------
   外部から使えるようにする
--------------------------------------------------------- */

window.createGameRoom =
    createGameRoom;

window.startGameRoom =
    startGameRoom;

window.finishGameRoom =
    finishGameRoom;

window.leaveGameRoom =
    leaveGameRoom;

window.enterGameRoom =
    enterGameRoom;

/* =========================================================
   ②-15 大富豪
   カード生成・配布・手札・カード選択・場に出す
========================================================= */


/* ---------------------------------------------------------
   大富豪カード
--------------------------------------------------------- */

const DAIHUGO_SUITS = [
    "♠",
    "♥",
    "♦",
    "♣"
];

const DAIHUGO_RANKS = [
    {
        value: 3,
        label: "3"
    },
    {
        value: 4,
        label: "4"
    },
    {
        value: 5,
        label: "5"
    },
    {
        value: 6,
        label: "6"
    },
    {
        value: 7,
        label: "7"
    },
    {
        value: 8,
        label: "8"
    },
    {
        value: 9,
        label: "9"
    },
    {
        value: 10,
        label: "10"
    },
    {
        value: 11,
        label: "J"
    },
    {
        value: 12,
        label: "Q"
    },
    {
        value: 13,
        label: "K"
    },
    {
        value: 14,
        label: "A"
    },
    {
        value: 15,
        label: "2"
    }
];



/* ---------------------------------------------------------
   カード並び順
--------------------------------------------------------- */

function compareDaifugoCards(
    a,
    b
) {

    if (a.isJoker) return 1;

    if (b.isJoker) return -1;


    if (a.value !== b.value) {

        return a.value - b.value;
    }


    return String(a.suit)
        .localeCompare(
            String(b.suit)
        );
}


/* ---------------------------------------------------------
   大富豪を開始
--------------------------------------------------------- */

async function startDaifugoGame(
    roomId
) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                if (
                    room.gameType !==
                    "daifugo"
                ) {

                    throw new Error(
                        "NOT_DAIHUGO"
                    );
                }


                if (
                    room.hostUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_HOST"
                    );
                }


                if (
                    room.status !==
                    "waiting"
                ) {

                    throw new Error(
                        "ALREADY_STARTED"
                    );
                }


                const memberUids =
                    Array.isArray(
                        room.memberUids
                    )
                        ? room.memberUids
                        : [];


                const memberNames =
                    Array.isArray(
                        room.members
                    )
                        ? room.members
                        : [];


                if (
                    memberUids.length <
                    2
                ) {

                    throw new Error(
                        "NOT_ENOUGH_PLAYERS"
                    );
                }


                if (
                    memberUids.length >
                    4
                ) {

                    throw new Error(
                        "TOO_MANY_PLAYERS"
                    );
                }


                const deck =
                    shuffleDaifugoDeck(
                        createDaifugoDeck()
                    );


                const hands =
                    dealDaifugoCards(
                        deck,
                        memberUids.length
                    );


                const handsByUid = {};


                memberUids.forEach(
                    (uid, index) => {

                        handsByUid[uid] =
                            hands[index];
                    }
                );


                const players =
                    memberUids.map(
                        (uid, index) => ({

                            uid,

                            name:
                                memberNames[
                                    index
                                ] ||
                                "プレイヤー",

                            index,

                            finished:
                                false,

                            rank:
                                null

                        })
                    );


                const gameState = {

                    gameType:
                        "daifugo",

                    phase:
                        "playing",

                    players,

                    hands:
                        handsByUid,

                    currentPlayerUid:
                        memberUids[0],

                    currentPlayerIndex:
                        0,

                    selectedCards: [],

                    lastPlayedCards: [],

                    lastPlayerUid:
                        null,

                    passedPlayers: [],

                    revolution:
                        false,

                    lockSuit:
                        null,

                    elevenBack:
                        false,

                    winner:
                        null,

                    turnCount:
                        0,

                    finishedOrder:
                        []

                };


                transaction.update(
                    roomRef,
                    {

                        status:
                            "playing",

                        gameState,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


    } catch (error) {

        console.error(
            "大富豪開始エラー:",
            error
        );


        if (
            error.message ===
            "NOT_HOST"
        ) {

            alert(
                "部屋を作った人だけが開始できます。"
            );

            return;
        }


        if (
            error.message ===
            "NOT_ENOUGH_PLAYERS"
        ) {

            alert(
                "2人以上参加してください。"
            );

            return;
        }


        alert(
            "大富豪を開始できませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   自分の大富豪手札
--------------------------------------------------------- */

function getMyDaifugoHand(
    room
) {

    if (!room) return [];


    const gameState =
        room.gameState || {};


    const hands =
        gameState.hands || {};


    if (!currentUser) return [];


    return Array.isArray(
        hands[currentUser.uid]
    )
        ? hands[currentUser.uid]
        : [];
}


/* ---------------------------------------------------------
   カード選択表示更新
--------------------------------------------------------- */

function refreshDaifugoHandSelection() {

    document
        .querySelectorAll(
            ".daifugo-card"
        )
        .forEach(
            (cardElement) => {

                const id =
                    cardElement.dataset.cardId;


                if (
                    selectedDaifugoCards
                        .includes(id)
                ) {

                    cardElement.classList.add(
                        "selected"
                    );

                } else {

                    cardElement.classList.remove(
                        "selected"
                    );
                }
            }
        );
}


/* ---------------------------------------------------------
   選択カード取得
--------------------------------------------------------- */

function getSelectedDaifugoCards(
    hand
) {

    return hand.filter(
        (card) =>
            selectedDaifugoCards
                .includes(card.id)
    );
}


/* ---------------------------------------------------------
   同じ数字か
--------------------------------------------------------- */

function areSameDaifugoValue(
    cards
) {

    if (!cards.length) {
        return false;
    }


    if (
        cards.some(
            (card) =>
                card.isJoker
        )
    ) {

        return true;
    }


    return cards.every(
        (card) =>
            card.value ===
            cards[0].value
    );
}


/* ---------------------------------------------------------
   階段か
--------------------------------------------------------- */

function isDaifugoSequence(
    cards
) {

    if (
        cards.length < 3
    ) {

        return false;
    }


    const normalCards =
        cards.filter(
            (card) =>
                !card.isJoker
        );


    if (
        normalCards.length !==
        cards.length
    ) {

        return false;
    }


    const sorted =
        [...cards].sort(
            (
                a,
                b
            ) =>
                a.value -
                b.value
        );


    for (
        let i = 1;
        i < sorted.length;
        i++
    ) {

        if (
            sorted[i].value !==
            sorted[i - 1].value + 1
        ) {

            return false;
        }
    }


    const suit =
        sorted[0].suit;


    return sorted.every(
        (card) =>
            card.suit === suit
    );
}


/* ---------------------------------------------------------
   場に出せるか
--------------------------------------------------------- */

function canPlayDaifugoCards(
    selectedCards,
    lastCards,
    revolution
) {

    if (
        !selectedCards ||
        !selectedCards.length
    ) {

        return false;
    }


    /* 1枚 */

    if (
        selectedCards.length === 1
    ) {

        return true;
    }


    /* 同じ数字 */

    if (
        areSameDaifugoValue(
            selectedCards
        )
    ) {

        return true;
    }


    /* 階段 */

    if (
        isDaifugoSequence(
            selectedCards
        )
    ) {

        return true;
    }


    return false;
}


/* ---------------------------------------------------------
   場に出す
--------------------------------------------------------- */

async function playDaifugoCards(
    roomId
) {

    if (!currentUser) return;


    if (
        selectedDaifugoCards.length ===
        0
    ) {

        alert(
            "カードを選択してください。"
        );

        return;
    }


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const game =
                    room.gameState;


                if (
                    !game ||
                    game.gameType !==
                    "daifugo"
                ) {

                    throw new Error(
                        "INVALID_GAME"
                    );
                }


                if (
                    game.phase !==
                    "playing"
                ) {

                    throw new Error(
                        "GAME_NOT_PLAYING"
                    );
                }


                if (
                    game.currentPlayerUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_YOUR_TURN"
                    );
                }


                const hands =
                    game.hands || {};


                const myHand =
                    Array.isArray(
                        hands[currentUser.uid]
                    )
                        ? [
                            ...hands[
                                currentUser.uid
                            ]
                        ]
                        : [];


                const selected =
                    myHand.filter(
                        (card) =>
                            selectedDaifugoCards
                                .includes(
                                    card.id
                                )
                    );


                if (
                    selected.length !==
                    selectedDaifugoCards.length
                ) {

                    throw new Error(
                        "CARD_NOT_FOUND"
                    );
                }


                if (
                    !canPlayDaifugoCards(
                        selected,
                        game.lastPlayedCards ||
                            [],
                        Boolean(
                            game.revolution
                        )
                    )
                ) {

                    throw new Error(
                        "INVALID_COMBINATION"
                    );
                }


                /*
                  手札から削除
                */

                const remaining =
                    myHand.filter(
                        (card) =>
                            !selectedDaifugoCards
                                .includes(
                                    card.id
                                )
                    );


                hands[currentUser.uid] =
                    remaining;


                /*
                  プレイヤー情報更新
                */

                const players =
                    Array.isArray(
                        game.players
                    )
                        ? game.players.map(
                            (player) =>
                                ({
                                    ...player
                                })
                        )
                        : [];


                const player =
                    players.find(
                        (item) =>
                            item.uid ===
                            currentUser.uid
                    );


                let finishedOrder =
                    Array.isArray(
                        game.finishedOrder
                    )
                        ? [
                            ...game.finishedOrder
                        ]
                        : [];


                if (
                    remaining.length ===
                    0 &&
                    player &&
                    !player.finished
                ) {

                    player.finished =
                        true;

                    player.rank =
                        finishedOrder.length +
                        1;


                    finishedOrder.push(
                        currentUser.uid
                    );
                }


                /*
                  場を更新
                */

                game.hands =
                    hands;

                game.players =
                    players;

                game.lastPlayedCards =
                    selected;

                game.lastPlayerUid =
                    currentUser.uid;

                game.finishedOrder =
                    finishedOrder;

                game.turnCount =
                    Number(
                        game.turnCount || 0
                    ) + 1;


                /*
                  全員の順位が決まったら終了
                */

                const activePlayers =
                    players.filter(
                        (item) =>
                            !item.finished
                    );


                if (
                    activePlayers.length <=
                    1
                ) {

                    if (
                        activePlayers.length ===
                        1
                    ) {

                        activePlayers[0]
                            .finished =
                            true;

                        activePlayers[0]
                            .rank =
                            finishedOrder.length +
                            1;

                        finishedOrder.push(
                            activePlayers[0].uid
                        );
                    }


                    game.phase =
                        "finished";


                    game.winner =
                        finishedOrder[0] ||
                        null;

                } else {

                    /*
                      次のプレイヤー
                    */

                    const memberUids =
                        Array.isArray(
                            room.memberUids
                        )
                            ? room.memberUids
                            : [];


                    let nextIndex =
                        memberUids.indexOf(
                            currentUser.uid
                        );


                    for (
                        let i = 0;
                        i < memberUids.length;
                        i++
                    ) {

                        nextIndex =
                            (
                                nextIndex + 1
                            ) %
                            memberUids.length;


                        const nextUid =
                            memberUids[
                                nextIndex
                            ];


                        const nextPlayer =
                            players.find(
                                (item) =>
                                    item.uid ===
                                    nextUid
                            );


                        if (
                            nextPlayer &&
                            !nextPlayer.finished
                        ) {

                            game.currentPlayerUid =
                                nextUid;

                            game.currentPlayerIndex =
                                nextIndex;

                            break;
                        }
                    }
                }


                game.selectedCards =
                    [];


                transaction.update(
                    roomRef,
                    {

                        gameState:
                            game,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "カードを出す処理でエラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );

            return;
        }


        if (
            error.message ===
            "INVALID_COMBINATION"
        ) {

            alert(
                "そのカードの出し方はできません。"
            );

            return;
        }


        alert(
            "カードを出せませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   パス
--------------------------------------------------------- */

async function passDaifugoTurn(
    roomId
) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const game =
                    room.gameState;


                if (
                    game.currentPlayerUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_YOUR_TURN"
                    );
                }


                const passed =
                    Array.isArray(
                        game.passedPlayers
                    )
                        ? [
                            ...game.passedPlayers
                        ]
                        : [];


                if (
                    !passed.includes(
                        currentUser.uid
                    )
                ) {

                    passed.push(
                        currentUser.uid
                    );
                }


                const players =
                    Array.isArray(
                        game.players
                    )
                        ? game.players
                        : [];


                const activePlayers =
                    players.filter(
                        (player) =>
                            !player.finished
                    );


                /*
                  全員がパスしたら場を流す
                */

                if (
                    activePlayers.every(
                        (player) =>
                            passed.includes(
                                player.uid
                            )
                    )
                ) {

                    game.lastPlayedCards =
                        [];

                    game.lastPlayerUid =
                        null;

                    game.passedPlayers =
                        [];

                } else {

                    game.passedPlayers =
                        passed;


                    const memberUids =
                        Array.isArray(
                            room.memberUids
                        )
                            ? room.memberUids
                            : [];


                    let index =
                        memberUids.indexOf(
                            currentUser.uid
                        );


                    for (
                        let i = 0;
                        i < memberUids.length;
                        i++
                    ) {

                        index =
                            (
                                index + 1
                            ) %
                            memberUids.length;


                        const nextUid =
                            memberUids[index];


                        const nextPlayer =
                            players.find(
                                (player) =>
                                    player.uid ===
                                    nextUid
                            );


                        if (
                            nextPlayer &&
                            !nextPlayer.finished &&
                            !passed.includes(
                                nextUid
                            )
                        ) {

                            game.currentPlayerUid =
                                nextUid;

                            game.currentPlayerIndex =
                                index;

                            break;
                        }
                    }
                }


                game.turnCount =
                    Number(
                        game.turnCount || 0
                    ) + 1;


                transaction.update(
                    roomRef,
                    {

                        gameState:
                            game,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "パス処理エラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );
        }
    }
}


/* ---------------------------------------------------------
   大富豪の手札HTML
--------------------------------------------------------- */

function renderDaifugoHand(
    room
) {

    if (!gameAreaEl) return;


    const hand =
        getMyDaifugoHand(room);


    const game =
        room.gameState || {};


    const isMyTurn =
        game.currentPlayerUid ===
        currentUser?.uid;


    const handHTML =
        hand.map(
            (card) => {

                const selected =
                    selectedDaifugoCards
                        .includes(
                            card.id
                        );


                const suitClass =
                    card.suit === "♥" ||
                    card.suit === "♦"
                        ? "red"
                        : "black";


                return `

                    <button
                        type="button"
                        class="daifugo-card
                            ${selected ? "selected" : ""}
                            ${suitClass}"
                        data-card-id="${escapeHtml(card.id)}"
                        ${isMyTurn ? "" : "disabled"}
                    >

                        <span class="daifugo-card-suit">
                            ${escapeHtml(card.suit)}
                        </span>

                        <strong>
                            ${escapeHtml(card.label)}
                        </strong>

                    </button>

                `;
            }
        )
        .join("");


    gameAreaEl.innerHTML = `

        <div class="panel">

            <div class="panel-head">

                <div>
                    <strong>
                        大富豪
                    </strong>
                </div>

                <div>
                    ${
                        isMyTurn
                            ? "あなたの番"
                            : "相手の番"
                    }
                </div>

            </div>


            <div
                class="daifugo-table"
                style="
                    padding:16px;
                    text-align:center;
                "
            >

                <div
                    style="
                        min-height:100px;
                        display:flex;
                        justify-content:center;
                        align-items:center;
                        gap:8px;
                        flex-wrap:wrap;
                    "
                >

                    ${
                        Array.isArray(
                            game.lastPlayedCards
                        ) &&
                        game.lastPlayedCards.length
                            ? game.lastPlayedCards
                                .map(
                                    (card) => `
                                        <div class="daifugo-card black">
                                            <span>
                                                ${escapeHtml(card.suit)}
                                            </span>
                                            <strong>
                                                ${escapeHtml(card.label)}
                                            </strong>
                                        </div>
                                    `
                                )
                                .join("")
                            : `
                                <div
                                    style="
                                        opacity:.5;
                                    "
                                >
                                    場にカードはありません
                                </div>
                            `
                    }

                </div>


                <div
                    style="
                        margin:12px 0;
                    "
                >
                    <button
                        type="button"
                        id="daifugoPlayButton"
                        class="primary-btn"
                        ${isMyTurn ? "" : "disabled"}
                    >
                        選択したカードを出す
                    </button>

                    <button
                        type="button"
                        id="daifugoPassButton"
                        class="secondary-btn"
                        ${isMyTurn ? "" : "disabled"}
                    >
                        パス
                    </button>
                </div>


                <div
                    style="
                        font-size:13px;
                        opacity:.7;
                        margin-bottom:8px;
                    "
                >
                    あなたの手札
                </div>


                <div
                    class="daifugo-hand"
                    style="
                        display:flex;
                        justify-content:center;
                        flex-wrap:wrap;
                        gap:6px;
                    "
                >
                    ${handHTML}
                </div>

            </div>

        </div>
    `;


    /*
      カードクリック
    */

    gameAreaEl
        .querySelectorAll(
            ".daifugo-card[data-card-id]"
        )
        .forEach(
            (cardElement) => {

                cardElement.addEventListener(
                    "click",
                    () => {

                        toggleDaifugoCard(
                            cardElement.dataset
                                .cardId
                        );

                    }
                );

            }
        );


    /*
      出すボタン
    */

    const playButton =
        document.getElementById(
            "daifugoPlayButton"
        );


    if (playButton) {

        playButton.addEventListener(
            "click",
            () => {

                playDaifugoCards(
                    room.id
                );

            }
        );
    }


    /*
      パス
    */

    const passButton =
        document.getElementById(
            "daifugoPassButton"
        );


    if (passButton) {

        passButton.addEventListener(
            "click",
            () => {

                passDaifugoTurn(
                    room.id
                );

            }
        );
    }
}


/* ---------------------------------------------------------
   大富豪表示を現在ゲーム表示に接続
--------------------------------------------------------- */

const previousRenderForDaifugo =
    renderCurrentGame;


renderCurrentGame =
    function(room) {

        if (
            room &&
            room.gameType ===
            "daifugo"
        ) {

            renderDaifugoHand(
                room
            );

            return;
        }


        previousRenderForDaifugo(
            room
        );
    };


/* ---------------------------------------------------------
   大富豪開始ボタンを外部公開
--------------------------------------------------------- */

window.startDaifugoGame =
    startDaifugoGame;

window.playDaifugoCards =
    playDaifugoCards;

window.passDaifugoTurn =
    passDaifugoTurn;

/* =========================================================
   ②-16 大富豪 特殊ルール実装
========================================================= */


/* ---------------------------------------------------------
   カードの強さ
--------------------------------------------------------- */

function getDaifugoCardPower(
    card,
    revolution = false
) {

    if (!card) return 0;


    /*
      ジョーカーは通常最強
    */

    if (card.isJoker) {
        return 100;
    }


    /*
      革命中は強さが逆になる
    */

    if (revolution) {

        /*
          3 → 最強
          2 → 弱い
        */

        return 18 - card.value;
    }


    return card.value;
}


/* ---------------------------------------------------------
   カード枚数が同じか
--------------------------------------------------------- */

function isSameDaifugoCount(
    selected,
    lastPlayed
) {

    if (!lastPlayed || !lastPlayed.length) {
        return true;
    }


    return (
        selected.length ===
        lastPlayed.length
    );
}


/* ---------------------------------------------------------
   ジョーカーを除いた数字
--------------------------------------------------------- */

function getDaifugoNormalValues(
    cards
) {

    return cards
        .filter(
            (card) =>
                !card.isJoker
        )
        .map(
            (card) =>
                card.value
        );
}


/* ---------------------------------------------------------
   縛り判定
--------------------------------------------------------- */

function canUseDaifugoSuitLock(
    selected,
    game
) {

    if (
        !game ||
        !game.lockSuit
    ) {

        return true;
    }


    /*
      ジョーカーだけの場合は
      縛り判定から除外
    */

    const normalCards =
        selected.filter(
            (card) =>
                !card.isJoker
        );


    if (!normalCards.length) {
        return true;
    }


    return normalCards.every(
        (card) =>
            card.suit ===
            game.lockSuit
    );
}


/* ---------------------------------------------------------
   階段の判定
--------------------------------------------------------- */

function isDaifugoValidSequence(
    cards,
    revolution
) {

    if (
        !cards ||
        cards.length < 3
    ) {

        return false;
    }


    const normalCards =
        cards.filter(
            (card) =>
                !card.isJoker
        );


    /*
      今回の階段は
      同じスートのみ
    */

    if (
        normalCards.length !==
        cards.length
    ) {

        return false;
    }


    if (
        !normalCards.length
    ) {

        return false;
    }


    const suit =
        normalCards[0].suit;


    if (
        !normalCards.every(
            (card) =>
                card.suit === suit
        )
    ) {

        return false;
    }


    const sorted =
        [...normalCards].sort(
            (a, b) =>
                getDaifugoCardPower(
                    a,
                    revolution
                ) -
                getDaifugoCardPower(
                    b,
                    revolution
                )
        );


    for (
        let i = 1;
        i < sorted.length;
        i++
    ) {

        const previous =
            getDaifugoCardPower(
                sorted[i - 1],
                revolution
            );


        const current =
            getDaifugoCardPower(
                sorted[i],
                revolution
            );


        if (
            current !==
            previous + 1
        ) {

            return false;
        }
    }


    return true;
}


/* ---------------------------------------------------------
   組み合わせ判定
--------------------------------------------------------- */

function getDaifugoCombinationType(
    cards,
    game
) {

    if (
        !cards ||
        !cards.length
    ) {

        return null;
    }


    const revolution =
        Boolean(
            game?.revolution
        );


    /*
      1枚
    */

    if (
        cards.length === 1
    ) {

        return "single";
    }


    /*
      同じ数字
    */

    if (
        areSameDaifugoValue(
            cards
        )
    ) {

        return "group";
    }


    /*
      階段
    */

    if (
        isDaifugoValidSequence(
            cards,
            revolution
        )
    ) {

        return "sequence";
    }


    return null;
}


/* ---------------------------------------------------------
   場に出せるか
--------------------------------------------------------- */

function canPlayDaifugoCardsAdvanced(
    selectedCards,
    game
) {

    if (
        !selectedCards ||
        !selectedCards.length
    ) {

        return false;
    }


    if (!game) {
        return false;
    }


    const lastPlayed =
        Array.isArray(
            game.lastPlayedCards
        )
            ? game.lastPlayedCards
            : [];


    /*
      縛り
    */

    if (
        !canUseDaifugoSuitLock(
            selectedCards,
            game
        )
    ) {

        return false;
    }


    const type =
        getDaifugoCombinationType(
            selectedCards,
            game
        );


    if (!type) {
        return false;
    }


    /*
      場が空なら出せる
    */

    if (
        lastPlayed.length === 0
    ) {

        return true;
    }


    /*
      枚数を合わせる
    */

    if (
        !isSameDaifugoCount(
            selectedCards,
            lastPlayed
        )
    ) {

        return false;
    }


    /*
      8切り
    */

    if (
        game.eightCut &&
        selectedCards.some(
            (card) =>
                !card.isJoker &&
                card.value === 8
        )
    ) {

        return true;
    }


    /*
      前のカードより強い必要がある
    */

    const selectedPower =
        getDaifugoPlayPower(
            selectedCards,
            Boolean(
                game.revolution
            )
        );


    const lastPower =
        getDaifugoPlayPower(
            lastPlayed,
            Boolean(
                game.revolution
            )
        );


    if (
        selectedPower <=
        lastPower
    ) {

        return false;
    }


    return true;
}


/* ---------------------------------------------------------
   革命判定
--------------------------------------------------------- */

function shouldDaifugoRevolution(
    selectedCards
) {

    /*
      4枚以上の同じ数字
    */

    if (
        selectedCards.length >= 4 &&
        areSameDaifugoValue(
            selectedCards
        )
    ) {

        return true;
    }


    return false;
}


/* ---------------------------------------------------------
   11バック
--------------------------------------------------------- */

function shouldDaifugoElevenBack(
    selectedCards
) {

    return selectedCards.some(
        (card) =>
            !card.isJoker &&
            card.value === 11
    );
}


/* ---------------------------------------------------------
   縛り更新
--------------------------------------------------------- */

function updateDaifugoLock(
    game,
    selectedCards,
    previousCards
) {

    if (
        !previousCards ||
        !previousCards.length
    ) {

        game.lockSuit = null;

        return;
    }


    const previousNormal =
        previousCards.filter(
            (card) =>
                !card.isJoker
        );


    const selectedNormal =
        selectedCards.filter(
            (card) =>
                !card.isJoker
        );


    if (
        !previousNormal.length ||
        !selectedNormal.length
    ) {

        return;
    }


    /*
      前の場と今回のカードが
      同じスートなら縛り
    */

    const previousSuit =
        previousNormal[0].suit;


    const selectedSuit =
        selectedNormal[0].suit;


    if (
        previousSuit ===
        selectedSuit
    ) {

        if (
            selectedNormal.every(
                (card) =>
                    card.suit ===
                    selectedSuit
            )
        ) {

            game.lockSuit =
                selectedSuit;
        }

    } else {

        /*
          違うスートが出たら解除
        */

        game.lockSuit =
            null;
    }
}


/* ---------------------------------------------------------
   場を流す
--------------------------------------------------------- */

function clearDaifugoTable(
    game
) {

    game.lastPlayedCards = [];

    game.lastPlayerUid = null;

    game.passedPlayers = [];

    /*
      縛り解除
    */

    game.lockSuit = null;
}



/* ---------------------------------------------------------
   特殊ルール対応版 カードを出す
--------------------------------------------------------- */

async function playDaifugoCardsAdvanced(
    roomId
) {

    if (!currentUser) return;


    if (
        selectedDaifugoCards.length ===
        0
    ) {

        alert(
            "カードを選択してください。"
        );

        return;
    }


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const game =
                    room.gameState;


                if (
                    !game ||
                    game.gameType !==
                    "daifugo"
                ) {

                    throw new Error(
                        "INVALID_GAME"
                    );
                }


                if (
                    game.phase !==
                    "playing"
                ) {

                    throw new Error(
                        "GAME_FINISHED"
                    );
                }


                if (
                    game.currentPlayerUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_YOUR_TURN"
                    );
                }


                const hands =
                    game.hands || {};


                const myHand =
                    Array.isArray(
                        hands[currentUser.uid]
                    )
                        ? [
                            ...hands[
                                currentUser.uid
                            ]
                        ]
                        : [];


                const selected =
                    myHand.filter(
                        (card) =>
                            selectedDaifugoCards
                                .includes(
                                    card.id
                                )
                    );


                if (
                    selected.length !==
                    selectedDaifugoCards.length
                ) {

                    throw new Error(
                        "CARD_NOT_FOUND"
                    );
                }


                /*
                  8切り判定
                */

                const isEightCut =
                    Boolean(
                        game.eightCut
                    ) &&
                    selected.some(
                        (card) =>
                            !card.isJoker &&
                            card.value === 8
                    );


                /*
                  革命判定
                */

                const isRevolution =
                    shouldDaifugoRevolution(
                        selected
                    );


                /*
                  11バック判定
                */

                const isElevenBack =
                    Boolean(
                        game.elevenBackRule
                    ) &&
                    shouldDaifugoElevenBack(
                        selected
                    );


                /*
                  通常の出せる判定
                */

                if (
                    !isEightCut &&
                    !canPlayDaifugoCardsAdvanced(
                        selected,
                        game
                    )
                ) {

                    throw new Error(
                        "INVALID_COMBINATION"
                    );
                }


                /*
                  前の場を保存
                */

                const previousCards =
                    Array.isArray(
                        game.lastPlayedCards
                    )
                        ? [
                            ...game.lastPlayedCards
                        ]
                        : [];


                /*
                  手札から削除
                */

                hands[currentUser.uid] =
                    myHand.filter(
                        (card) =>
                            !selectedDaifugoCards
                                .includes(
                                    card.id
                                )
                    );


                /*
                  プレイヤー情報
                */

                const players =
                    Array.isArray(
                        game.players
                    )
                        ? game.players.map(
                            (player) =>
                                ({
                                    ...player
                                })
                        )
                        : [];


                const myPlayer =
                    players.find(
                        (player) =>
                            player.uid ===
                            currentUser.uid
                    );


                let finishedOrder =
                    Array.isArray(
                        game.finishedOrder
                    )
                        ? [
                            ...game.finishedOrder
                        ]
                        : [];


                /*
                  上がり
                */

                if (
                    hands[currentUser.uid]
                        .length === 0 &&
                    myPlayer &&
                    !myPlayer.finished
                ) {

                    myPlayer.finished =
                        true;

                    myPlayer.rank =
                        finishedOrder.length +
                        1;


                    finishedOrder.push(
                        currentUser.uid
                    );
                }


                /*
                  場を更新
                */

                game.hands =
                    hands;

                game.players =
                    players;

                game.lastPlayedCards =
                    selected;

                game.lastPlayerUid =
                    currentUser.uid;

                game.finishedOrder =
                    finishedOrder;


                /*
                  革命
                */

                if (isRevolution) {

                    game.revolution =
                        !Boolean(
                            game.revolution
                        );
                }


                /*
                  11バック
                */

                if (isElevenBack) {

                    game.elevenBack =
                        !Boolean(
                            game.elevenBack
                        );
                }


                /*
                  縛り
                */

                updateDaifugoLock(
                    game,
                    selected,
                    previousCards
                );


                /*
                  8切り
                */

                if (isEightCut) {

                    clearDaifugoTable(
                        game
                    );


                    /*
                      8切りした本人から
                      もう一度開始
                    */

                    game.currentPlayerUid =
                        currentUser.uid;

                    game.currentPlayerIndex =
                        room.memberUids.indexOf(
                            currentUser.uid
                        );

                } else {

                    /*
                      上がり人数を確認
                    */

                    const activePlayers =
                        players.filter(
                            (player) =>
                                !player.finished
                        );


                    if (
                        activePlayers.length <=
                        1
                    ) {

                        if (
                            activePlayers.length ===
                            1
                        ) {

                            const lastPlayer =
                                activePlayers[0];


                            lastPlayer.finished =
                                true;


                            lastPlayer.rank =
                                finishedOrder.length +
                                1;


                            finishedOrder.push(
                                lastPlayer.uid
                            );
                        }


                        game.phase =
                            "finished";


                        game.winner =
                            finishedOrder[0] ||
                            null;

                    } else {

                        /*
                          次のプレイヤー
                        */

                        const next =
                            findNextDaifugoPlayer(
                                room,
                                game,
                                currentUser.uid
                            );


                        if (next) {

                            game.currentPlayerUid =
                                next.uid;

                            game.currentPlayerIndex =
                                next.index;
                        }
                    }
                }


                game.selectedCards =
                    [];


                game.turnCount =
                    Number(
                        game.turnCount || 0
                    ) + 1;


                transaction.update(
                    roomRef,
                    {

                        gameState:
                            game,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "特殊ルール付きカード処理エラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );

            return;
        }


        if (
            error.message ===
            "INVALID_COMBINATION"
        ) {

            alert(
                "そのカードは今の場には出せません。"
            );

            return;
        }


        if (
            error.message ===
            "GAME_FINISHED"
        ) {

            alert(
                "このゲームは終了しています。"
            );

            return;
        }


        alert(
            "カードを出せませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   特殊ルール対応版 パス
--------------------------------------------------------- */

async function passDaifugoTurnAdvanced(
    roomId
) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const game =
                    room.gameState;


                if (
                    !game ||
                    game.gameType !==
                    "daifugo"
                ) {

                    throw new Error(
                        "INVALID_GAME"
                    );
                }


                if (
                    game.currentPlayerUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_YOUR_TURN"
                    );
                }


                const players =
                    Array.isArray(
                        game.players
                    )
                        ? game.players
                        : [];


                const activePlayers =
                    players.filter(
                        (player) =>
                            !player.finished
                    );


                const passed =
                    Array.isArray(
                        game.passedPlayers
                    )
                        ? [
                            ...game.passedPlayers
                        ]
                        : [];


                if (
                    !passed.includes(
                        currentUser.uid
                    )
                ) {

                    passed.push(
                        currentUser.uid
                    );
                }


                /*
                  全員がパスした場合、
                  場を流す
                */

                if (
                    activePlayers.every(
                        (player) =>
                            passed.includes(
                                player.uid
                            )
                    )
                ) {

                    clearDaifugoTable(
                        game
                    );


                    /*
                      場を流した後は
                      前の場を出した人から再開
                    */

                    const restartUid =
                        game.lastPlayerUid ||
                        currentUser.uid;


                    const restartPlayer =
                        players.find(
                            (player) =>
                                player.uid ===
                                restartUid &&
                                !player.finished
                        );


                    if (restartPlayer) {

                        game.currentPlayerUid =
                            restartUid;

                        game.currentPlayerIndex =
                            room.memberUids.indexOf(
                                restartUid
                            );

                    } else {

                        const next =
                            findNextDaifugoPlayer(
                                room,
                                game,
                                currentUser.uid
                            );


                        if (next) {

                            game.currentPlayerUid =
                                next.uid;

                            game.currentPlayerIndex =
                                next.index;
                        }
                    }

                } else {

                    game.passedPlayers =
                        passed;


                    const next =
                        findNextDaifugoPlayer(
                            room,
                            game,
                            currentUser.uid
                        );


                    if (next) {

                        game.currentPlayerUid =
                            next.uid;

                        game.currentPlayerIndex =
                            next.index;
                    }
                }


                game.turnCount =
                    Number(
                        game.turnCount || 0
                    ) + 1;


                transaction.update(
                    roomRef,
                    {

                        gameState:
                            game,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "特殊ルール付きパス処理エラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );
        }
    }
}


/* ---------------------------------------------------------
   ゲーム開始時のルール設定
--------------------------------------------------------- */

function applyDaifugoRulesToGame(
    game
) {

    if (!game) return game;


    /*
      基本ルール
    */

    if (
        typeof game.revolution !==
        "boolean"
    ) {

        game.revolution =
            false;
    }


    if (
        typeof game.eightCut !==
        "boolean"
    ) {

        game.eightCut =
            true;
    }


    if (
        typeof game.elevenBack !==
        "boolean"
    ) {

        game.elevenBack =
            false;
    }


    /*
      11バック判定を有効化
    */

    game.elevenBackRule =
        true;


    /*
      縛り
    */

    if (
        !Object.prototype.hasOwnProperty
            .call(
                game,
                "lockSuit"
            )
    ) {

        game.lockSuit =
            null;
    }


    return game;
}


/* ---------------------------------------------------------
   ルール状態表示
--------------------------------------------------------- */

function getDaifugoRuleStatus(
    game
) {

    if (!game) {
        return "";
    }


    const status = [];


    if (game.revolution) {

        status.push(
            "🔄 革命"
        );
    }


    if (game.elevenBack) {

        status.push(
            "🔥 11バック"
        );
    }


    if (game.lockSuit) {

        status.push(
            `🔒 ${game.lockSuit}縛り`
        );
    }


    return status.length
        ? status.join("　")
        : "通常状態";
}


/* ---------------------------------------------------------
   大富豪画面表示を上書き
--------------------------------------------------------- */

const renderDaifugoWithRules =
    renderDaifugoHand;


renderDaifugoHand =
    function(room) {

        if (!room) return;


        const game =
            room.gameState || {};


        applyDaifugoRulesToGame(
            game
        );


        renderDaifugoWithRules(
            room
        );


        if (!gameAreaEl) return;


        const panel =
            gameAreaEl.querySelector(
                ".panel-head"
            );


        if (!panel) return;


        const ruleStatus =
            document.createElement(
                "div"
            );


        ruleStatus.style.fontSize =
            "12px";

        ruleStatus.style.opacity =
            "0.75";

        ruleStatus.style.marginTop =
            "4px";

        ruleStatus.textContent =
            getDaifugoRuleStatus(
                game
            );


        panel.appendChild(
            ruleStatus
        );
    };


/* ---------------------------------------------------------
   大富豪のボタン処理を
   特殊ルール版に変更
--------------------------------------------------------- */

const previousAdvancedRender =
    renderDaifugoHand;


renderDaifugoHand =
    function(room) {

        previousAdvancedRender(
            room
        );


        if (!gameAreaEl) return;


        const playButton =
            gameAreaEl.querySelector(
                "#daifugoPlayButton"
            );


        const passButton =
            gameAreaEl.querySelector(
                "#daifugoPassButton"
            );


        if (playButton) {

            playButton.onclick =
                null;


            playButton.addEventListener(
                "click",
                () => {

                    playDaifugoCardsAdvanced(
                        room.id
                    );

                }
            );
        }


        if (passButton) {

            passButton.onclick =
                null;


            passButton.addEventListener(
                "click",
                () => {

                    passDaifugoTurnAdvanced(
                        room.id
                    );

                }
            );
        }
    };


/* ---------------------------------------------------------
   外部公開
--------------------------------------------------------- */

window.playDaifugoCardsAdvanced =
    playDaifugoCardsAdvanced;

window.passDaifugoTurnAdvanced =
    passDaifugoTurnAdvanced;

window.getDaifugoRuleStatus =
    getDaifugoRuleStatus;

        /*
          革命
        */

        if (isRevolution) {
            game.revolution =
                !Boolean(
                    game.revolution
                );
        }


        /*
          11バック
        */

        if (isElevenBack) {
            game.elevenBack =
                !Boolean(
                    game.elevenBack
                );
        }


        /*
          縛り
        */

        updateDaifugoLock(
            game,
            selected,
            previousCards
        );


        /*
          8切り
        */

        if (isEightCut) {

            clearDaifugoTable(
                game
            );


            /*
              8切りした本人から
              もう一度開始
            */

            game.currentPlayerUid =
                currentUser.uid;

            game.currentPlayerIndex =
                room.memberUids.indexOf(
                    currentUser.uid
                );

        } else {

            /*
              上がり人数を確認
            */

            const activePlayers =
                players.filter(
                    (player) =>
                        !player.finished
                );


            if (
                activePlayers.length <=
                1
            ) {

                if (
                    activePlayers.length ===
                    1
                ) {

                    const lastPlayer =
                        activePlayers[0];


                    lastPlayer.finished =
                        true;


                    lastPlayer.rank =
                        finishedOrder.length +
                        1;


                    finishedOrder.push(
                        lastPlayer.uid
                    );
                }


                game.phase =
                    "finished";


                game.winner =
                    finishedOrder[0] ||
                    null;

            } else {

                /*
                  次のプレイヤー
                */

                const next =
                    findNextDaifugoPlayer(
                        room,
                        game,
                        currentUser.uid
                    );


                if (next) {

                    game.currentPlayerUid =
                        next.uid;

                    game.currentPlayerIndex =
                        next.index;
                }
            }
        }


        game.selectedCards =
            [];


        game.turnCount =
            Number(
                game.turnCount || 0
            ) + 1;


        transaction.update(
            roomRef,
            {

                gameState:
                    game,

                updatedAt:
                    serverTimestamp()

            }
        );

    }
);


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "特殊ルール付きカード処理エラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );

            return;
        }


        if (
            error.message ===
            "INVALID_COMBINATION"
        ) {

            alert(
                "そのカードは今の場には出せません。"
            );

            return;
        }


        if (
            error.message ===
            "GAME_FINISHED"
        ) {

            alert(
                "このゲームは終了しています。"
            );

            return;
        }


        alert(
            "カードを出せませんでした。"
        );
    }
}


/* ---------------------------------------------------------
   特殊ルール対応版 パス
--------------------------------------------------------- */

async function passDaifugoTurnAdvanced(
    roomId
) {

    if (!currentUser) return;


    try {

        const roomRef =
            doc(
                db,
                "gameRooms",
                roomId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const snapshot =
                    await transaction.get(
                        roomRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "ROOM_NOT_FOUND"
                    );
                }


                const room =
                    snapshot.data();


                const game =
                    room.gameState;


                if (
                    !game ||
                    game.gameType !==
                    "daifugo"
                ) {

                    throw new Error(
                        "INVALID_GAME"
                    );
                }


                if (
                    game.currentPlayerUid !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_YOUR_TURN"
                    );
                }


                const players =
                    Array.isArray(
                        game.players
                    )
                        ? game.players
                        : [];


                const activePlayers =
                    players.filter(
                        (player) =>
                            !player.finished
                    );


                const passed =
                    Array.isArray(
                        game.passedPlayers
                    )
                        ? [
                            ...game.passedPlayers
                        ]
                        : [];


                if (
                    !passed.includes(
                        currentUser.uid
                    )
                ) {

                    passed.push(
                        currentUser.uid
                    );
                }


                /*
                  全員がパスした場合、
                  場を流す
                */

                if (
                    activePlayers.every(
                        (player) =>
                            passed.includes(
                                player.uid
                            )
                    )
                ) {

                    clearDaifugoTable(
                        game
                    );


                    /*
                      場を流した後は
                      前の場を出した人から再開
                    */

                    const restartUid =
                        game.lastPlayerUid ||
                        currentUser.uid;


                    const restartPlayer =
                        players.find(
                            (player) =>
                                player.uid ===
                                restartUid &&
                                !player.finished
                        );


                    if (restartPlayer) {

                        game.currentPlayerUid =
                            restartUid;

                        game.currentPlayerIndex =
                            room.memberUids.indexOf(
                                restartUid
                            );

                    } else {

                        const next =
                            findNextDaifugoPlayer(
                                room,
                                game,
                                currentUser.uid
                            );


                        if (next) {

                            game.currentPlayerUid =
                                next.uid;

                            game.currentPlayerIndex =
                                next.index;
                        }
                    }

                } else {

                    game.passedPlayers =
                        passed;


                    const next =
                        findNextDaifugoPlayer(
                            room,
                            game,
                            currentUser.uid
                        );


                    if (next) {

                        game.currentPlayerUid =
                            next.uid;

                        game.currentPlayerIndex =
                            next.index;
                    }
                }


                game.turnCount =
                    Number(
                        game.turnCount || 0
                    ) + 1;


                transaction.update(
                    roomRef,
                    {

                        gameState:
                            game,

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        selectedDaifugoCards =
            [];


    } catch (error) {

        console.error(
            "特殊ルール付きパス処理エラー:",
            error
        );


        if (
            error.message ===
            "NOT_YOUR_TURN"
        ) {

            alert(
                "今はあなたの番ではありません。"
            );
        }
    }
}


/* ---------------------------------------------------------
   ゲーム開始時のルール設定
--------------------------------------------------------- */

function applyDaifugoRulesToGame(
    game
) {

    if (!game) return game;


    /*
      基本ルール
    */

    if (
        typeof game.revolution !==
        "boolean"
    ) {

        game.revolution =
            false;
    }


    if (
        typeof game.eightCut !==
        "boolean"
    ) {

        game.eightCut =
            true;
    }


    if (
        typeof game.elevenBack !==
        "boolean"
    ) {

        game.elevenBack =
            false;
    }


    /*
      11バック判定を有効化
    */

    game.elevenBackRule =
        true;


    /*
      縛り
    */

    if (
        !Object.prototype.hasOwnProperty
            .call(
                game,
                "lockSuit"
            )
    ) {

        game.lockSuit =
            null;
    }


    return game;
}


/* ---------------------------------------------------------
   ルール状態表示
--------------------------------------------------------- */

function getDaifugoRuleStatus(
    game
) {

    if (!game) {
        return "";
    }


    const status = [];


    if (game.revolution) {

        status.push(
            "🔄 革命"
        );
    }


    if (game.elevenBack) {

        status.push(
            "🔥 11バック"
        );
    }


    if (game.lockSuit) {

        status.push(
            `🔒 ${game.lockSuit}縛り`
        );
    }


    return status.length
        ? status.join("　")
        : "通常状態";
}


/* ---------------------------------------------------------
   大富豪画面表示を上書き
--------------------------------------------------------- */

const renderDaifugoWithRules =
    renderDaifugoHand;


renderDaifugoHand =
    function(room) {

        if (!room) return;


        const game =
            room.gameState || {};


        applyDaifugoRulesToGame(
            game
        );


        renderDaifugoWithRules(
            room
        );


        if (!gameAreaEl) return;


        const panel =
            gameAreaEl.querySelector(
                ".panel-head"
            );


        if (!panel) return;


        const ruleStatus =
            document.createElement(
                "div"
            );


        ruleStatus.style.fontSize =
            "12px";


        ruleStatus.style.opacity =
            "0.75";


        ruleStatus.style.marginTop =
            "4px";


        ruleStatus.textContent =
            getDaifugoRuleStatus(
                game
            );


        panel.appendChild(
            ruleStatus
        );
    };


/* ---------------------------------------------------------
   大富豪のボタン処理を
   特殊ルール版に変更
--------------------------------------------------------- */

const previousAdvancedRender =
    renderDaifugoHand;


renderDaifugoHand =
    function(room) {

        previousAdvancedRender(
            room
        );


        if (!gameAreaEl) return;


        const playButton =
            gameAreaEl.querySelector(
                "#daifugoPlayButton"
            );


        const passButton =
            gameAreaEl.querySelector(
                "#daifugoPassButton"
            );


        if (playButton) {

            playButton.onclick =
                null;


            playButton.addEventListener(
                "click",
                () => {

                    playDaifugoCardsAdvanced(
                        room.id
                    );

                }
            );
        }


        if (passButton) {

            passButton.onclick =
                null;


            passButton.addEventListener(
                "click",
                () => {

                    passDaifugoTurnAdvanced(
                        room.id
                    );

                }
            );
        }
    };


/* ---------------------------------------------------------
   外部公開
--------------------------------------------------------- */

window.playDaifugoCardsAdvanced =
    playDaifugoCardsAdvanced;


window.passDaifugoTurnAdvanced =
    passDaifugoTurnAdvanced;


window.getDaifugoRuleStatus =
    getDaifugoRuleStatus;
