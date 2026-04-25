import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';

const registrationForm = document.getElementById('registration-form');
const formMessage = document.getElementById('form-message');
const gradeLevelSelect = document.getElementById('grade-level');
const schoolYearSelect = document.getElementById('school-year');
const sectionSelect = document.getElementById('section');

let schoolYearRecords = [];
let sectionRecords = [];

const requiredFields = [
  'firstName',
  'lastName',
  'sex',
  'gradeLevel',
  'schoolYearId',
  'sectionId',
  'birthday',
  'lrn',
  'phoneNumber',
  'address',
  'email',
  'password',
];

initializeRegistrationDependencies();

schoolYearSelect?.addEventListener('change', () => {
  refreshSectionOptions();
  clearFormMessage();
});

gradeLevelSelect?.addEventListener('change', () => {
  refreshSectionOptions();
  clearFormMessage();
});

registrationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormMessage();

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

  const normalizedSex = String(payload.sex || '').trim();
  if (!['Male', 'Female'].includes(normalizedSex)) {
    showFormMessage('Please select Male or Female.', 'error');
    return;
  }

  const lrnIsValid = /^\d{12}$/.test(payload.lrn.trim());
  if (!lrnIsValid) {
    showFormMessage('LRN must be exactly 12 digits.', 'error');
    return;
  }

  const selectedSchoolYear = schoolYearRecords.find((item) => item.id === payload.schoolYearId);
  if (!selectedSchoolYear) {
    showFormMessage('Please select a valid school year.', 'error');
    return;
  }

  const selectedSection = sectionRecords.find((item) => item.id === payload.sectionId);
  if (!selectedSection) {
    showFormMessage('Please select a valid section.', 'error');
    return;
  }

  if (selectedSection.gradeLevel !== payload.gradeLevel) {
    showFormMessage('Selected section does not match the chosen grade level.', 'error');
    return;
  }

  if (selectedSection.schoolYearId !== payload.schoolYearId) {
    showFormMessage('Selected section does not match the chosen school year.', 'error');
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
      sex: normalizedSex,
      schoolYearId: selectedSchoolYear.id,
      schoolYearName: selectedSchoolYear.name,
      gradeLevel: payload.gradeLevel,
      sectionId: selectedSection.id,
      sectionName: selectedSection.name,
      section: selectedSection.name,
      birthday: payload.birthday,
      lrn: payload.lrn.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      address: payload.address.trim(),
      email,
      points: 0,
      role: 'student',
      status: 'active',
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      role: 'student',
      status: 'active',
      createdAt: serverTimestamp(),
    });

    showFormMessage('Student registration submitted successfully.', 'success');
    registrationForm.reset();
    schoolYearSelect.innerHTML = '<option value="" selected disabled>Select school year</option>';
    resetSectionSelect('Select school year and grade level first', true);
    await loadSchoolYears();
  } catch (error) {
    console.error('Registration failed:', error);

    let errorMessage = 'Registration failed. Please try again.';

    if (error?.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please use a different email.';
    } else if (error?.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error?.code === 'auth/weak-password') {
      errorMessage = 'Password must be at least 6 characters long.';
    } else if (
      error?.code === 'permission-denied' ||
      error?.code === 'firestore/permission-denied'
    ) {
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
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.classList.remove('success', 'error');
  formMessage.classList.add(type);
}

function clearFormMessage() {
  if (!formMessage) return;
  formMessage.textContent = '';
  formMessage.classList.remove('success', 'error');
}

function resetSectionSelect(placeholder, disabled) {
  if (!sectionSelect) return;
  sectionSelect.innerHTML = `<option value="" selected disabled>${placeholder}</option>`;
  sectionSelect.disabled = disabled;
}

function refreshSectionOptions() {
  const selectedSchoolYearId = String(schoolYearSelect?.value || '').trim();
  const selectedGradeLevel = String(gradeLevelSelect?.value || '').trim();

  if (!selectedSchoolYearId || !selectedGradeLevel) {
    resetSectionSelect('Select school year and grade level first', true);
    return;
  }

  const filteredSections = sectionRecords.filter(
    (item) =>
      item.schoolYearId === selectedSchoolYearId &&
      item.gradeLevel === selectedGradeLevel
  );

  if (!filteredSections.length) {
    resetSectionSelect('No active sections available', true);
    return;
  }

  if (!sectionSelect) return;

  const options = filteredSections
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )
    .join('');

  sectionSelect.innerHTML =
    '<option value="" selected disabled>Select section</option>' + options;
  sectionSelect.disabled = false;
}

async function initializeRegistrationDependencies() {
  resetSectionSelect('Select school year and grade level first', true);

  try {
    await Promise.all([loadSchoolYears(), loadSections()]);
    refreshSectionOptions();
  } catch (error) {
    console.error('Failed to initialize registration dropdowns:', error);
    showFormMessage('Unable to load school years and sections right now.', 'error');
  }
}

async function loadSchoolYears() {
  if (!schoolYearSelect) return;

  const schoolYearsSnapshot = await getDocs(
    query(collection(db, 'schoolYears'), where('status', '==', 'active'))
  );

  schoolYearRecords = schoolYearsSnapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name || '').trim(),
      };
    })
    .filter((item) => item.name);

  const options = schoolYearRecords
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join('');

  schoolYearSelect.innerHTML =
    '<option value="" selected disabled>Select school year</option>' + options;
}

async function loadSections() {
  const sectionsSnapshot = await getDocs(
    query(collection(db, 'sections'), where('status', '==', 'active'))
  );

  sectionRecords = sectionsSnapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name || '').trim(),
        gradeLevel: String(data.gradeLevel || '').trim(),
        schoolYearId: String(data.schoolYearId || '').trim(),
        schoolYearName: String(data.schoolYearName || '').trim(),
      };
    })
    .filter((item) => item.name && item.gradeLevel && item.schoolYearId);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
