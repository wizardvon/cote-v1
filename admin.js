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
  addDoc,
  serverTimestamp
} from './firebase.js';

const adminEmailElement = document.getElementById('admin-email');
const sidebarTeacherNameElement = document.getElementById('sidebar-teacher-name');
const logoutButton = document.getElementById('logout-button');

const pageTitleElement = document.getElementById('page-title');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const burgerButton = document.getElementById('burger-button');
const menuButtons = Array.from(document.querySelectorAll('.menu-btn'));
const pages = Array.from(document.querySelectorAll('.page'));

const sectionFilterElement = document.getElementById('section-filter');
const searchInput = document.getElementById('student-search');
const loadStudentsButton = document.getElementById('load-students-button');
const selectAllCheckbox = document.getElementById('select-all');
const tableBody = document.getElementById('students-table-body');
const pointsValueInput = document.getElementById('points-value');
const reasonInput = document.getElementById('reason-input');
const addPointsButton = document.getElementById('add-points-button');
const deductPointsButton = document.getElementById('deduct-points-button');
const messageElement = document.getElementById('admin-message');

const TABLE_COLUMN_COUNT = 8;

const pageTitles = {
  home: 'Home',
  'give-points': 'Give Points',
  scores: 'Scores',
  quest: 'Quest',
  resources: 'Resources'
};

let allStudents = [];
let visibleStudents = [];

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

function safeText(value, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function setMessage(message, type = '') {
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.remove('success', 'error');

  if (type) {
    messageElement.classList.add(type);
  }
}

function compareStudents(a, b) {
  const sectionCompare = safeText(a.section, '').localeCompare(safeText(b.section, ''), undefined, {
    sensitivity: 'base'
  });

  if (sectionCompare !== 0) {
    return sectionCompare;
  }

  const lastNameCompare = safeText(a.lastName, '').localeCompare(safeText(b.lastName, ''), undefined, {
    sensitivity: 'base'
  });

  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  return safeText(a.firstName, '').localeCompare(safeText(b.firstName, ''), undefined, {
    sensitivity: 'base'
  });
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
    pageTitleElement.textContent = pageTitles[pageName] || 'Teacher Dashboard';
  }

  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getSelectedStudentIds() {
  if (!tableBody) return [];

  return Array.from(tableBody.querySelectorAll('input[data-student-id]:checked')).map(
    (input) => input.dataset.studentId
  );
}

function updateSelectAllState() {
  if (!tableBody || !selectAllCheckbox) return;

  const checkboxes = Array.from(tableBody.querySelectorAll('input[data-student-id]'));

  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  selectAllCheckbox.checked = checkedCount > 0 && checkedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function renderTableRows() {
  if (!tableBody) return;

  if (visibleStudents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">No matching students found.</td>
      </tr>
    `;
    updateSelectAllState();
    return;
  }

  tableBody.innerHTML = visibleStudents
    .map((student) => {
      return `
        <tr>
          <td>
            <label class="sr-only" for="student-${student.id}">Select ${safeText(student.lastName)} ${safeText(
              student.firstName
            )}</label>
            <input id="student-${student.id}" type="checkbox" data-student-id="${student.id}" />
          </td>
          <td>${safeText(student.lastName)}</td>
          <td>${safeText(student.firstName)}</td>
          <td>${safeText(student.middleName)}</td>
          <td>${safeText(student.lrn)}</td>
          <td>${safeText(student.section)}</td>
          <td>${normalizePoints(student.points)}</td>
        </tr>
      `;
    })
    .join('');

  updateSelectAllState();
}

function getFilteredStudents() {
  if (!sectionFilterElement || !searchInput) return [];

  const selectedSection = sectionFilterElement.value;
  const keyword = searchInput.value.trim().toLowerCase();

  return allStudents.filter((student) => {
    const matchesSection = selectedSection === 'all' || safeText(student.section, '') === selectedSection;

    if (!matchesSection) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const fullName = `${safeText(student.lastName, '')} ${safeText(student.firstName, '')} ${safeText(
      student.middleName,
      ''
    )}`.toLowerCase();
    const lrn = safeText(student.lrn, '').toLowerCase();

    return fullName.includes(keyword) || lrn.includes(keyword);
  });
}

function applyFiltersAndRender(showStatusMessage = true) {
  visibleStudents = getFilteredStudents();
  renderTableRows();

  if (!showStatusMessage) {
    return;
  }

  if (visibleStudents.length === 0) {
    setMessage('No matching students found.', 'error');
    return;
  }

  setMessage(`Loaded ${visibleStudents.length} students.`, 'success');
}

function populateSectionFilter(students) {
  if (!sectionFilterElement) return;

  const sections = [...new Set(students.map((student) => safeText(student.section, '')).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  sectionFilterElement.innerHTML = '<option value="all">All Sections</option>';

  sections.forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.textContent = section;
    sectionFilterElement.append(option);
  });
}

async function loadStudents({ showStatusMessage = true } = {}) {
  if (!tableBody || !sectionFilterElement || !loadStudentsButton) return false;

  setMessage('Loading students...');

  loadStudentsButton.disabled = true;
  loadStudentsButton.textContent = 'Loading...';

  tableBody.innerHTML = `
    <tr>
      <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Loading students...</td>
    </tr>
  `;

  try {
    const studentsSnapshot = await getDocs(collection(db, 'students'));

    allStudents = studentsSnapshot.docs
      .map((studentDoc) => {
        const data = studentDoc.data();
        return {
          id: studentDoc.id,
          ...data,
          points: normalizePoints(data.points)
        };
      })
      .sort(compareStudents);

    const previousSection = sectionFilterElement.value;
    populateSectionFilter(allStudents);

    if (previousSection && previousSection !== 'all') {
      sectionFilterElement.value = Array.from(sectionFilterElement.options).some(
        (option) => option.value === previousSection
      )
        ? previousSection
        : 'all';
    }

    applyFiltersAndRender(false);

    if (showStatusMessage) {
      setMessage(`Loaded ${allStudents.length} students.`, 'success');
    }

    return true;
  } catch (error) {
    console.error('Failed to load students:', error);
    allStudents = [];
    visibleStudents = [];
    renderTableRows();
    const errorMessage = error instanceof Error ? error.message : String(error);
    setMessage(`Failed to load students: ${errorMessage}`, 'error');
    return false;
  } finally {
    loadStudentsButton.disabled = false;
    loadStudentsButton.textContent = 'Load Students';
  }
}

function parsePointValue() {
  if (!pointsValueInput) return null;

  const pointValue = Number(pointsValueInput.value);

  if (!Number.isFinite(pointValue) || pointValue <= 0 || !Number.isInteger(pointValue)) {
    return null;
  }

  return pointValue;
}

function parseReason() {
  const reason = String(reasonInput?.value || '').trim();

  if (!reason) {
    return null;
  }

  return reason;
}

async function updatePointsForSelected(action) {
  if (!addPointsButton || !deductPointsButton || !pointsValueInput || !reasonInput || !selectAllCheckbox) return;

  const selectedIds = getSelectedStudentIds();

  if (selectedIds.length === 0) {
    setMessage('Please select at least one student.', 'error');
    return;
  }

  const pointValue = parsePointValue();

  if (pointValue === null) {
    setMessage('Please enter a valid positive whole number for points.', 'error');
    return;
  }

  const reason = parseReason();

  if (!reason) {
    setMessage('A reason is required to log this point update.', 'error');
    return;
  }

  const delta = action === 'add' ? pointValue : -pointValue;
  const buttonLabel = action === 'add' ? 'Adding merit...' : 'Adding demerit...';

  addPointsButton.disabled = true;
  deductPointsButton.disabled = true;
  addPointsButton.textContent = action === 'add' ? buttonLabel : 'Add Merit Points';
  deductPointsButton.textContent = action === 'subtract' ? buttonLabel : 'Add Demerit Points';

  try {
    const teacherUid = auth.currentUser?.uid || '';
    let teacherName = 'Unknown Teacher';

    if (teacherUid) {
      const teacherRef = doc(db, 'teachers', teacherUid);
      const teacherSnap = await getDoc(teacherRef);

      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        teacherName = `${safeText(teacherData?.firstName, '')} ${safeText(teacherData?.lastName, '')}`
          .replace(/\s+/g, ' ')
          .trim() || 'Unknown Teacher';
      }
    }

    const updates = selectedIds.map(async (studentId) => {
      const studentRef = doc(db, 'students', studentId);
      const current = allStudents.find((student) => student.id === studentId);
      const currentPoints = normalizePoints(current?.points);

      await updateDoc(studentRef, { points: currentPoints + delta });

      await addDoc(collection(db, 'pointLogs'), {
        studentId,
        studentName: `${safeText(current?.firstName, '')} ${safeText(current?.middleName, '')} ${safeText(
          current?.lastName,
          ''
        )}`
          .replace(/\s+/g, ' ')
          .trim(),
        lrn: safeText(current?.lrn, ''),
        section: safeText(current?.section, ''),
        type: action === 'add' ? 'merit' : 'demerit',
        points: pointValue,
        reason,
        teacherId: teacherUid,
        teacherName,
        teacherEmail: auth.currentUser?.email || '',
        createdAt: serverTimestamp()
      });

      return { studentId, points: currentPoints + delta };
    });

    const results = await Promise.all(updates);

    const updatedMap = new Map(results.map((result) => [result.studentId, result.points]));
    allStudents = allStudents.map((student) => {
      if (!updatedMap.has(student.id)) {
        return student;
      }

      return {
        ...student,
        points: normalizePoints(updatedMap.get(student.id))
      };
    });

    const reloadSucceeded = await loadStudents({ showStatusMessage: false });

    if (!reloadSucceeded) {
      return;
    }

    pointsValueInput.value = '';
    reasonInput.value = '';
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;

    const actionLabel = action === 'add' ? 'Merit points added' : 'Demerit points added';
    setMessage(`${actionLabel} for ${results.length} student(s).`, 'success');
  } catch (error) {
    console.error('Failed to update selected students:', error);
    setMessage('Could not update points for selected students. Please try again.', 'error');
  } finally {
    addPointsButton.disabled = false;
    deductPointsButton.disabled = false;
    addPointsButton.textContent = 'Add Merit Points';
    deductPointsButton.textContent = 'Add Demerit Points';
  }
}

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetPage = button.dataset.target;

    if (!targetPage) return;

    showPage(targetPage);
  });
});

burgerButton?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

loadStudentsButton?.addEventListener('click', () => {
  loadStudents();
});

sectionFilterElement?.addEventListener('change', () => {
  if (!allStudents.length) return;
  applyFiltersAndRender(false);
});

searchInput?.addEventListener('input', () => {
  if (!allStudents.length) return;
  applyFiltersAndRender(false);
});

selectAllCheckbox?.addEventListener('change', () => {
  if (!tableBody || !selectAllCheckbox) return;

  const checkboxes = tableBody.querySelectorAll('input[data-student-id]');

  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
  });

  updateSelectAllState();
});

tableBody?.addEventListener('change', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.matches('input[data-student-id]')) {
    updateSelectAllState();
  }
});

pointsValueInput?.addEventListener('input', () => {
  if (!pointsValueInput) return;

  const value = Number(pointsValueInput.value);

  if (Number.isFinite(value) && value < 0) {
    pointsValueInput.value = '';
  }
});

addPointsButton?.addEventListener('click', () => {
  updatePointsForSelected('add');
});

deductPointsButton?.addEventListener('click', () => {
  updatePointsForSelected('subtract');
});

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
      window.location.replace('dashboard.html');
      return;
    }

    const userData = userSnap.data();
    const role = String(userData.role || '').trim();

    if (role !== 'teacher') {
      window.location.replace('dashboard.html');
      return;
    }

    const displayEmail = userData.email || user.email || 'No email available';
    const displayName = `${safeText(userData.firstName, '')} ${safeText(userData.lastName, '')}`.replace(/\s+/g, ' ').trim();

    if (adminEmailElement) {
      adminEmailElement.textContent = displayEmail;
    }

    if (sidebarTeacherNameElement) {
      sidebarTeacherNameElement.textContent = displayName || 'Teacher Panel';
    }

    setMessage('Teacher access granted. Open Give Points and click "Load Students".', 'success');

    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Click "Load Students" to fetch and display students.</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Failed to validate teacher role:', error);
    window.location.replace('dashboard.html');
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/cote-v1/sw.js', { scope: '/cote-v1/' }).catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
