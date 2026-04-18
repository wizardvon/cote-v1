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
  limit,
  query,
  where
} from './firebase.js';


const adminEmailElement = document.getElementById('admin-email');
const logoutButton = document.getElementById('logout-button');
const searchInput = document.getElementById('student-search');
const loadStudentButton = document.getElementById('load-student-button');
const pointsValueInput = document.getElementById('points-value');
const addPointsButton = document.getElementById('add-points-button');
const deductPointsButton = document.getElementById('deduct-points-button');
const messageElement = document.getElementById('admin-message');
const studentDetailsElement = document.getElementById('student-details');

let loadedStudent = null;

function safeText(value, fallback = 'Not provided') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatName(data) {
  return [data.firstName, data.middleName, data.lastName]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ') || 'Not provided';
}

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

function setMessage(message, type = '') {
  messageElement.textContent = message;
  messageElement.classList.remove('success', 'error');

  if (type) {
    messageElement.classList.add(type);
  }
}

function renderStudentDetails(student) {
  if (!student) {
    studentDetailsElement.innerHTML = `
      <p><strong>Name:</strong> Not loaded</p>
      <p><strong>Email:</strong> Not loaded</p>
      <p><strong>LRN:</strong> Not loaded</p>
      <p><strong>Current Points:</strong> 0</p>
    `;
    return;
  }

  studentDetailsElement.innerHTML = `
    <p><strong>Name:</strong> ${safeText(formatName(student.data))}</p>
    <p><strong>Email:</strong> ${safeText(student.data.email)}</p>
    <p><strong>LRN:</strong> ${safeText(student.data.lrn)}</p>
    <p><strong>Current Points:</strong> ${normalizePoints(student.data.points)}</p>
  `;
}

function setPointActionEnabled(enabled) {
  addPointsButton.disabled = !enabled;
  deductPointsButton.disabled = !enabled;
}

async function findStudentByInput(rawValue) {
  const value = String(rawValue || '').trim();

  if (!value) {
    return null;
  }

  const studentsRef = collection(db, 'students');

  if (value.includes('@')) {
    const byEmailQuery = query(studentsRef, where('email', '==', value.toLowerCase()), limit(1));
    const byEmailSnap = await getDocs(byEmailQuery);

    if (!byEmailSnap.empty) {
      const foundDoc = byEmailSnap.docs[0];
      return { id: foundDoc.id, data: foundDoc.data() };
    }

    return null;
  }

  const byLrnQuery = query(studentsRef, where('lrn', '==', value), limit(1));
  const byLrnSnap = await getDocs(byLrnQuery);

  if (byLrnSnap.empty) {
    return null;
  }

  const foundDoc = byLrnSnap.docs[0];
  return { id: foundDoc.id, data: foundDoc.data() };
}

async function loadStudent() {
  const value = searchInput.value;

  if (!value.trim()) {
    setMessage('Please enter a student email or LRN first.', 'error');
    return;
  }

  loadStudentButton.disabled = true;
  loadStudentButton.textContent = 'Loading...';

  try {
    const student = await findStudentByInput(value);

    if (!student) {
      loadedStudent = null;
      renderStudentDetails(null);
      setPointActionEnabled(false);
      setMessage('No matching student found.', 'error');
      return;
    }

    loadedStudent = {
      id: student.id,
      data: {
        ...student.data,
        points: normalizePoints(student.data.points)
      }
    };

    if (student.data.points === undefined) {
      await updateDoc(doc(db, 'students', student.id), { points: 0 });
    }

    renderStudentDetails(loadedStudent);
    setPointActionEnabled(true);
    setMessage('Student loaded successfully.', 'success');
  } catch (error) {
    console.error('Error while loading student:', error);
    setMessage('Failed to load student. Please try again.', 'error');
  } finally {
    loadStudentButton.disabled = false;
    loadStudentButton.textContent = 'Load Student';
  }
}

async function updatePoints(action) {
  if (!loadedStudent) {
    setMessage('Load a student before updating points.', 'error');
    return;
  }

  const pointValue = Number(pointsValueInput.value);

  if (!Number.isFinite(pointValue) || pointValue <= 0) {
    setMessage('Enter a valid positive points value.', 'error');
    return;
  }

  const delta = action === 'add' ? pointValue : -pointValue;
  const studentRef = doc(db, 'students', loadedStudent.id);
  const updatedPoints = normalizePoints(loadedStudent.data.points) + delta;

  addPointsButton.disabled = true;
  deductPointsButton.disabled = true;

  try {
    await updateDoc(studentRef, { points: updatedPoints });

    const refreshedSnap = await getDoc(studentRef);

    if (!refreshedSnap.exists()) {
      setMessage('Student no longer exists.', 'error');
      loadedStudent = null;
      renderStudentDetails(null);
      return;
    }

    loadedStudent = {
      id: refreshedSnap.id,
      data: {
        ...refreshedSnap.data(),
        points: normalizePoints(refreshedSnap.data().points)
      }
    };

    renderStudentDetails(loadedStudent);
    pointsValueInput.value = '';
    setMessage('Points updated successfully.', 'success');
  } catch (error) {
    console.error('Failed to update points:', error);
    setMessage('Could not update points. Please try again.', 'error');
  } finally {
    setPointActionEnabled(Boolean(loadedStudent));
  }
}

loadStudentButton?.addEventListener('click', loadStudent);

addPointsButton?.addEventListener('click', () => {
  updatePoints('add');
});

deductPointsButton?.addEventListener('click', () => {
  updatePoints('deduct');
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

    adminEmailElement.textContent = user.email || userData.email || 'No email available';
    setMessage('Admin access granted. Load a student to manage points.', 'success');
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
