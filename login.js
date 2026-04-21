import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db, signOut } from './firebase.js';

const loginForm = document.getElementById('login-form');
const formMessage = document.getElementById('form-message');
const loadingOverlay = document.getElementById('loadingOverlay');
let activeTypingJob = 0;

function showLoadingOverlay(text = 'Initializing C.O.T.E System...') {
  if (!loadingOverlay) return;

  loadingOverlay.classList.remove('loading-overlay-fade-out');
  updateLoadingText(text);

  loadingOverlay.classList.add('loading-overlay-visible');
  loadingOverlay.setAttribute('aria-hidden', 'false');
}

function updateLoadingText(text) {
  if (!loadingOverlay) return;

  const loadingTextElement = loadingOverlay.querySelector('.loading-text');
  if (loadingTextElement) {
    loadingTextElement.textContent = text;
    loadingTextElement.classList.remove('is-switching');
    void loadingTextElement.offsetWidth;
    loadingTextElement.classList.add('is-switching');
    setTimeout(() => loadingTextElement.classList.remove('is-switching'), 360);
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return;

  activeTypingJob += 1;
  loadingOverlay.classList.add('loading-overlay-fade-out');
  loadingOverlay.classList.remove('loading-overlay-visible');
  loadingOverlay.setAttribute('aria-hidden', 'true');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeLoadingText(text, speed = 26) {
  if (!loadingOverlay) return;

  const loadingTextElement = loadingOverlay.querySelector('.loading-text');
  if (!loadingTextElement) return;

  const job = ++activeTypingJob;
  loadingTextElement.textContent = '';

  for (const character of text) {
    if (job !== activeTypingJob) return;
    loadingTextElement.textContent += character;
    await wait(speed);
  }
}

async function playLoadingSequence(messages, interval = 760, useTypewriter = false) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  for (const message of messages) {
    if (useTypewriter) {
      await typeLoadingText(message, 22);
    } else {
      updateLoadingText(message);
    }

    await wait(interval);
  }
}

async function redirectWithOverlay(path) {
  showLoadingOverlay('Authenticating...');
  await playLoadingSequence(['Authenticating...', 'Access Granted', 'Entering C.O.T.E System...'], 520, true);
  await wait(220);
  window.location.href = path;
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    showFormMessage('Please enter both your email and password.', 'error');
    return;
  }

  const submitButton = loginForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';
  }

  showLoadingOverlay('Authenticating...');
  let hasRedirected = false;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await signOut(auth);
      showFormMessage('User record not found.', 'error');
      return;
    }

    const userData = userSnap.data();
    const role = String(userData.role || '').trim();
    const status = String(userData.status || '').trim();

    if (role === 'superAdmin' && status === 'active') {
      hasRedirected = true;
      await redirectWithOverlay('super-admin.html');
      return;
    }

    if (role === 'teacher' && status === 'active') {
      hasRedirected = true;
      await redirectWithOverlay('admin.html');
      return;
    }

    if (role === 'teacher' && status !== 'active') {
      await signOut(auth);
      showFormMessage('Your teacher account is pending approval.', 'error');
      return;
    }

    if (role === 'student') {
      hasRedirected = true;
      await redirectWithOverlay('dashboard.html');
      return;
    }

    await signOut(auth);
    showFormMessage('Unable to determine account access. Please contact support.', 'error');
  } catch (error) {
    console.error('Login failed:', error);

    let errorMessage = 'Login failed. Please try again.';

    if (error?.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error?.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password.';
    }

    showFormMessage(errorMessage, 'error');
  } finally {
    if (!hasRedirected) {
      hideLoadingOverlay();
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
    }
  }
});

window.addEventListener('load', async () => {
  showLoadingOverlay('Initializing C.O.T.E System...');
  await playLoadingSequence(['Initializing C.O.T.E System...', 'Loading Profile...', 'Syncing Records...'], 460, true);
  await wait(160);
  hideLoadingOverlay();
});

function showFormMessage(message, type) {
  if (!formMessage) return;

  formMessage.textContent = message;
  formMessage.classList.remove('success', 'error');
  formMessage.classList.add(type);
}
