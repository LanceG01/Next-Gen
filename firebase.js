// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
         collection, query, where, getDocs, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAlxdga2ZCRSxEbV-41oEDfLBHZwyTsqcM",
  authDomain:        "next-gen-f6f07.firebaseapp.com",
  projectId:         "next-gen-f6f07",
  storageBucket:     "next-gen-f6f07.firebasestorage.app",
  messagingSenderId: "976044007375",
  appId:             "1:976044007375:web:b1d6eb62b2aed36d333cba"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

export { db, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
         collection, query, where, getDocs, onSnapshot, serverTimestamp };
