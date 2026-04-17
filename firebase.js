import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// TODO: Paste your Firebase project config object below.
// You can find it in Firebase Console > Project settings > General > Your apps > SDK setup and configuration.
// Example keys are shown for guidance only.
const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY_HERE',
  authDomain: 'PASTE_YOUR_AUTH_DOMAIN_HERE',
  projectId: 'PASTE_YOUR_PROJECT_ID_HERE',
  storageBucket: 'PASTE_YOUR_STORAGE_BUCKET_HERE',
  messagingSenderId: 'PASTE_YOUR_MESSAGING_SENDER_ID_HERE',
  appId: 'PASTE_YOUR_APP_ID_HERE',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
