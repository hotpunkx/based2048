import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBlKDgANzSeR89cUvhuMK-_pjn6feJhxMU",
    authDomain: "based-2048.firebaseapp.com",
    projectId: "based-2048",
    storageBucket: "based-2048.firebasestorage.app",
    messagingSenderId: "70819610508",
    appId: "1:70819610508:web:44912fcf9a7c2841f420a9",
    measurementId: "G-RG3LHZBP1G"
};

const app = (() => {
    try {
        if (!firebaseConfig.apiKey) throw new Error("Missing Firebase Config");
        return initializeApp(firebaseConfig);
    } catch (e) {
        console.error("Firebase Init Error:", e);
        return null;
    }
})();

export const db = app ? getFirestore(app) : null;
