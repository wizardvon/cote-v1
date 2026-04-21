import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where
} from './firebase.js';

const superAdminEmailElement = document.getElementById('super-admin-email');
const sidebarSuperAdminNameElement = document.getElementById('sidebar-super-admin-name');
const logoutButton = document.getElementById('logout-button');
const pageTitleElement = document.getElementById('page-title');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const burgerButton = document.getElementById('burger-button');
const menuButtons = Array.from(document.querySelectorAll('.menu-btn'));
const pages = Array.from(document.querySelectorAll('.page'));
const loadingOverlay = document.getElementById('loadingOverlay');
const pendingTeachersListElement = document.getElementById('pending-teachers-list');
const activeTeachersListElement = document.getElementById('active-teachers-list');
const pendingCountElement = document.getElementById('pending-count');
const activeCountElement = document.getElementById('active-count');
const messageElement = document.getElementById('super-admin-message');

const pageTitles = {
  home: 'Home',
  'teacher-approvals': 'Teacher Approvals',
  'active-teachers': 'Active Teachers'
};

function showLoadingOverlay(text = 'Initializing C.O.T.E System...') {
  if (!loadingOverlay) return;

  loadingOverlay.classList.remove('loading-overlay-fade-out');
  updateLoadingText(text);

  loadingOverlay.classList.add('loading-overlay-visible');
  loadingOverlay.setAttribute('aria-hidden', 'false');
}

function updateLoadingText(text) {
  if (!loadingOverlay) return;

  const loadingTextElement = loadingOverlay.querySelector('.loading-text');
  if (loadingTextElement) {
    loadingTextElement.textContent = text;
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return;

  loadingOverlay.classList.add('loading-overlay-fade-out');
  loadingOverlay.classList.remove('loading-overlay-visible');
  loadingOverlay.setAttribute('aria-hidden', 'true');
}

function setMessage(message, type = '') {
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.classList.remove('success', 'error');
  if (type) {
    messageElement.classList.add(type);
  }
}

function safeText(value, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function makeFullName(teacher, user) {
  const firstName = safeText(teacher?.firstName || user?.firstName, '').trim();
  const middleName = safeText(teacher?.middleName || user?.middleName, '').trim();
  const lastName = safeText(teacher?.lastName || user?.lastName, '').trim();

  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.join(' ') || 'No name provided';
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
    pageTitleElement.textContent = pageTitles[pageName] || 'Super Admin Dashboard';
  }

  closeSidebar();
}

function renderPendingTeachers(records) {
  if (!pendingTeachersListElement) return;

  if (!records.length) {
    pendingTeachersListElement.innerHTML = '<p class="empty-cell">No pending teachers at the moment.</p>';
    return;
  }

  pendingTeachersListElement.innerHTML = records
    .map((record) => {
      return `
      <article class="app-card super-admin-item">
        <p><strong>Full Name:</strong> ${safeText(record.fullName)}</p>
        <p><strong>Email:</strong> ${safeText(record.email)}</p>
        <p><strong>Status:</strong> <span class="status-pill status-pending">${safeText(record.status)}</span></p>
        <button type="button" class="approve-button" data-teacher-id="${record.uid}">Approve</button>
      </article>
    `;
    })
    .join('');
}

function renderActiveTeachers(records) {
  if (!activeTeachersListElement) return;

  if (!records.length) {
    activeTeachersListElement.innerHTML = '<p class="empty-cell">No active teachers found.</p>';
    return;
  }

  activeTeachersListElement.innerHTML = records
    .map((record) => {
      return `
      <article class="app-card super-admin-item">
        <p><strong>Full Name:</strong> ${safeText(record.fullName)}</p>
        <p><strong>Email:</strong> ${safeText(record.email)}</p>
        <p><strong>Status:</strong> <span class="status-pill status-active">${safeText(record.status)}</span></p>
      </article>
    `;
    })
    .join('');
}

async function loadTeacherRecordsByStatus(status) {
  const usersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'), where('status', '==', status));
  const [usersSnapshot, teachersSnapshot] = await Promise.all([
    getDocs(usersQuery),
    getDocs(collection(db, 'teachers'))
  ]);

  const teacherMap = new Map();
  teachersSnapshot.forEach((teacherDoc) => {
    teacherMap.set(teacherDoc.id, teacherDoc.data());
  });

  const records = usersSnapshot.docs.map((userDoc) => {
    const userData = userDoc.data();
    const teacherData = teacherMap.get(userDoc.id) || {};

    return {
      uid: userDoc.id,
      fullName: makeFullName(teacherData, userData),
      email: safeText(userData.email || teacherData.email),
      status: safeText(userData.status)
    };
  });

  records.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
  return records;
}

async function refreshTeacherViews() {
  try {
    const [pendingTeachers, activeTeachers] = await Promise.all([
      loadTeacherRecordsByStatus('pending'),
      loadTeacherRecordsByStatus('active')
    ]);

    renderPendingTeachers(pendingTeachers);
    renderActiveTeachers(activeTeachers);

    if (pendingCountElement) {
      pendingCountElement.textContent = String(pendingTeachers.length);
    }

    if (activeCountElement) {
      activeCountElement.textContent = String(activeTeachers.length);
    }
  } catch (error) {
    console.error('Failed to load teacher lists:', error);
    setMessage('Unable to load teacher lists right now.', 'error');
  }
}

pendingTeachersListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.matches('.approve-button')) {
    return;
  }

  const teacherId = target.dataset.teacherId;

  if (!teacherId) {
    return;
  }

  target.disabled = true;
  target.textContent = 'Approving...';

  try {
    await Promise.all([
      updateDoc(doc(db, 'users', teacherId), { status: 'active' }),
      updateDoc(doc(db, 'teachers', teacherId), { status: 'active' })
    ]);

    setMessage('Teacher approved successfully.', 'success');
    await refreshTeacherViews();
  } catch (error) {
    console.error('Failed to approve teacher:', error);
    setMessage('Failed to approve teacher. Please try again.', 'error');
    target.disabled = false;
    target.textContent = 'Approve';
  }
});

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetPage = button.dataset.target;
    if (!targetPage) return;
    showPage(targetPage);
  });
});

burgerButton?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

logoutButton?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (error) {
    console.error('Logout failed:', error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      window.location.replace('index.html');
      return;
    }

    const userData = userSnap.data();
    const role = String(userData.role || '').trim();

    if (role !== 'superAdmin') {
      window.location.replace('dashboard.html');
      return;
    }

    if (superAdminEmailElement) {
      superAdminEmailElement.textContent = safeText(userData.email || user.email, 'No email available');
    }

    if (sidebarSuperAdminNameElement) {
      sidebarSuperAdminNameElement.textContent = makeFullName({}, userData) || 'Super Admin';
    }

    await refreshTeacherViews();
  } catch (error) {
    console.error('Failed to validate super admin role:', error);
    window.location.replace('index.html');
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

window.addEventListener('load', () => {
  showLoadingOverlay('Initializing System...');
  setTimeout(() => updateLoadingText('Loading Admin Controls...'), 320);
  setTimeout(() => hideLoadingOverlay(), 780);
});
