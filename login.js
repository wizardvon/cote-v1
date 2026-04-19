import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';

const loginForm = document.getElementById('login-form');
const formMessage = document.getElementById('form-message');

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

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 🔥 GET ROLE FROM FIRESTORE
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showFormMessage('User record not found.', 'error');
      return;
    }

    const role = userSnap.data().role;

    showFormMessage(`Login successful. Welcome back, ${user.email}.`, 'success');

    // 🔥 ROLE-BASED REDIRECT
    if (role === 'teacher') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }

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
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
    }
  }
});

function showFormMessage(message, type) {
  if (!formMessage) return;

  formMessage.textContent = message;
  formMessage.classList.remove('success', 'error');
  formMessage.classList.add(type);
}
