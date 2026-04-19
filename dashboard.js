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
const profileGradeSectionElement = document.getElementById('profile-grade-section');
const profileAvatarElement = document.getElementById('profile-avatar');
const sidebarStudentNameElement = document.getElementById('sidebar-student-name');
const sidebarStudentEmailElement = document.getElementById('sidebar-student-email');
const pointsTotalElement = document.getElementById('points-total');
const logoutButton = document.getElementById('logout-button');
const pageTitleElement = document.getElementById('page-title');
const notificationsButton = document.getElementById('notifications-button');
const messagesButton = document.getElementById('messages-button');

const homeStudentNameElement = document.getElementById('home-student-name');
const homeStudentSectionElement = document.getElementById('home-student-section');
const homeStudentPointsElement = document.getElementById('home-student-points');

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

function makeFullName(data) {
  return [data.firstName, data.middleName, data.lastName]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ') || 'Not provided';
}

function makeGradeSection(data) {
  const grade = (data.gradeLevel || '').trim();
  const section = (data.section || '').trim();

  if (grade && section) return `${grade} • ${section}`;
  if (grade) return grade;
  if (section) return section;
  return 'Not provided';
}

function makeInitials(data) {
  const first = (data.firstName || '').trim().charAt(0);
  const last = (data.lastName || '').trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || '👤';
}

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setStudentData(data, fallbackEmail = '') {
  const displayName = safe(makeFullName(data));
  const displayEmail = safe(data.email || fallbackEmail);
  const displayGradeSection = makeGradeSection(data);
  const points = normalizePoints(data.points);

  if (sidebarStudentNameElement) {
    sidebarStudentNameElement.textContent = displayName;
  }

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = displayEmail;
  }

  if (profileFullNameElement) {
    profileFullNameElement.textContent = displayName;
  }

  if (profileEmailElement) {
    profileEmailElement.textContent = displayEmail;
  }

  if (profileGradeSectionElement) {
    profileGradeSectionElement.textContent = displayGradeSection;
  }

  if (profileAvatarElement) {
    profileAvatarElement.textContent = makeInitials(data);
  }

  if (pointsTotalElement) {
    pointsTotalElement.textContent = String(points);
  }

  if (homeStudentNameElement) {
    homeStudentNameElement.textContent = displayName;
  }

  if (homeStudentSectionElement) {
    homeStudentSectionElement.textContent = displayGradeSection;
  }

  if (homeStudentPointsElement) {
    homeStudentPointsElement.textContent = String(points);
  }

  if (profileDataElement) {
    profileDataElement.innerHTML = `
      <p><strong>Full Name:</strong> ${displayName}</p>
      <p><strong>Email:</strong> ${displayEmail}</p>
      <p><strong>Sex:</strong> ${safe(data.sex)}</p>
      <p><strong>Birthday:</strong> ${safe(data.birthday)}</p>
      <p><strong>LRN:</strong> ${safe(data.lrn)}</p>
      <p><strong>Phone Number:</strong> ${safe(data.phoneNumber)}</p>
      <p><strong>Address:</strong> ${safe(data.address)}</p>
      <p><strong>Grade Level:</strong> ${safe(data.gradeLevel)}</p>
      <p><strong>Section:</strong> ${safe(data.section)}</p>
      <p><strong>Total Points:</strong> ${points}</p>
    `;
  }
}

function renderNoProfile(email = '') {
  const fallback = safe(email);

  if (sidebarStudentNameElement) {
    sidebarStudentNameElement.textContent = 'No profile found';
  }

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = fallback;
  }

  if (profileFullNameElement) {
    profileFullNameElement.textContent = 'No profile found';
  }

  if (profileEmailElement) {
    profileEmailElement.textContent = fallback;
  }

  if (profileGradeSectionElement) {
    profileGradeSectionElement.textContent = 'Not provided';
  }

  if (profileAvatarElement) {
    profileAvatarElement.textContent = '👤';
  }

  if (pointsTotalElement) {
    pointsTotalElement.textContent = '0';
  }

  if (homeStudentNameElement) {
    homeStudentNameElement.textContent = 'No profile found';
  }

  if (homeStudentSectionElement) {
    homeStudentSectionElement.textContent = 'Not provided';
  }

  if (homeStudentPointsElement) {
    homeStudentPointsElement.textContent = '0';
  }

  if (profileDataElement) {
    profileDataElement.innerHTML = `
      <p><strong>Full Name:</strong> No profile found</p>
      <p><strong>Email:</strong> ${fallback}</p>
      <p><strong>Sex:</strong> Not provided</p>
      <p><strong>Birthday:</strong> Not provided</p>
      <p><strong>LRN:</strong> Not provided</p>
      <p><strong>Phone Number:</strong> Not provided</p>
      <p><strong>Address:</strong> Not provided</p>
      <p><strong>Grade Level:</strong> Not provided</p>
      <p><strong>Section:</strong> Not provided</p>
      <p><strong>Total Points:</strong> 0</p>
    `;
  }
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

notificationsButton?.addEventListener('click', () => {
  alert('Notifications feature will be added here.');
});

messagesButton?.addEventListener('click', () => {
  alert('Messages or chat feature will be added here.');
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
      renderNoProfile(user.email);
      return;
    }

    const studentData = studentSnap.data();
    const points = normalizePoints(studentData.points);

    if (studentData.points === undefined) {
      await updateDoc(studentRef, { points: 0 });
      studentData.points = 0;
    } else {
      studentData.points = points;
    }

    setStudentData(studentData, user.email);
  } catch (error) {
    console.error('Failed to load profile:', error);

    if (profileDataElement) {
      profileDataElement.innerHTML = `
        <p><strong>Error:</strong> Failed to load profile data.</p>
      `;
    }

    if (profileFullNameElement) {
      profileFullNameElement.textContent = 'Failed to load';
    }

    if (profileEmailElement) {
      profileEmailElement.textContent = safe(user?.email);
    }

    if (profileGradeSectionElement) {
      profileGradeSectionElement.textContent = 'Not available';
    }

    if (profileAvatarElement) {
      profileAvatarElement.textContent = '👤';
    }

    if (pointsTotalElement) {
      pointsTotalElement.textContent = '0';
    }

    if (homeStudentNameElement) {
      homeStudentNameElement.textContent = 'Failed to load';
    }

    if (homeStudentSectionElement) {
      homeStudentSectionElement.textContent = 'Not available';
    }

    if (homeStudentPointsElement) {
      homeStudentPointsElement.textContent = '0';
    }
  }
});

logoutButton?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (error) {
    console.error('Logout failed:', error);
    alert('Logout failed.');
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
