import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from './firebase.js';

const emailElement = document.getElementById('student-email');
const profileDataElement = document.getElementById('profileData');
const logoutButton = document.getElementById('logout-button');

const displayValue = (value) => {
  if (value === undefined || value === null) return 'Not provided';
  const trimmed = String(value).trim();
  return trimmed || 'Not provided';
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getFullName = (data) => {
  const nameParts = [data.firstName, data.middleName, data.lastName]
    .map((part) => (part || '').trim())
    .filter(Boolean);

  return nameParts.length ? nameParts.join(' ') : data.fullName || 'Not provided';
};

const renderProfile = (profile) => {
  if (!profileDataElement) return;

  profileDataElement.innerHTML = `
    <p><strong>Full Name:</strong> ${escapeHtml(displayValue(profile.fullName))}</p>
    <p><strong>Email:</strong> ${escapeHtml(displayValue(profile.email))}</p>
    <p><strong>Sex:</strong> ${escapeHtml(displayValue(profile.sex))}</p>
    <p><strong>Birthday:</strong> ${escapeHtml(displayValue(profile.birthday))}</p>
    <p><strong>LRN:</strong> ${escapeHtml(displayValue(profile.lrn))}</p>
    <p><strong>Phone Number:</strong> ${escapeHtml(displayValue(profile.phoneNumber))}</p>
    <p><strong>Address:</strong> ${escapeHtml(displayValue(profile.address))}</p>
  `;
};

const loadStudentProfile = async (user) => {
  try {
    const studentDocRef = doc(db, 'students', user.uid);
    const studentSnapshot = await getDoc(studentDocRef);

    if (!studentSnapshot.exists()) {
      renderProfile({
        fullName: 'No profile data found',
        email: user.email,
        sex: null,
        birthday: null,
        lrn: null,
        phoneNumber: null,
        address: null
      });
      return;
    }

    const studentData = studentSnapshot.data();

    renderProfile({
      fullName: getFullName(studentData),
      email: studentData.email || user.email,
      sex: studentData.sex,
      birthday: studentData.birthday,
      lrn: studentData.lrn,
      phoneNumber: studentData.phoneNumber,
      address: studentData.address
    });
  } catch (error) {
    console.error('Failed to load student profile:', error);
    renderProfile({
      fullName: 'Failed to load profile',
      email: user.email,
      sex: null,
      birthday: null,
      lrn: null,
      phoneNumber: null,
      address: null
    });
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
