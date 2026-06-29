import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCuqFQSt-lkSzBgUS06v9YtR_jLu9Ms5Gg",
  authDomain: "wallpaper-f618c.firebaseapp.com",
  databaseURL: "https://wallpaper-f618c-default-rtdb.firebaseio.com",
  projectId: "wallpaper-f618c",
  storageBucket: "wallpaper-f618c.firebasestorage.app",
  messagingSenderId: "734224666313",
  appId: "1:734224666313:web:f27acf05e6471abcadc718"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, provider };