importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDJFat47Sz6KKaGuvj1jVdfELhRmH_2Tw",
  authDomain: "yuuchat-be666.firebaseapp.com",
  projectId: "yuuchat-be666",
  storageBucket: "yuuchat-be666.firebasestorage.app",
  messagingSenderId: "89509274877",
  appId: "1:89509274877:web:978a6179645ce88c3d4a94"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("バックグラウンド通知:", payload);
});
