import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from './firebase.js';

const adminEmailElement = document.getElementById('admin-email');
const logoutButton = document.getElementById('logout-button');
const sectionFilterElement = document.getElementById('section-filter');
const searchInput = document.getElementById('student-search');
const loadStudentsButton = document.getElementById('load-students-button');
const selectAllCheckbox = document.getElementById('select-all');
const tableBody = document.getElementById('students-table-body');
const pointsValueInput = document.getElementById('points-value');
const addPointsButton = document.getElementById('add-points-button');
const deductPointsButton = document.getElementById('deduct-points-button');
const messageElement = document.getElementById('admin-message');
const TABLE_COLUMN_COUNT = 8;

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

function getSelectedStudentIds() {
  return Array.from(tableBody.querySelectorAll('input[data-student-id]:checked')).map(
    (input) => input.dataset.studentId
  );
}

function updateSelectAllState() {
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
  setMessage('Loading students...');

  if (loadStudentsButton) {
    loadStudentsButton.disabled = true;
    loadStudentsButton.textContent = 'Loading...';
  }

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
    if (loadStudentsButton) {
      loadStudentsButton.disabled = false;
      loadStudentsButton.textContent = 'Load Students';
    }
  }
}

function parsePointValue() {
  const pointValue = Number(pointsValueInput.value);

  if (!Number.isFinite(pointValue) || pointValue <= 0 || !Number.isInteger(pointValue)) {
    return null;
  }

  return pointValue;
}

async function updatePointsForSelected(action) {
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

  const delta = action === 'add' ? pointValue : -pointValue;
  const buttonLabel = action === 'add' ? 'Adding merit...' : 'Adding demerit...';

  addPointsButton.disabled = true;
  deductPointsButton.disabled = true;
  addPointsButton.textContent = action === 'add' ? buttonLabel : 'Add Merit Points';
  deductPointsButton.textContent = action === 'subtract' ? buttonLabel : 'Add Demerit Points';

  try {
    const updates = selectedIds.map(async (studentId) => {
      const studentRef = doc(db, 'students', studentId);
      const current = allStudents.find((student) => student.id === studentId);
      const currentPoints = normalizePoints(current?.points);

      await updateDoc(studentRef, { points: currentPoints + delta });

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

    adminEmailElement.textContent = userData.email || user.email || 'No email available';
    setMessage('Teacher access granted. Choose filters, then click "Load Students".', 'success');

    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Click "Load Students" to fetch and display students.</td>
      </tr>
    `;
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
