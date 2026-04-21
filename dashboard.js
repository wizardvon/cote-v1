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
  where,
  orderBy,
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
const leaderboardListElement = document.getElementById('leaderboard-list');
const profileRankElement = document.getElementById('profile-rank');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const burgerButton = document.getElementById('burger-button');

const menuButtons = Array.from(document.querySelectorAll('.menu-btn'));
const pages = Array.from(document.querySelectorAll('.page'));
const recordsPageElement = document.getElementById('page-records');
const studentScoresListElement = document.getElementById('student-scores-list');
const loadingOverlay = document.getElementById('loadingOverlay');
let overlaySequenceJob = 0;

const pageTitles = {
  home: 'Home',
  profile: 'Profile',
  records: 'Records',
  resources: 'Resources',
  quest: 'Quest',
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
    loadingTextElement.classList.remove('is-switching');
    void loadingTextElement.offsetWidth;
    loadingTextElement.classList.add('is-switching');
    setTimeout(() => loadingTextElement.classList.remove('is-switching'), 360);
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return;

  overlaySequenceJob += 1;
  loadingOverlay.classList.add('loading-overlay-fade-out');
  loadingOverlay.classList.remove('loading-overlay-visible');
  loadingOverlay.setAttribute('aria-hidden', 'true');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playLoadingSequence(messages, interval = 430) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  const job = ++overlaySequenceJob;
  for (const message of messages) {
    if (job !== overlaySequenceJob) return;
    updateLoadingText(message);
    await wait(interval);
  }
}

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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function makeLeaderboardName(data) {
  return [data.firstName, data.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

async function loadLeaderboard() {
  if (!leaderboardListElement) return;

  leaderboardListElement.innerHTML = '<p>Loading leaderboard...</p>';
  if (profileRankElement) {
    profileRankElement.textContent = 'Loading...';
  }

  try {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map((studentDoc) => {
      const student = studentDoc.data();
      return {
        id: studentDoc.id,
        firstName: String(student.firstName || '').trim(),
        lastName: String(student.lastName || '').trim(),
        gradeLevel: String(student.gradeLevel || '').trim(),
        section: String(student.section || '').trim(),
        points: normalizePoints(student.points),
      };
    });

    students.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      const lastNameCompare = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' });
      if (lastNameCompare !== 0) return lastNameCompare;

      return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
    });

    const topStudents = students.slice(0, 10);
    const currentStudentId = auth.currentUser?.uid;
    const currentStudentIndex = students.findIndex((student) => student.id === currentStudentId);

    if (profileRankElement) {
      if (currentStudentIndex >= 0) {
        const rank = currentStudentIndex + 1;
        const total = students.length;
        profileRankElement.textContent = `#${rank} of ${total}`;
      } else {
        profileRankElement.textContent = 'Not ranked';
      }
    }

    if (!topStudents.length) {
      leaderboardListElement.innerHTML = '<p>No leaderboard data available yet.</p>';
      return;
    }

    leaderboardListElement.innerHTML = topStudents
      .map((student, index) => {
        const fullName = makeLeaderboardName(student) || 'Unnamed Student';
        const gradeLevel = student.gradeLevel || 'Not provided';
        const section = student.section || 'Not provided';
        return `<p>#${index + 1} ${escapeHtml(fullName)} — ${escapeHtml(
          gradeLevel
        )} - ${escapeHtml(section)} — ${student.points} pts</p>`;
      })
      .join('');
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    leaderboardListElement.innerHTML = '<p>No leaderboard data available yet.</p>';
    if (profileRankElement) {
      profileRankElement.textContent = 'Not ranked';
    }
  }
}

function formatTimestamp(value) {
  if (!value?.toDate) return 'Date unavailable';

  const date = value.toDate();
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function loadStudentScores(studentId) {
  if (!studentScoresListElement) return;

  studentScoresListElement.innerHTML = '<li>Loading scores...</li>';

  try {
    let scoresSnapshot;

    try {
      const scoresQuery = query(
        collection(db, 'scores'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      scoresSnapshot = await getDocs(scoresQuery);
    } catch (error) {
      console.error('Failed to query scores with index:', error);
      const fallbackSnapshot = await getDocs(collection(db, 'scores'));
      const filteredDocs = fallbackSnapshot.docs
        .filter((scoreDoc) => scoreDoc.data().studentId === studentId)
        .sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis?.() || 0;
          const bTime = b.data().createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      scoresSnapshot = { empty: filteredDocs.length === 0, docs: filteredDocs };
    }

    if (scoresSnapshot.empty) {
      studentScoresListElement.innerHTML = '<li>No scores available yet.</li>';
      return;
    }

    studentScoresListElement.innerHTML = scoresSnapshot.docs
      .map((scoreDoc) => {
        const score = scoreDoc.data();
        const type = escapeHtml(String(score.type || 'Not set'));
        const title = escapeHtml(String(score.title || 'Untitled Activity'));
        const scoreValue = Number.isFinite(Number(score.score)) ? Number(score.score) : 0;
        const maxScore = Number.isFinite(Number(score.maxScore)) ? Number(score.maxScore) : 0;
        const teacherName = escapeHtml(String(score.teacherName || score.teacherEmail || 'Unknown Teacher'));
        const date = escapeHtml(formatTimestamp(score.createdAt));

        return `<li><strong>${type}</strong> — ${title}<br>${scoreValue}/${maxScore}<br><strong>Teacher:</strong> ${teacherName}<br><strong>Date:</strong> ${date}</li>`;
      })
      .join('');
  } catch (error) {
    console.error('Failed to load scores:', error);
    studentScoresListElement.innerHTML = '<li>Unable to load scores. Please try again later.</li>';
  }
}

function getRecordsListElement() {
  if (!recordsPageElement) return null;

  const pointsHistoryCard = recordsPageElement.querySelector('.app-card');
  if (!pointsHistoryCard) return null;

  let listElement = pointsHistoryCard.querySelector('#point-logs-list');

  if (!listElement) {
    listElement = document.createElement('ul');
    listElement.id = 'point-logs-list';
    listElement.className = 'list-stack';
    pointsHistoryCard.appendChild(listElement);
  }

  return listElement;
}

async function loadPointLogs(studentId) {
  const listElement = getRecordsListElement();
  if (!listElement) return;

  listElement.innerHTML = '<li>Loading point logs...</li>';

  try {
    let logsSnapshot;

    try {
      const logsQuery = query(
        collection(db, 'pointLogs'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      logsSnapshot = await getDocs(logsQuery);
    } catch (error) {
      console.error('Failed to query point logs with index:', error);
      const message = String(error?.message || error).toLowerCase();

      if (message.includes('index')) {
        console.log('Create Firestore index for pointLogs query');
      }

      const fallbackSnapshot = await getDocs(collection(db, 'pointLogs'));
      const filteredDocs = fallbackSnapshot.docs
        .filter((logDoc) => logDoc.data().studentId === studentId)
        .sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis?.() || 0;
          const bTime = b.data().createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      logsSnapshot = { empty: filteredDocs.length === 0, docs: filteredDocs };
    }

    if (logsSnapshot.empty) {
      listElement.innerHTML = '<li>No point logs available yet.</li>';
      return;
    }

   listElement.innerHTML = logsSnapshot.docs
  .map((logDoc) => {
    const log = logDoc.data();
    const points = normalizePoints(log.points);
    const sign = log.type === 'demerit' ? '-' : '+';
    const label = log.type === 'demerit' ? 'Demerit' : 'Merit';
    const reason = String(log.reason || 'No reason provided').trim() || 'No reason provided';
    const teacherName =
      String(log.teacherName || '').trim() ||
      String(log.teacherEmail || '').trim() ||
      'Unknown Teacher';

    return `<li>${sign}${points} ${label} — ${reason}<br><strong>Teacher:</strong> ${teacherName}</li>`;
  })
  .join('');
  } catch (error) {
    console.error('Failed to load point logs:', error);
    const message = String(error?.message || error).toLowerCase();
    if (message.includes('index')) {
      console.log('Create Firestore index for pointLogs query');
    }
    listElement.innerHTML = '<li>Unable to load logs. Please try again later.</li>';
  }
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

  if (profileRankElement) {
    profileRankElement.textContent = 'Not ranked';
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

  loadLeaderboard();

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
    loadPointLogs(user.uid);
    loadStudentScores(user.uid);
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

    if (profileRankElement) {
      profileRankElement.textContent = 'Not ranked';
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

window.addEventListener('load', () => {
  showLoadingOverlay('Initializing C.O.T.E System...');
  playLoadingSequence(['Initializing C.O.T.E System...', 'Loading Profile...', 'Syncing Records...'], 380).then(
    async () => {
      await wait(190);
      hideLoadingOverlay();
    }
  );
});

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showPage = showPage;

showPage('home');
closeSidebar();
