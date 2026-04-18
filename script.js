import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';

const registrationForm = document.getElementById('registration-form');
const formMessage = document.getElementById('form-message');
const gradeLevelSelect = document.getElementById('grade-level');
const sectionSelect = document.getElementById('section');

const sectionsByGrade = {
  'Grade 11': [
    'ABM 11 - Aboitiz',
    'HUMSS 11 - Aristotle',
    'HUMSS 11 - Confucius',
    'HUMSS 11 - Democritus',
    'HUMSS 11 - Freud',
    'HUMSS 11 - Plato',
    'STEM 11 - Newton',
    'TVL HE 11 - Stewart',
    'TVLE ICT 11 - Bill Gates',
  ],
  'Grade 12': [
    'ABM 12 - Gokongwei',
    'HUMSS 12 - Aquinas',
    'HUMSS 12 - Archimedes',
    'HUMSS 12 - Dewey',
    'HUMSS 12 - Pythagoras',
    'HUMSS 12 - Socrates',
    'STEM 12 - Galileo',
    'TVL HE 12 - Hilton',
    'TVLE ICT 12 - Lovelace',
  ],
};

const requiredFields = [
  'firstName',
  'lastName',
  'sex',
  'gradeLevel',
  'section',
  'birthday',
  'lrn',
  'phoneNumber',
  'address',
  'email',
  'password',
];

if (gradeLevelSelect && sectionSelect) {
  resetSectionSelect();

  gradeLevelSelect.addEventListener('change', () => {
    const selectedGrade = gradeLevelSelect.value;
    populateSectionOptions(selectedGrade);
  });
}

registrationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const payload = Object.fromEntries(formData.entries());

  const missingFields = requiredFields.filter((fieldName) => {
    const value = payload[fieldName];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingFields.length > 0) {
    showFormMessage('Please fill in all required fields before submitting.', 'error');
    return;
  }

  const lrnIsValid = /^\d{12}$/.test(payload.lrn.trim());
  if (!lrnIsValid) {
    showFormMessage('LRN must be exactly 12 digits.', 'error');
    return;
  }

  const submitButton = registrationForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
  }

  try {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    await setDoc(doc(db, 'students', uid), {
      uid,
      firstName: payload.firstName.trim(),
      middleName: payload.middleName ? payload.middleName.trim() : '',
      lastName: payload.lastName.trim(),
      sex: payload.sex,
      gradeLevel: payload.gradeLevel,
      section: payload.section,
      birthday: payload.birthday,
      lrn: payload.lrn.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      address: payload.address.trim(),
      email,
      points: 0,
      role: 'student',
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      role: 'student',
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    showFormMessage('Student registration submitted successfully.', 'success');
    registrationForm.reset();
    resetSectionSelect();
    console.log('Student registration submitted:', { uid, ...payload, email });
  } catch (error) {
    console.error('Registration failed:', error);

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

function resetSectionSelect() {
  if (!sectionSelect) {
    return;
  }

  sectionSelect.innerHTML = '<option value="" selected disabled>Select section</option>';
  sectionSelect.disabled = true;
}

function populateSectionOptions(gradeLevel) {
  if (!sectionSelect) {
    return;
  }

  resetSectionSelect();

  const sections = sectionsByGrade[gradeLevel] ?? [];
  if (sections.length === 0) {
    return;
  }

  const options = sections.map((section) => `<option value="${section}">${section}</option>`).join('');
  sectionSelect.insertAdjacentHTML('beforeend', options);
  sectionSelect.disabled = false;
}

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
