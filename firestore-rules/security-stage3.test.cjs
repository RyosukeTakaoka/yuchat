// 第3段階（ゲーム・ユーザー作成）の Firestore Rules セキュリティテスト（Emulator で許可/拒否を実際に確かめる）
// ・ゲームルームの参加者以外が不正操作できない（参加・対局・退出・削除・招待）
// ・ユーザー作成時の UID・ユーザー名の不正取得や重複登録（他人の名前の横取り・なりすまし）を防ぐ
// ・既存のゲーム（大富豪・オセロ・将棋）の正規操作は今まで通りできる
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp } = require("firebase/firestore");

let pass = 0, fail = 0; const logs = [];
async function ok(n, p) { try { await assertSucceeds(p); pass++; logs.push("PASS 許可 " + n); } catch (e) { fail++; logs.push("FAIL(許可されるべき) " + n + ": " + String(e.message).split("\n")[0]); } }
async function ng(n, p) { try { await assertFails(p); pass++; logs.push("PASS 拒否 " + n); } catch (e) { fail++; logs.push("FAIL(拒否されるべき) " + n); } }

(async () => {
  const env = await initializeTestEnvironment({ projectId: "demo-yuuchat-rules", firestore: { rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 } });
  const alice = env.authenticatedContext("uidA", { name: "alice" }).firestore();
  const bob = env.authenticatedContext("uidB", { name: "bob" }).firestore();
  const carol = env.authenticatedContext("uidC", { name: "carol" }).firestore();
  const noname = env.authenticatedContext("uidX").firestore(); // 名前クレームが無い（匿名ゲスト相当・同期前）
  const anon = env.unauthenticatedContext().firestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "users/alice"), { uid: "uidA", name: "alice" });
    await setDoc(doc(d, "users/bob"), { uid: "uidB", name: "bob" });
    await setDoc(doc(d, "users/carol"), { uid: "uidC", name: "carol" });
    await setDoc(doc(d, "users/xname"), { uid: "uidX", name: "xname" });
    // ゲームルーム
    await setDoc(doc(d, "gameRooms/room1"), { gameType: "othello", owner: "alice", ownerUid: "uidA", members: ["alice"], memberUids: ["uidA"], status: "waiting" });
    await setDoc(doc(d, "gameRooms/roomPlay"), { gameType: "othello", owner: "alice", ownerUid: "uidA", members: ["alice", "bob"], memberUids: ["uidA", "uidB"], status: "playing", gameState: { currentPlayer: "black" } });
    await setDoc(doc(d, "gameRooms/roomInvite"), { gameType: "othello", owner: "alice", ownerUid: "uidA", members: ["alice"], memberUids: ["uidA"], status: "waiting", invitedUsers: ["carol"] });
    await setDoc(doc(d, "gameRooms/roomDel"), { gameType: "othello", owner: "alice", ownerUid: "uidA", members: ["alice", "bob"], memberUids: ["uidA", "uidB"], status: "waiting" });
    await setDoc(doc(d, "gameRooms/roomSolo"), { gameType: "othello", owner: "alice", members: ["bob"], memberUids: ["uidB"], status: "waiting" }); // ownerUid 無し・最後の1人が bob
    // ルール作成の記録（ロック）
    await setDoc(doc(d, "gameRoomOwners/uidA_othello"), { uid: "uidA", gameType: "othello", roomId: "room1" });
    await setDoc(doc(d, "gameRoomOwners/uidA_del"), { uid: "uidA", gameType: "shogi", roomId: "roomZ" });
    // 招待
    await setDoc(doc(d, "gameInvites/room1_uidC"), { roomId: "room1", gameType: "othello", from: "alice", fromUid: "uidA", to: "carol", toUid: "uidC", status: "pending" });
    await setDoc(doc(d, "gameInvites/roomInvite_uidC"), { roomId: "roomInvite", gameType: "othello", from: "alice", fromUid: "uidA", to: "carol", toUid: "uidC", status: "pending" });
  });

  logs.push("--- ① ゲームルーム：読み取りはロビー公開、作成は作成者が自分");
  await ok("ログイン済みならロビー（gameRooms 一覧）を読める", getDocs(collection(alice, "gameRooms")));
  await ng("未ログインはロビーを読めない", getDocs(collection(anon, "gameRooms")));
  await ok("alice が部屋を作る（ownerUid が自分・memberUids が自分だけ）", setDoc(doc(alice, "gameRooms/newA"), { gameType: "othello", owner: "alice", ownerUid: "uidA", members: ["alice"], memberUids: ["uidA"], status: "waiting", createdAt: serverTimestamp() }));
  await ng("alice が ownerUid を他人にして部屋を作る", setDoc(doc(alice, "gameRooms/evil1"), { gameType: "othello", ownerUid: "uidB", members: ["bob"], memberUids: ["uidB"], status: "waiting" }));
  await ng("alice が最初から他人を入れて部屋を作る", setDoc(doc(alice, "gameRooms/evil2"), { gameType: "othello", ownerUid: "uidA", members: ["alice", "bob"], memberUids: ["uidA", "uidB"], status: "waiting" }));
  await ng("未ログインが部屋を作る", setDoc(doc(anon, "gameRooms/evil3"), { ownerUid: "uidA" }));

  logs.push("--- ② ゲームルーム：参加・対局・退出・招待辞退");
  await ok("bob が room1 に参加（自分を memberUids に追加）", updateDoc(doc(bob, "gameRooms/room1"), { members: ["alice", "bob"], memberUids: ["uidA", "uidB"], updatedAt: serverTimestamp() }));
  await ng("carol が room1 から alice を追い出す（参加者でも参加中でもない）", updateDoc(doc(carol, "gameRooms/roomDel"), { members: ["carol"], memberUids: ["uidC"], updatedAt: serverTimestamp() }));
  await ok("参加者 bob が roomPlay の盤面（gameState）を更新（対局）", updateDoc(doc(bob, "gameRooms/roomPlay"), { gameState: { currentPlayer: "white" }, updatedAt: serverTimestamp() }));
  await ng("非参加者 carol が roomPlay の盤面を更新", updateDoc(doc(carol, "gameRooms/roomPlay"), { gameState: { currentPlayer: "white" } }));
  await ok("招待された carol が invitedUsers から自分だけを外す（辞退）", updateDoc(doc(carol, "gameRooms/roomInvite"), { invitedUsers: [], updatedAt: serverTimestamp() }));
  await ng("非メンバー carol が roomInvite の状態を勝手に変える（参加せず）", updateDoc(doc(carol, "gameRooms/roomInvite"), { status: "playing" }));
  await ng("参加するふりで carol が他の参加者を追い出す（memberUids から他人を消す）", updateDoc(doc(carol, "gameRooms/room1"), { members: ["carol"], memberUids: ["uidC"] }));
  await ng("未ログインが部屋を更新", updateDoc(doc(anon, "gameRooms/room1"), { status: "x" }));

  logs.push("--- ③ ゲームルーム：削除は作成者または最後の1人");
  await ng("参加者だが作成者でない bob が roomDel を削除", deleteDoc(doc(bob, "gameRooms/roomDel")));
  await ng("非参加者 carol が room1 を削除", deleteDoc(doc(carol, "gameRooms/room1")));
  await ok("作成者 alice が roomDel を削除", deleteDoc(doc(alice, "gameRooms/roomDel")));
  await ok("最後の1人 bob が roomSolo を削除", deleteDoc(doc(bob, "gameRooms/roomSolo")));

  logs.push("--- ④ ルーム作成の記録（gameRoomOwners）：自分の UID の記録だけ");
  await ok("alice が自分のロックを読む", getDoc(doc(alice, "gameRoomOwners/uidA_othello")));
  await ng("carol が alice のロックを読む", getDoc(doc(carol, "gameRoomOwners/uidA_othello")));
  await ok("alice が存在しない自分のロックを読む（未作成）", getDoc(doc(alice, "gameRoomOwners/uidA_new")));
  await ok("alice が自分の UID のロックを作る", setDoc(doc(alice, "gameRoomOwners/uidA_daifugo"), { uid: "uidA", gameType: "daifugo", roomId: "r", updatedAt: serverTimestamp() }));
  await ng("alice が他人の UID のロックを作る", setDoc(doc(alice, "gameRoomOwners/uidB_othello"), { uid: "uidB", gameType: "othello", roomId: "r" }));
  await ng("carol が alice のロックを削除", deleteDoc(doc(carol, "gameRoomOwners/uidA_del")));
  await ok("alice が自分のロックを削除", deleteDoc(doc(alice, "gameRoomOwners/uidA_del")));

  logs.push("--- ⑤ ゲームの招待（gameInvites）：当事者だけ");
  await ok("送られた carol が自分あての招待を読む", getDocs(query(collection(carol, "gameInvites"), where("toUid", "==", "uidC"), where("status", "==", "pending"))));
  await ng("bob が carol あての招待を覗く", getDocs(query(collection(bob, "gameInvites"), where("toUid", "==", "uidC"), where("status", "==", "pending"))));
  await ok("ホスト alice が招待を作る（fromUid が自分・pending）", setDoc(doc(alice, "gameInvites/room1_uidB"), { roomId: "room1", gameType: "othello", from: "alice", fromUid: "uidA", to: "bob", toUid: "uidB", status: "pending", createdAt: serverTimestamp() }));
  await ng("bob が alice になりすまして招待を作る", setDoc(doc(bob, "gameInvites/room1_uidC2"), { roomId: "room1", fromUid: "uidA", to: "carol", toUid: "uidC", status: "pending" }));
  await ng("招待を最初から accepted で作る", setDoc(doc(alice, "gameInvites/room1_uidB2"), { roomId: "room1", fromUid: "uidA", toUid: "uidB", status: "accepted" }));
  await ok("送られた carol が招待を辞退（status 更新）", updateDoc(doc(carol, "gameInvites/room1_uidC"), { status: "declined", respondedAt: serverTimestamp() }));
  await ng("当事者でない bob が carol あての招待を更新", updateDoc(doc(bob, "gameInvites/roomInvite_uidC"), { status: "declined" }));
  await ok("当事者（送り主 alice）が招待を削除", deleteDoc(doc(alice, "gameInvites/roomInvite_uidC")));
  await ng("当事者でない bob が招待を削除", deleteDoc(doc(bob, "gameInvites/room1_uidC")));

  logs.push("--- ⑥ ユーザー作成：UID・名前の不正取得／なりすまし／重複登録を防ぐ");
  await ok("alice が自分の新しい名前のユーザーを作る（uid 自分・name=ID・経済項目なし）", setDoc(doc(alice, "users/alice2"), { uid: "uidA", name: "alice2" }));
  await ng("alice が他人の UID でユーザーを作る（なりすまし）", setDoc(doc(alice, "users/fakeB"), { uid: "uidB", name: "fakeB" }));
  await ng("alice が name とドキュメントIDが食い違うユーザーを作る", setDoc(doc(alice, "users/mismatch"), { uid: "uidA", name: "別の名前" }));
  await ng("alice が経済項目入りでユーザーを作る", setDoc(doc(alice, "users/richA"), { uid: "uidA", name: "richA", coins: 1000000 }));
  await ng("未ログインがユーザーを作る", setDoc(doc(anon, "users/anonU"), { uid: "uidA", name: "anonU" }));
  await ng("carol が既存の他人（alice）のユーザー名を乗っ取る（上書き）", setDoc(doc(carol, "users/alice"), { uid: "uidC", name: "alice" }));
  await ok("名前クレームありのユーザーが、自分の名前のドキュメントを更新できる", updateDoc(doc(alice, "users/alice"), { online: true, updatedAt: serverTimestamp() }));
  await ng("名前クレームありのユーザーが、別の名前のドキュメントを更新できない（なりすまし）", updateDoc(doc(alice, "users/bob"), { online: true }));
  await ok("名前クレームがまだ無いユーザーは、自分の UID のドキュメントを更新できる（同期前）", updateDoc(doc(noname, "users/xname"), { online: true, updatedAt: serverTimestamp() }));

  await env.cleanup();
  console.log(logs.join("\n"));
  console.log(`\n第3段階 セキュリティテスト: ${pass} PASS / ${fail} FAIL`);
  if (fail) process.exit(1);
})().catch((e) => { console.error(e); process.exit(2); });
