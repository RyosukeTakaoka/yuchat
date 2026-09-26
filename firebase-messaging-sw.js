importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);


firebase.initializeApp({

    apiKey:
        "AIzaSyDJFat47USz6KKaGuvj1dVjfELhRmH_2Tw",

    authDomain:
        "yuuchat-be666.firebaseapp.com",

    projectId:
        "yuuchat-be666",

    storageBucket:
        "yuuchat-be666.firebasestorage.app",

    messagingSenderId:
        "89509274877",

    appId:
        "1:89509274877:web:978a6179645ce88c3d4a94"

});


const messaging =
    firebase.messaging();


messaging.onBackgroundMessage(
    payload => {

        console.log(
            "バックグラウンド通知を受信:",
            payload
        );


        const notification =
            payload.notification || {};


        const title =
            notification.title ||
            payload.data?.title ||
            "ゆうChat";


        const body =
            notification.body ||
            payload.data?.body ||
            "新しいメッセージが届きました。";


        // notification payloadの場合は
        // Firebase側が自動表示するので二重表示を防ぐ
        if (payload.notification) {
            return;
        }


        self.registration.showNotification(
            title,
            {
                body: body,

                icon:
                    "./icon.png",

                badge:
                    "./icon.png",

                data: {
                    url:
                        "./"
                }
            }
        );

    }
);


// ==================================================
// 通知を押したとき
// ==================================================

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        const targetUrl =
            new URL(
                event.notification.data?.url ||
                "./",
                self.location.origin
            ).href;


        event.waitUntil(

            clients.matchAll(
                {
                    type:
                        "window",

                    includeUncontrolled:
                        true
                }
            ).then(
                clientList => {

                    for (
                        const client of clientList
                    ) {

                        if (
                            client.url ===
                            targetUrl &&
                            "focus" in client
                        ) {

                            return client.focus();

                        }

                    }


                    if (
                        clients.openWindow
                    ) {

                        return clients.openWindow(
                            targetUrl
                        );

                    }

                }
            )

        );

    }
);
