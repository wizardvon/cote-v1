import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  limit,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA_y-kzUWTt04vuyKSqR9b5_L8c_VvbCIs',
  authDomain: 'cote-v1.firebaseapp.com',
  projectId: 'cote-v1',
  storageBucket: 'cote-v1.firebasestorage.app',
  messagingSenderId: '414423398647',
  appId: '1:414423398647:web:2e61049858326b2b2b7bf2'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  limit,
  query,
  where,
  orderBy,
  serverTimestamp
};
