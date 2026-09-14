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


// ==============================
// Firebase
// ==============================

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


// ==============================
// 状態
// ==============================

let currentUser = null;
let username = null;

let friendsData = [];
let groupsData = [];

let selectedChat = null;
let selectedChatType = null;
let selectedFriendshipId = null;

let unsubscribeMessages = null;
let unsubscribeFriends = null;
let unsubscribeGroups = null;
let unsubscribeAllMessages = null;


// ==============================
// HTML
// ==============================

const loginScreen = document.getElementById("loginScreen");
const nameScreen = document.getElementById("nameScreen");
const appElement = document.getElementById("app");

const googleLoginButton = document.getElementById("googleLoginButton");
const guestLoginButton = document.getElementById("guestLoginButton");

const nameInput = document.getElementById("nameInput");
const startChatButton = document.getElementById("startChatButton");

const loginError = document.getElementById("loginError");
const nameError = document.getElementById("nameError");

const myName = document.getElementById("myName");
const statusElement = document.getElementById("status");

const friendsList = document.getElementById("friendsList");
const groupsList = document.getElementById("groupsList");

const addFriendButton = document.getElementById("addFriendButton");
const createGroupButton = document.getElementById("createGroupButton");
const logoutButton = document.getElementById("logoutButton");

const chatHeader = document.getElementById("chatHeader");
const messagesElement = document.getElementById("messages");

const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const replyBar = document.getElementById("replyBar");
const replyText = document.getElementById("replyText");
const cancelReplyButton = document.getElementById("cancelReplyButton");


// ==============================
// ログイン
// ==============================

googleLoginButton?.addEventListener("click", async () => {
    try {
        loginError.textContent = "";

        const provider = new GoogleAuthProvider();

        await signInWithPopup(auth, provider);

    } catch (error) {
        console.error(error);
        loginError.textContent = "ログインに失敗しました。";
    }
});


guestLoginButton?.addEventListener("click", async () => {
    try {
        loginError.textContent = "";

        await signInAnonymously(auth);

    } catch (error) {
        console.error(error);
        loginError.textContent = "ゲストログインに失敗しました。";
    }
});


// ==============================
// 認証状態
// ==============================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        currentUser = null;

        loginScreen?.classList.remove("hidden");
        nameScreen?.classList.add("hidden");
        appElement?.classList.add("hidden");

        return;
    }

    currentUser = user;

    const savedName = localStorage.getItem("yuuchat_username");

    let suggestedName = savedName;

    if (!suggestedName && user.displayName) {
        suggestedName = user.displayName;
    }

    if (suggestedName) {

        const userDoc = await getDoc(
            doc(db, "users", suggestedName)
        );

        if (
            !userDoc.exists() ||
            !userDoc.data().uid ||
            userDoc.data().uid === user.uid
        ) {

            username = suggestedName;

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
});


// ==============================
// 名前画面
// ==============================

function showNameScreen() {

    loginScreen?.classList.add("hidden");
    appElement?.classList.add("hidden");
    nameScreen?.classList.remove("hidden");

}


// ==============================
// 名前決定
// ==============================

startChatButton?.addEventListener("click", async () => {

    const newName = nameInput.value.trim();

    if (!newName) {
        nameError.textContent = "名前を入力してください。";
        return;
    }

    if (newName.length > 20) {
        nameError.textContent = "名前は20文字以内にしてください。";
        return;
    }

    try {

        const existingUser = await getDoc(
            doc(db, "users", newName)
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

        username = newName;

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

});


// ==============================
// アプリ開始
// ==============================

async function startApp() {

    loginScreen?.classList.add("hidden");
    nameScreen?.classList.add("hidden");
    appElement?.classList.remove("hidden");

    myName.textContent = username;

    await updateOnline();

    loadProfileImage();

    listenFriends();
    listenGroups();
    listenAllMessages();

}


// ==============================
// オンライン状態
// ==============================

async function updateOnline() {

    if (!username || !currentUser) return;

    await setDoc(
        doc(db, "users", username),
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

    statusElement.textContent = "🟢 オンライン";
}


// ==============================
// 20秒ごとにオンライン更新
// ==============================

setInterval(() => {

    if (currentUser && username) {
        updateOnline();
    }

}, 20000);


// ==============================
// ログアウト
// ==============================

logoutButton?.addEventListener("click", async () => {

    try {

        if (username) {

            await updateDoc(
                doc(db, "users", username),
                {
                    online: false,
                    lastSeen: serverTimestamp()
                }
            );
        }

    } catch (error) {
        console.error(error);
    }

    await signOut(auth);

    location.reload();

});


// ==============================
// プロフィール画像
// ==============================

const profileImageInput =
    document.getElementById("profileImageInput");

const myProfileImage =
    document.getElementById("myProfileImage");

const profileImagePlaceholder =
    document.getElementById("profileImagePlaceholder");


profileImageInput?.addEventListener("change", () => {

    const file = profileImageInput.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {

        const imageData = reader.result;

        localStorage.setItem(
            `yuuchat_profile_${currentUser.uid}`,
            imageData
        );

        loadProfileImage();
    };

    reader.readAsDataURL(file);

});


function loadProfileImage() {

    if (!currentUser) return;

    const imageData = localStorage.getItem(
        `yuuchat_profile_${currentUser.uid}`
    );

    if (imageData) {

        myProfileImage.src = imageData;
        myProfileImage.style.display = "block";
        profileImagePlaceholder.style.display = "none";

    } else {

        myProfileImage.style.display = "none";
        profileImagePlaceholder.style.display = "block";

    }
}


// ==============================
// 名前変更
// ==============================

const changeNameButton =
    document.getElementById("changeNameButton");

changeNameButton?.addEventListener("click", async () => {

    const newName = prompt(
        "新しい名前を入力してください",
        username
    );

    if (!newName) return;

    const trimmedName = newName.trim();

    if (!trimmedName || trimmedName === username) {
        return;
    }

    if (trimmedName.length > 20) {
        alert("名前は20文字以内にしてください。");
        return;
    }

    try {

        const newUserDoc = await getDoc(
            doc(db, "users", trimmedName)
        );

        if (
            newUserDoc.exists() &&
            newUserDoc.data().uid !== currentUser.uid
        ) {

            alert("その名前はすでに使われています。");
            return;
        }

        await renameUser(username, trimmedName);

        username = trimmedName;

        localStorage.setItem(
            "yuuchat_username",
            username
        );

        myName.textContent = username;

        alert("名前を変更しました。");

    } catch (error) {

        console.error(error);
        alert("名前変更に失敗しました。");

    }

});


// ==============================
// 名前変更処理
// ==============================

async function renameUser(oldName, newName) {

    const batch = writeBatch(db);

    const newUserRef = doc(db, "users", newName);

    batch.set(
        newUserRef,
        {
            username: newName,
            uid: currentUser.uid,
            online: true,
            lastSeen: serverTimestamp()
        },
        { merge: true }
    );


    // 友達
    const friendsSnapshot =
        await getDocs(collection(db, "friends"));

    friendsSnapshot.forEach((item) => {

        const data = item.data();

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
    });


    // グループ
    const groupsSnapshot =
        await getDocs(collection(db, "groups"));

    groupsSnapshot.forEach((item) => {

        const data = item.data();

        if (data.owner === oldName ||
            data.members?.includes(oldName)) {

            const newMembers =
                (data.members || []).map(member =>
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

                    members: newMembers
                }
            );
        }
    });


    // メッセージ
    const messagesSnapshot =
        await getDocs(collection(db, "messages"));

    messagesSnapshot.forEach((item) => {

        const data = item.data();

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
    });


    batch.delete(doc(db, "users", oldName));

    await batch.commit();
}


// ==============================
// 友達一覧
// ==============================

function listenFriends() {

    if (unsubscribeFriends) {
        unsubscribeFriends();
    }

    const q = query(
        collection(db, "friends"),
        where("owner", "==", username)
    );

    unsubscribeFriends = onSnapshot(q, async (snapshot) => {

        friendsData = [];

        snapshot.forEach((item) => {

            friendsData.push({
                id: item.id,
                ...item.data()
            });

        });

        renderFriends();

    });
}


// ==============================
// 友達表示
// ==============================

function renderFriends() {

    friendsList.innerHTML = "";

    if (friendsData.length === 0) {

        friendsList.innerHTML =
            `<div class="empty-message">友達がいません</div>`;

        return;
    }


    friendsData.forEach((friend) => {

        const row = document.createElement("div");

        row.className = "friend-item";


        const mainButton =
            document.createElement("button");

        mainButton.className =
            "friend-main-button";


        const dot =
            document.createElement("span");

        dot.textContent = "🟢";


        const name =
            document.createElement("span");

        name.className = "friend-name";
        name.textContent = friend.friendName;


        const unread =
            document.createElement("span");

        unread.className = "unread-badge";
        unread.style.display = "none";


        mainButton.appendChild(dot);
        mainButton.appendChild(name);
        mainButton.appendChild(unread);


        mainButton.addEventListener(
            "click",
            () => selectFriend(friend.friendName)
        );


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "friend-delete-button";

        deleteButton.textContent = "×";

        deleteButton.title = "友達を削除";

        deleteButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                deleteFriend(friend.friendName);
            }
        );


        row.appendChild(mainButton);
        row.appendChild(deleteButton);

        friendsList.appendChild(row);

    });

    updateUnreadBadges();
}


// ==============================
// 友達追加
// ==============================

addFriendButton?.addEventListener("click", async () => {

    const friendName = prompt(
        "追加したい友達の名前を入力してください"
    );

    if (!friendName) return;

    const trimmedName = friendName.trim();

    if (!trimmedName) return;

    if (trimmedName === username) {

        alert("自分自身は友達に追加できません。");
        return;
    }


    try {

        // 本当に存在するアカウントか確認
        const userSnapshot =
            await getDoc(
                doc(db, "users", trimmedName)
            );


        if (!userSnapshot.exists()) {

            alert(
                "その名前のユーザーは存在しません。\n正しい名前を入力してください。"
            );

            return;
        }


        const userData = userSnapshot.data();

        if (!userData.uid) {

            alert("そのユーザーを確認できません。");
            return;
        }


        if (userData.uid === currentUser.uid) {

            alert("自分自身は追加できません。");
            return;
        }


        // すでに存在するか確認
        const existingQuery =
            query(
                collection(db, "friends"),
                where("owner", "==", username),
                where("friendName", "==", trimmedName)
            );

        const existingSnapshot =
            await getDocs(existingQuery);


        if (!existingSnapshot.empty) {

            alert("すでに友達です。");
            return;
        }


        // 新しいチャットID
        const friendshipId =
            crypto.randomUUID();


        const batch = writeBatch(db);


        // 自分側
        const myFriendRef =
            doc(collection(db, "friends"));

        batch.set(
            myFriendRef,
            {
                owner: username,
                friendName: trimmedName,
                friendshipId: friendshipId,
                createdAt: serverTimestamp()
            }
        );


        // 相手側
        const theirFriendRef =
            doc(collection(db, "friends"));

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

});


// ==============================
// 友達削除
// ==============================

async function deleteFriend(friendName) {

    const ok = confirm(
        `${friendName}さんを友達から削除しますか？\n\n削除すると、お互いの友達一覧から消えます。\n再追加すると新しいチャットになります。`
    );

    if (!ok) return;


    try {

        const myQuery =
            query(
                collection(db, "friends"),
                where("owner", "==", username),
                where("friendName", "==", friendName)
            );

        const theirQuery =
            query(
                collection(db, "friends"),
                where("owner", "==", friendName),
                where("friendName", "==", username)
            );


        const mySnapshot =
            await getDocs(myQuery);

        const theirSnapshot =
            await getDocs(theirQuery);


        const batch = writeBatch(db);


        mySnapshot.forEach(item => {
            batch.delete(item.ref);
        });

        theirSnapshot.forEach(item => {
            batch.delete(item.ref);
        });


        await batch.commit();


        if (selectedChat === friendName) {

            selectedChat = null;
            selectedChatType = null;
            selectedFriendshipId = null;

            chatHeader.textContent =
                "相手を選択してください";

            messagesElement.innerHTML = "";

            messageInput.disabled = true;
            sendButton.disabled = true;

            messageInput.placeholder =
                "友達またはグループを選択してください";
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


// ==============================
// 友達のチャットID確認
// ==============================

async function ensureFriendshipId(friendName) {

    const currentFriend =
        friendsData.find(
            friend => friend.friendName === friendName
        );


    if (currentFriend?.friendshipId) {

        return currentFriend.friendshipId;
    }


    const myQuery =
        query(
            collection(db, "friends"),
            where("owner", "==", username),
            where("friendName", "==", friendName)
        );


    const theirQuery =
        query(
            collection(db, "friends"),
            where("owner", "==", friendName),
            where("friendName", "==", username)
        );


    const mySnapshot =
        await getDocs(myQuery);

    const theirSnapshot =
        await getDocs(theirQuery);


    let friendshipId = null;


    mySnapshot.forEach(item => {

        if (!friendshipId) {
            friendshipId =
                item.data().friendshipId || null;
        }

    });


    theirSnapshot.forEach(item => {

        if (!friendshipId) {
            friendshipId =
                item.data().friendshipId || null;
        }

    });


    if (!friendshipId) {
        friendshipId = crypto.randomUUID();
    }


    const batch = writeBatch(db);


    mySnapshot.forEach(item => {

        batch.update(
            item.ref,
            {
                friendshipId
            }
        );

    });


    theirSnapshot.forEach(item => {

        batch.update(
            item.ref,
            {
                friendshipId
            }
        );

    });


    await batch.commit();


    // 古いメッセージにもIDを付ける
    const messagesSnapshot =
        await getDocs(collection(db, "messages"));


    const oldMessages = [];


    messagesSnapshot.forEach(item => {

        const data = item.data();


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

            oldMessages.push(item);

        }

    });


    // 500件ずつ処理
    for (
        let i = 0;
        i < oldMessages.length;
        i += 450
    ) {

        const chunk =
            oldMessages.slice(i, i + 450);

        const messageBatch =
            writeBatch(db);

        chunk.forEach(item => {

            messageBatch.update(
                item.ref,
                {
                    friendshipId
                }
            );

        });

        await messageBatch.commit();
    }


    return friendshipId;
}


// ==============================
// グループ一覧
// ==============================

function listenGroups() {

    if (unsubscribeGroups) {
        unsubscribeGroups();
    }

    const q = query(
        collection(db, "groups"),
        where("members", "array-contains", username)
    );


    unsubscribeGroups =
        onSnapshot(q, snapshot => {

            groupsData = [];

            snapshot.forEach(item => {

                groupsData.push({
                    id: item.id,
                    ...item.data()
                });

            });

            renderGroups();
        });
}


// ==============================
// グループ表示
// ==============================

function renderGroups() {

    groupsList.innerHTML = "";


    if (groupsData.length === 0) {

        groupsList.innerHTML =
            `<div class="empty-message">グループがありません</div>`;

        return;
    }


    groupsData.forEach(group => {

        const row =
            document.createElement("div");

        row.className = "group-item";


        const mainButton =
            document.createElement("button");

        mainButton.className =
            "group-main-button";

        mainButton.textContent =
            `👥 ${group.name}`;


        mainButton.addEventListener(
            "click",
            () => selectGroup(group.id)
        );


        const manageButton =
            document.createElement("button");

        manageButton.className =
            "group-manage-button";

        manageButton.textContent = "⋯";

        manageButton.title =
            "グループ管理";


        manageButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                manageGroup(group);
            }
        );


        row.appendChild(mainButton);
        row.appendChild(manageButton);

        groupsList.appendChild(row);

    });


    updateUnreadBadges();
}


// ==============================
// グループ作成
// ==============================

createGroupButton?.addEventListener(
    "click",
    async () => {

        const groupName =
            prompt("グループ名を入力してください");


        if (!groupName) return;


        const membersText =
            prompt(
                "参加させる友達の名前をカンマ区切りで入力してください。\n例：たかし,けんた"
            );


        let members = [username];


        if (membersText) {

            const names =
                membersText
                    .split(",")
                    .map(name => name.trim())
                    .filter(Boolean);


            for (const name of names) {

                const friend =
                    friendsData.find(
                        friend =>
                            friend.friendName === name
                    );


                if (!friend) {

                    alert(
                        `${name}さんはあなたの友達一覧にいません。`
                    );

                    return;
                }


                if (!members.includes(name)) {
                    members.push(name);
                }

            }

        }


        try {

            await addDoc(
                collection(db, "groups"),
                {
                    name: groupName.trim(),
                    owner: username,
                    members: members,
                    createdAt: serverTimestamp()
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

    }
);


// ==============================
// グループ管理
// ==============================

async function manageGroup(group) {

    const choice =
        prompt(
            `「${group.name}」の管理\n\n1 → メンバーを追加\n2 → グループから退会\n\n番号を入力してください`
        );


    if (choice === "1") {

        await addMembersToGroup(group);

    } else if (choice === "2") {

        await leaveGroup(group);

    }

}


// ==============================
// グループにメンバー追加
// ==============================

async function addMembersToGroup(group) {

    const text =
        prompt(
            "追加する友達の名前をカンマ区切りで入力してください。\n例：たかし,けんた"
        );


    if (!text) return;


    const names =
        text
            .split(",")
            .map(name => name.trim())
            .filter(Boolean);


    const newMembers =
        [...(group.members || [])];


    for (const name of names) {

        const friend =
            friendsData.find(
                friend =>
                    friend.friendName === name
            );


        if (!friend) {

            alert(
                `${name}さんはあなたの友達ではありません。`
            );

            return;
        }


        if (!newMembers.includes(name)) {

            newMembers.push(name);
        }

    }


    try {

        await updateDoc(
            doc(db, "groups", group.id),
            {
                members: newMembers
            }
        );


        alert(
            "メンバーを追加しました！"
        );


    } catch (error) {

        console.error(error);

        alert(
            "メンバー追加に失敗しました。"
        );

    }

}


// ==============================
// グループ退会
// ==============================

async function leaveGroup(group) {

    const ok =
        confirm(
            `「${group.name}」から退会しますか？`
        );


    if (!ok) return;


    try {

        const members =
            (group.members || [])
                .filter(member =>
                    member !== username
                );


        // 自分しかいない場合
        if (members.length === 0) {

            await deleteDoc(
                doc(db, "groups", group.id)
            );

        } else {

            const updateData = {
                members: members
            };


            // オーナーだった場合
            if (group.owner === username) {

                updateData.owner =
                    members[0];
            }


            await updateDoc(
                doc(db, "groups", group.id),
                updateData
            );

        }


        if (
            selectedChat === group.id &&
            selectedChatType === "group"
        ) {

            selectedChat = null;
            selectedChatType = null;

            chatHeader.textContent =
                "相手を選択してください";

            messagesElement.innerHTML = "";

            messageInput.disabled = true;
            sendButton.disabled = true;

        }


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


// ==============================
// 友達選択
// ==============================

async function selectFriend(friendName) {

    try {

        const friendshipId =
            await ensureFriendshipId(friendName);


        selectedChat = friendName;
        selectedChatType = "friend";
        selectedFriendshipId = friendshipId;


        chatHeader.textContent =
            friendName;


        messageInput.disabled = false;
        sendButton.disabled = false;

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


// ==============================
// グループ選択
// ==============================

async function selectGroup(groupId) {

    const group =
        groupsData.find(
            group => group.id === groupId
        );


    if (!group) return;


    selectedChat = groupId;
    selectedChatType = "group";
    selectedFriendshipId = null;


    chatHeader.textContent =
        `👥 ${group.name}`;


    messageInput.disabled = false;
    sendButton.disabled = false;


    messageInput.placeholder =
        `${group.name}にメッセージ`;


    cancelReply();


    listenMessages();


    await markGroupMessagesAsRead();


    renderCurrentMessages();

}


// ==============================
// メッセージ監視
// ==============================

function listenMessages() {

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }


    const q =
        query(
            collection(db, "messages"),
            orderBy("createdAt", "asc")
        );


    unsubscribeMessages =
        onSnapshot(q, snapshot => {

            renderMessages(
                snapshot.docs.map(
                    item => ({
                        id: item.id,
                        ...item.data()
                    })
                )
            );

        });

}


// ==============================
// メッセージ描画
// ==============================

function renderMessages(allMessages) {

    let filtered = [];


    if (
        selectedChatType === "friend" &&
        selectedFriendshipId
    ) {

        filtered =
            allMessages.filter(message => {

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

            });

    } else if (
        selectedChatType === "group"
    ) {

        filtered =
            allMessages.filter(message =>
                message.chatType === "group" &&
                message.chatId === selectedChat
            );

    }


    messagesElement.innerHTML = "";


    filtered.forEach(message => {

        renderSingleMessage(message);

    });


    messagesElement.scrollTop =
        messagesElement.scrollHeight;

}


// ==============================
// 1つのメッセージ
// ==============================

function renderSingleMessage(message) {

    const row =
        document.createElement("div");

    const mine =
        message.sender === username;


    row.className =
        mine
            ? "message-row mine"
            : "message-row";


    const bubble =
        document.createElement("div");

    bubble.className =
        mine
            ? "message-bubble mine"
            : "message-bubble";


    if (
        selectedChatType === "group" &&
        !mine
    ) {

        const sender =
            document.createElement("div");

        sender.className =
            "message-sender";

        sender.textContent =
            message.sender;

        bubble.appendChild(sender);

    }


    if (message.replyToText) {

        const reply =
            document.createElement("div");

        reply.className =
            "message-reply";

        reply.textContent =
            `↩ ${message.replyToText}`;

        bubble.appendChild(reply);
    }


    const text =
        document.createElement("div");

    text.className =
        "message-text";


    if (message.deleted) {

        text.textContent =
            "このメッセージは削除されました。";

        text.style.opacity = "0.6";

    } else {

        text.textContent =
            message.text || "";

    }


    bubble.appendChild(text);


    const time =
        document.createElement("div");

    time.className =
        "message-time";


    if (message.createdAt?.toDate) {

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


    bubble.appendChild(time);


    // リアクション
    if (message.reaction) {

        const reaction =
            document.createElement("div");

        reaction.className =
            "message-reaction";

        reaction.textContent =
            message.reaction;

        bubble.appendChild(reaction);

    }


    // 操作ボタン
    if (!message.deleted) {

        const actions =
            document.createElement("div");

        actions.className =
            "message-actions";


        const replyButton =
            document.createElement("button");

        replyButton.textContent =
            "↩";

        replyButton.title =
            "返信";


        replyButton.addEventListener(
            "click",
            () => startReply(message)
        );


        const reactionButton =
            document.createElement("button");

        reactionButton.textContent =
            "❤️";

        reactionButton.title =
            "リアクション";


        reactionButton.addEventListener(
            "click",
            () => addReaction(message.id)
        );


        actions.appendChild(replyButton);
        actions.appendChild(reactionButton);


        if (mine) {

            const deleteButton =
                document.createElement("button");

            deleteButton.textContent =
                "🗑️";

            deleteButton.title =
                "送信取り消し";


            deleteButton.addEventListener(
                "click",
                () => deleteMessage(message.id)
            );


            actions.appendChild(deleteButton);

        }


        bubble.appendChild(actions);
    }


    row.appendChild(bubble);

    messagesElement.appendChild(row);

}


// ==============================
// メッセージ送信
// ==============================

sendButton?.addEventListener(
    "click",
    sendMessage
);


messageInput?.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            sendMessage();

        }

    }
);


async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) return;


    if (!selectedChat) {

        alert(
            "友達またはグループを選択してください。"
        );

        return;
    }


    try {

        const messageData = {

            sender: username,

            text: text,

            createdAt: serverTimestamp(),

            deleted: false,

            readBy: [username]

        };


        if (selectedChatType === "friend") {

            messageData.receiver =
                selectedChat;

            messageData.chatType =
                "friend";

            messageData.friendshipId =
                selectedFriendshipId;

        }


        if (selectedChatType === "group") {

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
            collection(db, "messages"),
            messageData
        );


        messageInput.value = "";

        cancelReply();


        setTimeout(() => {

            messagesElement.scrollTop =
                messagesElement.scrollHeight;

        }, 100);


    } catch (error) {

        console.error(error);

        alert(
            "メッセージ送信に失敗しました。"
        );

    }

}


// ==============================
// 返信
// ==============================

let replyingMessage = null;


function startReply(message) {

    replyingMessage = message;


    replyBar.classList.remove("hidden");


    replyText.textContent =
        message.text || "";


    messageInput.focus();

}


cancelReplyButton?.addEventListener(
    "click",
    cancelReply
);


function cancelReply() {

    replyingMessage = null;

    replyBar?.classList.add("hidden");

    if (replyText) {
        replyText.textContent = "";
    }

}


// ==============================
// メッセージ削除
// ==============================

async function deleteMessage(messageId) {

    const ok =
        confirm(
            "このメッセージの送信を取り消しますか？"
        );


    if (!ok) return;


    try {

        await updateDoc(
            doc(db, "messages", messageId),
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


// ==============================
// リアクション
// ==============================

async function addReaction(messageId) {

    try {

        await updateDoc(
            doc(db, "messages", messageId),
            {
                reaction: "❤️"
            }
        );

    } catch (error) {

        console.error(error);

    }

}


// ==============================
// 既読
// ==============================

async function markFriendMessagesAsRead() {

    if (!selectedFriendshipId) return;


    const snapshot =
        await getDocs(
            collection(db, "messages")
        );


    const batch =
        writeBatch(db);


    let count = 0;


    snapshot.forEach(item => {

        const data = item.data();


        const pair =
            (
                data.sender === selectedChat &&
                data.receiver === username
            );


        if (
            pair &&
            data.friendshipId === selectedFriendshipId &&
            !(data.readBy || []).includes(username)
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

    });


    if (count > 0) {
        await batch.commit();
    }

}


async function markGroupMessagesAsRead() {

    if (!selectedChat) return;


    const snapshot =
        await getDocs(
            collection(db, "messages")
        );


    const batch =
        writeBatch(db);


    let count = 0;


    snapshot.forEach(item => {

        const data = item.data();


        if (
            data.chatType === "group" &&
            data.chatId === selectedChat &&
            !(data.readBy || []).includes(username)
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

    });


    if (count > 0) {
        await batch.commit();
    }

}


// ==============================
// 全メッセージ監視
// 未読数用
// ==============================

function listenAllMessages() {

    if (unsubscribeAllMessages) {
        unsubscribeAllMessages();
    }


    const q =
        query(
            collection(db, "messages"),
            orderBy("createdAt", "asc")
        );


    unsubscribeAllMessages =
        onSnapshot(q, () => {

            updateUnreadBadges();

        });

}


// ==============================
// 未読数
// ==============================

async function updateUnreadBadges() {

    if (!username) return;


    try {

        const snapshot =
            await getDocs(
                collection(db, "messages")
            );


        const messages =
            snapshot.docs.map(
                item => ({
                    id: item.id,
                    ...item.data()
                })
            );


        // 友達
        document
            .querySelectorAll(
                ".friend-item"
            )
            .forEach((row, index) => {

                const friend =
                    friendsData[index];

                if (!friend) return;


                const badge =
                    row.querySelector(
                        ".unread-badge"
                    );


                if (!badge) return;


                let count = 0;


                messages.forEach(message => {

                    const pair =
                        message.sender ===
                            friend.friendName &&
                        message.receiver ===
                            username;


                    const sameFriendship =
                        !friend.friendshipId ||
                        message.friendshipId ===
                            friend.friendshipId;


                    if (
                        pair &&
                        sameFriendship &&
                        !(message.readBy || [])
                            .includes(username)
                    ) {

                        count++;

                    }

                });


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

            });


    } catch (error) {

        console.error(error);

    }

}


// ==============================
// 初期表示
// ==============================

messageInput.disabled = true;
sendButton.disabled = true;
