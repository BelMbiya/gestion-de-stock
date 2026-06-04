import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBI38APQgMr0k6pb4pwwX64KRum50SDZ-s",
  authDomain: "stock-it-c0557.firebaseapp.com",
  projectId: "stock-it-c0557",
  storageBucket: "stock-it-c0557.firebasestorage.app",
  messagingSenderId: "392508090440",
  appId: "1:392508090440:web:6f143a406362344108907d"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();