import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';

const emailElement = document.getElementById('student-email');
const fullNameElement = document.getElementById('student-full-name');
const profileEmailElement = document.getElementById('student-profile-email');
const sexElement = document.getElementById('student-sex');
const birthdayElement = document.getElementById('student-birthday');
const lrnElement = document.getElementById('student-lrn');
const phoneElement = document.getElementById('student-phone');
const addressElement = document.getElementById('student-address');
const logoutButton = document.getElementById('logout-button');

const setText = (element, value) => {
  if (!element) return;
  element.textContent = value || 'Not provided';
};

const getFullName = (data) => {
  const nameParts = [data.firstName, data.middleName, data.lastName]
    .map((part) => (part || '').trim())
    .filter(Boolean);

  return nameParts.length ? nameParts.join(' ') : 'Not provided';
};

const loadStudentProfile = async (user) => {
  try {
    const studentDocRef = doc(db, 'students', user.uid);
    const studentSnapshot = await getDoc(studentDocRef);

    if (!studentSnapshot.exists()) {
      setText(fullNameElement, 'No profile data found');
      setText(profileEmailElement, user.email || 'Not provided');
      setText(sexElement, 'Not provided');
      setText(birthdayElement, 'Not provided');
      setText(lrnElement, 'Not provided');
      setText(phoneElement, 'Not provided');
      setText(addressElement, 'Not provided');
      return;
    }

    const studentData = studentSnapshot.data();

    setText(fullNameElement, getFullName(studentData));
    setText(profileEmailElement, studentData.email || user.email || 'Not provided');
    setText(sexElement, studentData.sex);
    setText(birthdayElement, studentData.birthday);
    setText(lrnElement, studentData.lrn);
    setText(phoneElement, studentData.phoneNumber);
    setText(addressElement, studentData.address);
  } catch (error) {
    console.error('Failed to load student profile:', error);
    setText(fullNameElement, 'Failed to load profile');
  }
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  if (emailElement) {
    emailElement.textContent = user.email || 'No email available';
  }

  loadStudentProfile(user);
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
