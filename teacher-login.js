import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';

const teacherLoginForm = document.getElementById('teacher-login-form');
const teacherFormMessage = document.getElementById('teacher-form-message');

teacherLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(teacherLoginForm);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    showFormMessage('Please enter both your email and password.', 'error');
    return;
  }

  const submitButton = teacherLoginForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    showFormMessage(`Login successful. Welcome, ${userCredential.user.email}.`, 'success');
    teacherLoginForm.reset();
    window.location.href = 'admin.html';
  } catch (error) {
    console.error('Teacher login failed:', error);

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
  if (!teacherFormMessage) {
    return;
  }

  teacherFormMessage.textContent = message;
  teacherFormMessage.classList.remove('success', 'error');
  teacherFormMessage.classList.add(type);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
