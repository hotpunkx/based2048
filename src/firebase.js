import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBinU8uIfja4R4ZXUoAL0SXn4IAViNl2aQ",
    authDomain: "based2048-11a61.firebaseapp.com",
    projectId: "based2048-11a61",
    storageBucket: "based2048-11a61.firebasestorage.app",
    messagingSenderId: "910597138820",
    appId: "1:910597138820:web:2943a352ebc09a294555d1",
    measurementId: "G-L26R9P78SC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
