import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
} from './firebase.js';

const profileDataElement = document.getElementById('profileData');
const profileFullNameElement = document.getElementById('profile-full-name');
const profileEmailElement = document.getElementById('profile-email');
const sidebarStudentEmailElement = document.getElementById('sidebar-student-email');
const pointsTotalElement = document.getElementById('points-total');
const logoutButton = document.getElementById('logout-button');
const pageTitleElement = document.getElementById('page-title');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const burgerButton = document.getElementById('burger-button');

const menuButtons = Array.from(document.querySelectorAll('.menu-btn'));
const pages = Array.from(document.querySelectorAll('.page'));

const pageTitles = {
  home: 'Home',
  profile: 'Profile',
  records: 'Records',
  resources: 'Resources',
  quest: 'Quest',
};

function safe(value) {
  if (value === undefined || value === null) return 'Not provided';
  const text = String(value).trim();
  return text || 'Not provided';
}

function fullName(data) {
  return [data.firstName, data.middleName, data.lastName]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ') || 'Not provided';
}

function toggleSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  sidebar.setAttribute('aria-hidden', String(isOpen));
  sidebarOverlay.hidden = isOpen;
}

function closeSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden', 'true');
  sidebarOverlay.hidden = true;
}

function showPage(pageName) {
  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === pageName);
  });

  menuButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === pageName);
  });

  if (pageTitleElement) {
    pageTitleElement.textContent = pageTitles[pageName] || 'Dashboard';
  }

  closeSidebar();
}

function renderProfile(data, fallbackEmail, points) {
  const displayName = safe(fullName(data));
  const displayEmail = safe(data.email || fallbackEmail);

  if (profileFullNameElement) {
    profileFullNameElement.textContent = displayName;
  }

  if (profileEmailElement) {
    profileEmailElement.textContent = displayEmail;
  }

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = displayEmail;
  }

  profileDataElement.innerHTML = `
    <p><strong>Full Name:</strong> ${displayName}</p>
    <p><strong>Email:</strong> ${displayEmail}</p>
    <p><strong>Sex:</strong> ${safe(data.sex)}</p>
    <p><strong>Birthday:</strong> ${safe(data.birthday)}</p>
    <p><strong>LRN:</strong> ${safe(data.lrn)}</p>
    <p><strong>Phone Number:</strong> ${safe(data.phoneNumber)}</p>
    <p><strong>Address:</strong> ${safe(data.address)}</p>
    <p><strong>Total Points:</strong> ${points}</p>
  `;
}

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.target;
    showPage(target);
  });
});

burgerButton?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebar();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = user.email || 'No email available';
  }

  try {
    const studentRef = doc(db, 'students', user.uid);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      profileDataElement.innerHTML = `
        <p><strong>Full Name:</strong> No profile found</p>
        <p><strong>Email:</strong> ${safe(user.email)}</p>
        <p><strong>Sex:</strong> Not provided</p>
        <p><strong>Birthday:</strong> Not provided</p>
        <p><strong>LRN:</strong> Not provided</p>
        <p><strong>Phone Number:</strong> Not provided</p>
        <p><strong>Address:</strong> Not provided</p>
        <p><strong>Total Points:</strong> 0</p>
      `;
      profileFullNameElement.textContent = 'No profile found';
      profileEmailElement.textContent = safe(user.email);
      if (pointsTotalElement) {
        pointsTotalElement.textContent = '0';
      }
      return;
    }

    const studentData = studentSnap.data();
    const points = normalizePoints(studentData.points);

    if (pointsTotalElement) {
      pointsTotalElement.textContent = String(points);
    }

    if (studentData.points === undefined) {
      await updateDoc(studentRef, { points: 0 });
    }

    renderProfile(studentData, user.email, points);
  } catch (error) {
    console.error('Failed to load profile:', error);
    profileDataElement.innerHTML = `
      <p><strong>Error:</strong> Failed to load profile data.</p>
    `;
    if (pointsTotalElement) {
      pointsTotalElement.textContent = '0';
    }
  }
});

logoutButton?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (error) {
    console.error('Logout failed:', error);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/cote-v1/sw.js', { scope: '/cote-v1/' })
      .catch((error) => console.error('SW registration failed:', error));
  });
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showPage = showPage;

showPage('home');
closeSidebar();
