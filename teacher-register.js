import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';

const teacherRegistrationForm = document.getElementById('teacher-registration-form');
const teacherFormMessage = document.getElementById('teacher-form-message');

const requiredFields = [
  'firstName',
  'lastName',
  'sex',
  'birthday',
  'employeeNumber',
  'phoneNumber',
  'address',
  'email',
  'password',
];

teacherRegistrationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(teacherRegistrationForm);
  const payload = Object.fromEntries(formData.entries());

  const missingFields = requiredFields.filter((fieldName) => {
    const value = payload[fieldName];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingFields.length > 0) {
    showFormMessage('Please fill in all required fields before submitting.', 'error');
    return;
  }

  const submitButton = teacherRegistrationForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  try {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    await setDoc(doc(db, 'teachers', uid), {
      uid,
      firstName: payload.firstName.trim(),
      middleName: payload.middleName ? payload.middleName.trim() : '',
      lastName: payload.lastName.trim(),
      sex: payload.sex,
      birthday: payload.birthday,
      employeeNumber: payload.employeeNumber.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      address: payload.address.trim(),
      email,
      role: 'teacher',
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      role: 'teacher',
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    showFormMessage('Teacher registration submitted successfully.', 'success');
    teacherRegistrationForm.reset();
    console.log('Teacher registration submitted:', { uid, ...payload, email });
  } catch (error) {
    console.error('Teacher registration failed:', error);

    let errorMessage = 'Registration failed. Please try again.';

    if (error?.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please use a different email.';
    } else if (error?.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error?.code === 'auth/weak-password') {
      errorMessage = 'Password must be at least 6 characters long.';
    } else if (error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied') {
      errorMessage = 'Database permission denied. Check your Firestore security rules.';
    }

    showFormMessage(errorMessage, 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit';
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
