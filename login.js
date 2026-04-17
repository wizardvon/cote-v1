import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';

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

    showFormMessage(`Login successful. Welcome back, ${userCredential.user.email}.`, 'success');
    loginForm.reset();
    console.log('Login successful:', userCredential.user.uid);
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Login failed:', error);

    let errorMessage = 'Login failed. Please try again.';

    if (error?.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error?.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (error?.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled. Please contact support.';
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
  if (!formMessage) {
    return;
  }

  formMessage.textContent = message;
  formMessage.classList.remove('success', 'error');
  formMessage.classList.add(type);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
