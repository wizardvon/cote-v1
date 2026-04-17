import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';

const emailElement = document.getElementById('student-email');
const logoutButton = document.getElementById('logout-button');

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  if (emailElement) {
    emailElement.textContent = user.email || 'No email available';
  }
});

logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Logging out...';

  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (error) {
    console.error('Logout failed:', error);
    logoutButton.disabled = false;
    logoutButton.textContent = 'Logout';
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
