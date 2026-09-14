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

const firebaseApp = initializeApp(firebaseConfig);

const db = getFirestore(firebaseApp);

const auth = getAuth(firebaseApp);


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
                existingUser.data().uid !== currentUser.uid
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

}


// ==================================================
// オンライン状態
// ==================================================

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
                username: username,
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

        console.error(error);

    }

}


setInterval(
    () => {

        if (currentUser && username) {

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
                newUserDoc.data().uid !== currentUser.uid
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

                        members: members
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
// 友達一覧監視
// ==================================================

function listenFriends() {

    if (unsubscribeFriends) {
        unsubscribeFriends();
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

                friendsData = [];


                snapshot.forEach(
                    item => {

                        friendsData.push({
                            id: item.id,
                            ...item.data()
                        });

                    }
                );


                friendsData.sort(
                    (a, b) =>
                        (a.friendName || "")
                            .localeCompare(
                                b.friendName || "",
                                "ja"
                            )
                );


                renderFriends();

            }
        );

}


// ==================================================
// 友達一覧表示
// ==================================================

function renderFriends() {

    friendsList.innerHTML = "";


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


            mainButton.querySelector(
                ".friend-name"
            ).textContent =
                friend.friendName;


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


        if (!friendName) {
            return;
        }


        const trimmedName =
            friendName.trim();


        if (!trimmedName) {
            return;
        }


        if (trimmedName === username) {

            alert(
                "自分自身は友達に追加できません。"
            );

            return;
        }


        try {

            // 本当に存在するアカウントか確認
            const userSnapshot =
                await getDoc(
                    doc(
                        db,
                        "users",
                        trimmedName
                    )
                );


            if (!userSnapshot.exists()) {

                alert(
                    "その名前のユーザーは存在しません。"
                );

                return;
            }


            const userData =
                userSnapshot.data();


            if (!userData.uid) {

                alert(
                    "そのユーザーを確認できません。"
                );

                return;
            }


            if (
                userData.uid ===
                currentUser.uid
            ) {

                alert(
                    "自分自身は追加できません。"
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
                        trimmedName
                    )
                );


            const existingSnapshot =
                await getDocs(
                    existingQuery
                );


            if (!existingSnapshot.empty) {

                alert(
                    "すでに友達です。"
                );

                return;
            }


            const friendshipId =
                crypto.randomUUID();


            const batch =
                writeBatch(db);


            const myFriendRef =
                doc(
                    collection(
                        db,
                        "friends"
                    )
                );


            const theirFriendRef =
                doc(
                    collection(
                        db,
                        "friends"
                    )
                );


            batch.set(
                myFriendRef,
                {
                    owner: username,
                    friendName: trimmedName,
                    friendshipId: friendshipId,
                    createdAt: serverTimestamp()
                }
            );


            batch.set(
                theirFriendRef,
                {
                    owner: trimmedName,
                    friendName: username,
                    friendshipId: friendshipId,
                    createdAt: serverTimestamp()
                }
            );


            await batch.commit();


            alert(
                `${trimmedName}さんを友達に追加しました！`
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

    const ok =
        confirm(
            `${friendName}さんを友達から削除しますか？\n\nお互いの友達一覧から削除されます。\n再追加すると新しいチャットになります。`
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

        console.error(error);

        alert(
            "友達の削除に失敗しました。"
        );

    }

}


// ==================================================
// 友達のチャットID確認
// ==================================================

async function ensureFriendshipId(
    friendName
) {

    const currentFriend =
        friendsData.find(
            friend =>
                friend.friendName ===
                friendName
        );


    if (
        currentFriend?.friendshipId
    ) {

        return currentFriend.friendshipId;

    }


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


    let friendshipId =
        null;


    mySnapshot.forEach(
        item => {

            if (!friendshipId) {

                friendshipId =
                    item.data().friendshipId ||
                    null;

            }

        }
    );


    theirSnapshot.forEach(
        item => {

            if (!friendshipId) {

                friendshipId =
                    item.data().friendshipId ||
                    null;

            }

        }
    );


    if (!friendshipId) {

        friendshipId =
            crypto.randomUUID();

    }


    const batch =
        writeBatch(db);


    mySnapshot.forEach(
        item => {

            batch.update(
                item.ref,
                {
                    friendshipId:
                        friendshipId
                }
            );

        }
    );


    theirSnapshot.forEach(
        item => {

            batch.update(
                item.ref,
                {
                    friendshipId:
                        friendshipId
                }
            );

        }
    );


    await batch.commit();


    // 古いメッセージにチャットIDを付ける
    const messagesSnapshot =
        await getDocs(
            collection(
                db,
                "messages"
            )
        );


    const oldMessages = [];


    messagesSnapshot.forEach(
        item => {

            const data =
                item.data();


            const isPair =
                (
                    data.sender === username &&
                    data.receiver === friendName
                ) ||
                (
                    data.sender === friendName &&
                    data.receiver === username
                );


            if (
                isPair &&
                !data.friendshipId &&
                data.chatType !== "group"
            ) {

                oldMessages.push(
                    item
                );

            }

        }
    );


    for (
        let i = 0;
        i < oldMessages.length;
        i += 450
    ) {

        const chunk =
            oldMessages.slice(
                i,
                i + 450
            );


        const messageBatch =
            writeBatch(db);


        chunk.forEach(
            item => {

                messageBatch.update(
                    item.ref,
                    {
                        friendshipId:
                            friendshipId
                    }
                );

            }
        );


        await messageBatch.commit();

    }


    return friendshipId;

}


// ==================================================
// グループ一覧監視
// ==================================================

function listenGroups() {

    if (unsubscribeGroups) {

        unsubscribeGroups();

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

                groupsData = [];


                snapshot.forEach(
                    item => {

                        groupsData.push({
                            id: item.id,
                            ...item.data()
                        });

                    }
                );


                renderGroups();

            }
        );

}


// ==================================================
// グループ表示
// ==================================================

function renderGroups() {

    groupsList.innerHTML = "";


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


            manageButton.title =
                "グループ管理";


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


        if (!groupName) {
            return;
        }


        // 友達一覧から選ぶ
        if (friendsData.length === 0) {

            try {

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
                            [username],

                        createdAt:
                            serverTimestamp()
                    }
                );


                alert(
                    "グループを作成しました！"
                );


            } catch (error) {

                console.error(error);

                alert(
                    "グループ作成に失敗しました。"
                );

            }

            return;

        }


        showCreateGroupMemberPicker(
            groupName.trim()
        );

    }
);


// ==================================================
// グループ作成メンバー選択画面
// ==================================================

function showCreateGroupMemberPicker(
    groupName
) {

    const overlay =
        createModalOverlay();


    const panel =
        createModalPanel();


    const title =
        document.createElement(
            "h2"
        );


    title.textContent =
        `👥 ${groupName}`;


    const info =
        document.createElement(
            "p"
        );


    info.textContent =
        "参加させる友達を選択してください。";


    panel.appendChild(
        title
    );


    panel.appendChild(
        info
    );


    const list =
        document.createElement(
            "div"
        );


    list.style.display =
        "flex";

    list.style.flexDirection =
        "column";

    list.style.gap =
        "8px";

    list.style.maxHeight =
        "300px";

    list.style.overflowY =
        "auto";


    friendsData.forEach(
        friend => {

            const label =
                createFriendCheckbox(
                    friend.friendName
                );


            list.appendChild(
                label
            );

        }
    );


    panel.appendChild(
        list
    );


    const createButton =
        createModalButton(
            "グループを作成"
        );


    createButton.style.background =
        "#6c63ff";

    createButton.style.color =
        "white";


    createButton.addEventListener(
        "click",
        async () => {

            const selected =
                [
                    ...list.querySelectorAll(
                        "input:checked"
                    )
                ].map(
                    input =>
                        input.value
                );


            const members =
                [
                    username,
                    ...selected
                ];


            try {

                await addDoc(
                    collection(
                        db,
                        "groups"
                    ),
                    {
                        name:
                            groupName,

                        owner:
                            username,

                        members:
                            [...new Set(members)],

                        createdAt:
                            serverTimestamp()
                    }
                );


                overlay.remove();


                alert(
                    "グループを作成しました！"
                );


            } catch (error) {

                console.error(error);

                alert(
                    "グループ作成に失敗しました。"
                );

            }

        }
    );


    panel.appendChild(
        createButton
    );


    const cancelButton =
        createModalButton(
            "キャンセル"
        );


    cancelButton.addEventListener(
        "click",
        () => {

            overlay.remove();

        }
    );


    panel.appendChild(
        cancelButton
    );


    overlay.appendChild(
        panel
    );


    document.body.appendChild(
        overlay
    );

}


// ==================================================
// グループ管理画面
// ==================================================

function showGroupManagement(
    group
) {

    const overlay =
        createModalOverlay();


    const panel =
        createModalPanel();


    const title =
        document.createElement(
            "h2"
        );


    title.textContent =
        `👥 ${group.name}`;


    const info =
        document.createElement(
            "p"
        );


    info.textContent =
        `${(group.members || []).length}人が参加中`;


    panel.appendChild(
        title
    );


    panel.appendChild(
        info
    );


    // メンバー追加
    const addButton =
        createModalButton(
            "👤  メンバーを追加"
        );


    addButton.addEventListener(
        "click",
        () => {

            overlay.remove();

            showAddMembersScreen(
                group
            );

        }
    );


    panel.appendChild(
        addButton
    );


    // 退会
    const leaveButton =
        createModalButton(
            "🚪  グループから退会"
        );


    leaveButton.style.background =
        "#fff0f0";

    leaveButton.style.color =
        "#e53935";


    leaveButton.addEventListener(
        "click",
        async () => {

            const ok =
                confirm(
                    `「${group.name}」から退会しますか？`
                );


            if (!ok) {
                return;
            }


            await leaveGroup(
                group,
                overlay
            );

        }
    );


    panel.appendChild(
        leaveButton
    );


    // キャンセル
    const cancelButton =
        createModalButton(
            "キャンセル"
        );


    cancelButton.addEventListener(
        "click",
        () => {

            overlay.remove();

        }
    );


    panel.appendChild(
        cancelButton
    );


    overlay.appendChild(
        panel
    );


    document.body.appendChild(
        overlay
    );

}


// ==================================================
// グループ メンバー追加画面
// ==================================================

function showAddMembersScreen(
    group
) {

    const overlay =
        createModalOverlay();


    const panel =
        createModalPanel();


    const title =
        document.createElement(
            "h2"
        );


    title.textContent =
        "👤 メンバーを追加";


    const info =
        document.createElement(
            "p"
        );


    info.textContent =
        "追加したい友達を選択してください。";


    panel.appendChild(
        title
    );


    panel.appendChild(
        info
    );


    const availableFriends =
        friendsData.filter(
            friend =>
                !(group.members || [])
                    .includes(
                        friend.friendName
                    )
        );


    if (
        availableFriends.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.textContent =
            "追加できる友達がいません。";


        empty.style.padding =
            "20px";

        empty.style.textAlign =
            "center";

        empty.style.background =
            "#f5f5f5";

        empty.style.borderRadius =
            "12px";


        panel.appendChild(
            empty
        );

    } else {

        const list =
            document.createElement(
                "div"
            );


        list.style.display =
            "flex";

        list.style.flexDirection =
            "column";

        list.style.gap =
            "8px";

        list.style.maxHeight =
            "300px";

        list.style.overflowY =
            "auto";


        availableFriends.forEach(
            friend => {

                list.appendChild(
                    createFriendCheckbox(
                        friend.friendName
                    )
                );

            }
        );


        panel.appendChild(
            list
        );


        const addButton =
            createModalButton(
                "追加する"
            );


        addButton.style.background =
            "#6c63ff";

        addButton.style.color =
            "white";


        addButton.addEventListener(
            "click",
            async () => {

                const selected =
                    [
                        ...list.querySelectorAll(
                            "input:checked"
                        )
                    ].map(
                        input =>
                            input.value
                    );


                if (
                    selected.length === 0
                ) {

                    alert(
                        "追加する友達を選択してください。"
                    );

                    return;

                }


                const newMembers =
                    [
                        ...(group.members || [])
                    ];


                selected.forEach(
                    name => {

                        if (
                            !newMembers.includes(
                                name
                            )
                        ) {

                            newMembers.push(
                                name
                            );

                        }

                    }
                );


                try {

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


                    overlay.remove();


                    alert(
                        `${selected.length}人を追加しました！`
                    );


                } catch (error) {

                    console.error(error);

                    alert(
                        "メンバー追加に失敗しました。"
                    );

                }

            }
        );


        panel.appendChild(
            addButton
        );

    }


    const backButton =
        createModalButton(
            "← 戻る"
        );


    backButton.addEventListener(
        "click",
        () => {

            overlay.remove();

            showGroupManagement(
                group
            );

        }
    );


    panel.appendChild(
        backButton
    );


    overlay.appendChild(
        panel
    );


    document.body.appendChild(
        overlay
    );

}


// ==================================================
// グループ退会
// ==================================================

async function leaveGroup(
    group,
    overlay
) {

    try {

        const remainingMembers =
            (group.members || [])
                .filter(
                    member =>
                        member !== username
                );


        // 自分しかいなかった
        if (
            remainingMembers.length === 0
        ) {

            await deleteDoc(
                doc(
                    db,
                    "groups",
                    group.id
                )
            );

        } else {

            const updateData = {

                members:
                    remainingMembers

            };


            // オーナーだった場合
            if (
                group.owner === username
            ) {

                updateData.owner =
                    remainingMembers[0];

            }


            await updateDoc(
                doc(
                    db,
                    "groups",
                    group.id
                ),
                updateData
            );

        }


        if (
            selectedChat === group.id &&
            selectedChatType === "group"
        ) {

            resetChat();

        }


        overlay.remove();


        alert(
            "グループから退会しました。"
        );


    } catch (error) {

        console.error(error);

        alert(
            "グループ退会に失敗しました。"
        );

    }

}


// ==================================================
// モーダル部品
// ==================================================

function createModalOverlay() {

    const overlay =
        document.createElement(
            "div"
        );


    overlay.style.position =
        "fixed";

    overlay.style.inset =
        "0";

    overlay.style.background =
        "rgba(0,0,0,0.35)";

    overlay.style.display =
        "flex";

    overlay.style.alignItems =
        "center";

    overlay.style.justifyContent =
        "center";

    overlay.style.padding =
        "20px";

    overlay.style.zIndex =
        "99999";


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                overlay.remove();

            }

        }
    );


    return overlay;

}


function createModalPanel() {

    const panel =
        document.createElement(
            "div"
        );


    panel.style.width =
        "min(420px, 100%)";

    panel.style.maxHeight =
        "85vh";

    panel.style.overflowY =
        "auto";

    panel.style.background =
        "white";

    panel.style.borderRadius =
        "24px";

    panel.style.padding =
        "25px";

    panel.style.boxShadow =
        "0 20px 60px rgba(0,0,0,0.25)";

    panel.style.boxSizing =
        "border-box";


    return panel;

}


function createModalButton(
    text
) {

    const button =
        document.createElement(
            "button"
        );


    button.textContent =
        text;


    button.style.width =
        "100%";

    button.style.border =
        "none";

    button.style.padding =
        "15px";

    button.style.marginTop =
        "10px";

    button.style.borderRadius =
        "14px";

    button.style.background =
        "#f1f2f6";

    button.style.fontSize =
        "16px";

    button.style.cursor =
        "pointer";


    return button;

}


function createFriendCheckbox(
    name
) {

    const label =
        document.createElement(
            "label"
        );


    label.style.display =
        "flex";

    label.style.alignItems =
        "center";

    label.style.gap =
        "12px";

    label.style.padding =
        "14px";

    label.style.background =
        "#f6f6f8";

    label.style.borderRadius =
        "12px";

    label.style.cursor =
        "pointer";


    const checkbox =
        document.createElement(
            "input"
        );


    checkbox.type =
        "checkbox";

    checkbox.value =
        name;


    checkbox.style.width =
        "20px";

    checkbox.style.height =
        "20px";


    const text =
        document.createElement(
            "span"
        );


    text.textContent =
        `🟢 ${name}`;


    label.appendChild(
        checkbox
    );


    label.appendChild(
        text
    );


    return label;

}


// ==================================================
// 友達選択
// ==================================================

async function selectFriend(
    friendName
) {

    try {

        const friendshipId =
            await ensureFriendshipId(
                friendName
            );


        selectedChat =
            friendName;

        selectedChatType =
            "friend";

        selectedFriendshipId =
            friendshipId;


        chatHeader.textContent =
            friendName;


        messageInput.disabled =
            false;

        sendButton.disabled =
            false;


        messageInput.placeholder =
            `${friendName}さんにメッセージ`;


        cancelReply();


        listenMessages();


        await markFriendMessagesAsRead();


        renderCurrentMessages();

    } catch (error) {

        console.error(error);

        alert(
            "チャットを開けませんでした。"
        );

    }

}


// ==================================================
// グループ選択
// ==================================================

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


    chatHeader.textContent =
        `👥 ${group.name}`;


    messageInput.disabled =
        false;

    sendButton.disabled =
        false;


    messageInput.placeholder =
        `${group.name}にメッセージ`;


    cancelReply();


    listenMessages();


    await markGroupMessagesAsRead();


    renderCurrentMessages();

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


    chatHeader.textContent =
        "相手を選択してください";


    messagesElement.innerHTML =
        "";


    messageInput.disabled =
        true;

    sendButton.disabled =
        true;


    messageInput.value =
        "";


    messageInput.placeholder =
        "友達またはグループを選択してください";


    cancelReply();

}


// ==================================================
// メッセージ監視
// ==================================================

function listenMessages() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

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

            }
        );

}


// ==================================================
// メッセージ表示
// ==================================================

function renderMessages(
    allMessages
) {

    let filtered = [];


    if (
        selectedChatType ===
        "friend"
    ) {

        filtered =
            allMessages.filter(
                message => {

                    const pair =
                        (
                            message.sender === username &&
                            message.receiver === selectedChat
                        ) ||
                        (
                            message.sender === selectedChat &&
                            message.receiver === username
                        );


                    return (
                        pair &&
                        message.friendshipId ===
                            selectedFriendshipId
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


// ==================================================
// 1メッセージ
// ==================================================

function renderSingleMessage(
    message
) {

    const row =
        document.createElement(
            "div"
        );


    const mine =
        message.sender === username;


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
        selectedChatType === "group" &&
        !mine
    ) {

        const sender =
            document.createElement(
                "div"
            );


        sender.className =
            "message-sender";


        sender.textContent =
            message.sender;


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


// ==================================================
// 送信
// ==================================================

sendButton?.addEventListener(
    "click",
    sendMessage
);


messageInput?.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            sendMessage();

        }

    }
);


async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    if (!selectedChat) {

        alert(
            "友達またはグループを選択してください。"
        );

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
                replyingMessage.text || "";

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


        setTimeout(
            () => {

                messagesElement.scrollTop =
                    messagesElement.scrollHeight;

            },
            100
        );

    } catch (error) {

        console.error(error);

        alert(
            "メッセージ送信に失敗しました。"
        );

    }

}


// ==================================================
// 返信
// ==================================================

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
            message.text || "";

    }


    messageInput.focus();

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


// ==================================================
// メッセージ削除
// ==================================================

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
                text: ""
            }
        );

    } catch (error) {

        console.error(error);

        alert(
            "メッセージ削除に失敗しました。"
        );

    }

}


// ==================================================
// リアクション
// ==================================================

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

        console.error(error);

    }

}


// ==================================================
// 友達既読
// ==================================================

async function markFriendMessagesAsRead() {

    if (!selectedFriendshipId) {
        return;
    }


    const snapshot =
        await getDocs(
            collection(
                db,
                "messages"
            )
        );


    const batch =
        writeBatch(db);


    let count =
        0;


    snapshot.forEach(
        item => {

            const data =
                item.data();


            const isIncoming =
                data.sender ===
                    selectedChat &&
                data.receiver ===
                    username;


            if (
                isIncoming &&
                data.friendshipId ===
                    selectedFriendshipId &&
                !(data.readBy || [])
                    .includes(
                        username
                    )
            ) {

                batch.update(
                    item.ref,
                    {
                        readBy: [
                            ...(data.readBy || []),
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

}


// ==================================================
// グループ既読
// ==================================================

async function markGroupMessagesAsRead() {

    if (!selectedChat) {
        return;
    }


    const snapshot =
        await getDocs(
            collection(
                db,
                "messages"
            )
        );


    const batch =
        writeBatch(db);


    let count =
        0;


    snapshot.forEach(
        item => {

            const data =
                item.data();


            if (
                data.chatType ===
                    "group" &&
                data.chatId ===
                    selectedChat &&
                !(data.readBy || [])
                    .includes(
                        username
                    )
            ) {

                batch.update(
                    item.ref,
                    {
                        readBy: [
                            ...(data.readBy || []),
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

}


// ==================================================
// 未読監視
// ==================================================

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

            }
        );

}


// ==================================================
// 未読バッジ
// ==================================================

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


                            if (
                                incoming &&
                                sameChat &&
                                !(message.readBy || [])
                                    .includes(
                                        username
                                    )
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

        console.error(error);

    }

}


// ==================================================
// 現在のチャット再描画
// ==================================================

async function renderCurrentMessages() {

    if (!selectedChat) {
        return;
    }


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
