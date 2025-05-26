
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5yg-SqnGSS-l8QmnER8rTqjeWe_oLyOo",
  authDomain: "timewise-dxtlj.firebaseapp.com",
  projectId: "timewise-dxtlj",
  storageBucket: "timewise-dxtlj.firebasestorage.app",
  messagingSenderId: "556973799121",
  appId: "1:556973799121:web:e3ad7bc5eafd7ac017f7f0"
};

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);

export { app, auth };
