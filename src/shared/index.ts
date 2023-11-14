export const config = {
    logoCount: 5,
    firebaseConfig: {
        apiKey: "Your Firbase API Key",
        authDomain: "Your Firbase authDomain",
        projectId: "Your Firbase projectId",
        storageBucket: "Your Firbase storageBucket",
        messagingSenderId: "Your Firbase messagingSenderId",
        appId: "Your Firbase appId",
        measurementId: "Your Firbase measurementId"
    },
    servers: {
        iceServers: [
            {
            urls: ['stun:stun1.l.google.com:19302',
                   'stun:stun2.l.google.com:19302'],
            },
        ],
        iceCandidatePoolSize: 10,
    },
    DEV: "development" === 'development',
}

