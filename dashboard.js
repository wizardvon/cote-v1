import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
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
const availableClassesListElement = document.getElementById('available-classes-list');
const myEnrollmentsListElement = document.getElementById('my-enrollments-list');
const myClassesFeedbackElement = document.getElementById('my-classes-feedback');
const loadingOverlay = document.getElementById('loadingOverlay');
let overlaySequenceJob = 0;
let currentStudentProfile = null;
let currentStudentUser = null;
let enrolledClassIds = new Set();
const teacherNameCache = new Map();

const pageTitles = {
  home: 'Home',
  profile: 'Profile',
  records: 'Records',
  'my-classes': 'My Classes',
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

function normalizeNumericValue(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function buildTeacherFullName(data) {
  return [data?.firstName, data?.middleName, data?.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPercentage(value) {
  const normalized = normalizeNumericValue(value, Number.NaN);
  if (!Number.isFinite(normalized)) return '';
  return Number.isInteger(normalized) ? String(normalized) : String(normalized.toFixed(2)).replace(/\.?0+$/, '');
}

async function resolveTeacherName(log = {}) {
  const teacherId = String(log.teacherId || '').trim();
  const existingTeacherName = String(log.teacherName || '').trim();
  const hasPlaceholderName = !existingTeacherName || existingTeacherName.toLowerCase() === 'teacher panel';

  if (!hasPlaceholderName) {
    return existingTeacherName;
  }

  if (!teacherId) {
    return 'Unknown Teacher';
  }

  if (teacherNameCache.has(teacherId)) {
    return teacherNameCache.get(teacherId);
  }

  try {
    const teacherSnap = await getDoc(doc(db, 'teachers', teacherId));
    if (teacherSnap.exists()) {
      const fullName = buildTeacherFullName(teacherSnap.data() || {});
      if (fullName) {
        teacherNameCache.set(teacherId, fullName);
        return fullName;
      }
    }
  } catch (error) {
    console.error('Failed to resolve teacher name:', error);
  }

  teacherNameCache.set(teacherId, 'Unknown Teacher');
  return 'Unknown Teacher';
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

function showMyClassesFeedback(message, type = 'success') {
  if (!myClassesFeedbackElement) return;

  const color = type === 'error' ? '#fca5a5' : '#86efac';
  const background = type === 'error' ? 'rgba(127, 29, 29, 0.35)' : 'rgba(20, 83, 45, 0.35)';
  myClassesFeedbackElement.innerHTML = `
    <p style="margin: 0 0 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${color}; background: ${background};">
      ${escapeHtml(message)}
    </p>
  `;
}

function clearMyClassesFeedback() {
  if (myClassesFeedbackElement) {
    myClassesFeedbackElement.innerHTML = '';
  }
}

function isClassActive(classData) {
  const status = String(classData.status || '').trim().toLowerCase();
  if (!status) return true;
  return status === 'active' || status === 'open';
}

function getTeacherName(classData) {
  return (
    String(classData.teacherName || '').trim() ||
    String(classData.teacherFullName || '').trim() ||
    String(classData.teacherEmail || '').trim() ||
    'Not assigned'
  );
}

function renderMyEnrollments(enrollments) {
  if (!myEnrollmentsListElement) return;

  if (!enrollments.length) {
    myEnrollmentsListElement.innerHTML = '<p>No class enrollments yet.</p>';
    return;
  }

  myEnrollmentsListElement.innerHTML = enrollments
    .map((enrollment) => {
      const classData = enrollment.classData || {};
      const subjectName = classData.subjectName || enrollment.subjectName || 'Unknown Subject';
      const sectionName = classData.sectionName || enrollment.sectionName || 'Not provided';
      const schoolYear = classData.schoolYearName || enrollment.schoolYearName || 'Not provided';
      const term = classData.termName || enrollment.termName || 'Not provided';
      const teacherName =
        classData.teacherName ||
        enrollment.teacherName ||
        classData.teacherEmail ||
        'Not assigned';
      const status = String(enrollment.status || 'pending').toLowerCase();
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);

      return `
        <article class="app-card">
          <p><strong>Subject:</strong> ${escapeHtml(subjectName)}</p>
          <p><strong>Section:</strong> ${escapeHtml(sectionName)}</p>
          <p><strong>School Year:</strong> ${escapeHtml(schoolYear)}</p>
          <p><strong>Term:</strong> ${escapeHtml(term)}</p>
          <p><strong>Teacher:</strong> ${escapeHtml(teacherName)}</p>
          <p><strong>Status:</strong> ${escapeHtml(statusText)}</p>
        </article>
      `;
    })
    .join('');
}

async function checkExistingEnrollment(classId) {
  if (!currentStudentUser?.uid || !classId) return false;

  if (enrolledClassIds.has(classId)) return true;

  const enrollmentQuery = query(
    collection(db, 'classEnrollments'),
    where('studentId', '==', currentStudentUser.uid),
    where('classId', '==', classId)
  );
  const enrollmentSnapshot = await getDocs(enrollmentQuery);
  const hasEnrollment = !enrollmentSnapshot.empty;

  if (hasEnrollment) {
    enrolledClassIds.add(classId);
  }

  return hasEnrollment;
}

async function enrollInClass(classData) {
  if (!currentStudentUser?.uid) {
    showMyClassesFeedback('You must be logged in to enroll.', 'error');
    return;
  }

  if (!classData?.id) {
    showMyClassesFeedback('Class information is invalid.', 'error');
    return;
  }

  try {
    clearMyClassesFeedback();
    const alreadyEnrolled = await checkExistingEnrollment(classData.id);
    if (alreadyEnrolled) {
      showMyClassesFeedback('You already have an enrollment request for this class.', 'error');
      await loadAvailableClasses();
      await loadMyEnrollments();
      return;
    }

    const displayName = safe(makeFullName(currentStudentProfile || {}));
    const classDocRef = doc(db, 'classes', classData.id);
    const classSnapshot = await getDoc(classDocRef);

    if (!classSnapshot.exists()) {
      showMyClassesFeedback('Selected class could not be found.', 'error');
      await loadAvailableClasses();
      return;
    }

    const selectedClassData = classSnapshot.data() || {};
    const sectionId = String(selectedClassData.sectionId || classData.sectionId || currentStudentProfile?.sectionId || '').trim();
    const sectionName = String(
      selectedClassData.sectionName || classData.sectionName || currentStudentProfile?.section || currentStudentProfile?.sectionName || ''
    ).trim();
    const subjectId = String(selectedClassData.subjectId || classData.subjectId || '').trim();
    const subjectName = String(selectedClassData.subjectName || classData.subjectName || '').trim();
    const schoolYearId = String(selectedClassData.schoolYearId || classData.schoolYearId || '').trim();
    const schoolYearName = String(selectedClassData.schoolYearName || classData.schoolYearName || '').trim();
    const termId = String(selectedClassData.termId || classData.termId || '').trim();
    const termName = String(selectedClassData.termName || classData.termName || '').trim();
    const teacherId = String(selectedClassData.teacherId || classData.teacherId || '').trim();
    const teacherName = String(selectedClassData.teacherName || classData.teacherName || '').trim();

    await addDoc(collection(db, 'classEnrollments'), {
      classId: classData.id,
      studentId: currentStudentUser.uid,
      studentName: displayName,
      studentEmail: currentStudentUser.email || '',
      sectionId,
      sectionName,
      subjectId,
      subjectName,
      schoolYearId,
      schoolYearName,
      termId,
      termName,
      teacherId,
      teacherName,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });

    enrolledClassIds.add(classData.id);
    showMyClassesFeedback('Enrollment request submitted. Please wait for teacher approval.');
    await loadAvailableClasses();
    await loadMyEnrollments();
  } catch (error) {
    console.error('Failed to enroll in class:', error);
    showMyClassesFeedback('Unable to submit enrollment request. Please try again later.', 'error');
  }
}

function renderAvailableClasses(classes) {
  if (!availableClassesListElement) return;

  if (!classes.length) {
    availableClassesListElement.innerHTML = '<p>No available classes for enrollment.</p>';
    return;
  }

  availableClassesListElement.innerHTML = classes
    .map((classData) => {
      const sectionName = classData.sectionName || 'Not provided';
      const teacherName = getTeacherName(classData);
      const status = classData.status || 'Active';
      const isBlocked = classData.hasExistingEnrollment;

      return `
        <article class="app-card">
          <p><strong>Subject:</strong> ${escapeHtml(classData.subjectName || classData.subject || 'Untitled')}</p>
          <p><strong>Subject Code:</strong> ${escapeHtml(classData.subjectCode || 'Not provided')}</p>
          <p><strong>Category:</strong> ${escapeHtml(classData.subjectCategory || 'Not provided')}</p>
          <p><strong>Section:</strong> ${escapeHtml(sectionName)}</p>
          <p><strong>Grade Level:</strong> ${escapeHtml(classData.gradeLevel || 'Not provided')}</p>
          <p><strong>School Year:</strong> ${escapeHtml(classData.schoolYear || 'Not provided')}</p>
          <p><strong>Term:</strong> ${escapeHtml(classData.term || 'Not provided')}</p>
          <p><strong>Teacher:</strong> ${escapeHtml(teacherName)}</p>
          <p><strong>Status:</strong> ${escapeHtml(status)}</p>
          <button type="button" class="enroll-btn" data-class-id="${escapeHtml(classData.id)}" ${
            isBlocked ? 'disabled' : ''
          }>
            ${isBlocked ? 'Already Requested' : 'Enroll'}
          </button>
        </article>
      `;
    })
    .join('');

  const enrollButtons = availableClassesListElement.querySelectorAll('.enroll-btn');
  enrollButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const classId = button.dataset.classId;
      const selectedClass = classes.find((item) => item.id === classId);
      await enrollInClass(selectedClass);
    });
  });
}

async function loadMyEnrollments() {
  if (!myEnrollmentsListElement || !currentStudentUser?.uid) return;

  myEnrollmentsListElement.innerHTML = '<p>Loading enrollments...</p>';

  try {
    let enrollmentsSnapshot;
    try {
      const enrollmentsQuery = query(
        collection(db, 'classEnrollments'),
        where('studentId', '==', currentStudentUser.uid),
        orderBy('requestedAt', 'desc')
      );
      enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    } catch (error) {
      const fallbackSnapshot = await getDocs(
        query(collection(db, 'classEnrollments'), where('studentId', '==', currentStudentUser.uid))
      );
      const docs = [...fallbackSnapshot.docs].sort((a, b) => {
        const aTime = a.data().requestedAt?.toMillis?.() || 0;
        const bTime = b.data().requestedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      enrollmentsSnapshot = { docs, empty: docs.length === 0 };
      console.error('Failed to query enrollments with orderBy:', error);
    }

    const enrollments = enrollmentsSnapshot.docs.map((enrollmentDoc) => ({
      id: enrollmentDoc.id,
      ...enrollmentDoc.data(),
    }));

    enrolledClassIds = new Set(enrollments.map((enrollment) => enrollment.classId).filter(Boolean));

    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const classMap = new Map(
      classesSnapshot.docs.map((classDoc) => [classDoc.id, { id: classDoc.id, ...classDoc.data() }])
    );

    const enrollmentsWithClassData = enrollments.map((enrollment) => ({
      ...enrollment,
      classData: classMap.get(enrollment.classId) || null,
    }));

    renderMyEnrollments(enrollmentsWithClassData);
  } catch (error) {
    console.error('Failed to load enrollments:', error);
    myEnrollmentsListElement.innerHTML = '<p>Unable to load enrollments. Please try again later.</p>';
  }
}

async function loadAvailableClasses() {
  if (!availableClassesListElement || !currentStudentUser?.uid) return;

  availableClassesListElement.innerHTML = '<p>Loading available classes...</p>';

  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const studentSectionId = String(currentStudentProfile?.sectionId || '').trim();
    const studentSectionName = String(
      currentStudentProfile?.sectionName || currentStudentProfile?.section || ''
    ).trim().toLowerCase();

    const availableClasses = classesSnapshot.docs
      .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }))
      .filter((classData) => isClassActive(classData))
      .filter((classData) => {
        const classSectionId = String(classData.sectionId || '').trim();
        const classSectionName = String(classData.sectionName || '').trim().toLowerCase();

        if (studentSectionId) {
          return !classSectionId || classSectionId === studentSectionId;
        }

        if (studentSectionName) {
          return !classSectionName || classSectionName === studentSectionName;
        }

        return true;
      });

    const classesWithEnrollmentCheck = await Promise.all(
      availableClasses.map(async (classData) => ({
        ...classData,
        hasExistingEnrollment: await checkExistingEnrollment(classData.id),
      }))
    );

    renderAvailableClasses(classesWithEnrollmentCheck.filter((item) => !item.hasExistingEnrollment));
  } catch (error) {
    console.error('Failed to load available classes:', error);
    availableClassesListElement.innerHTML = '<p>Unable to load available classes. Please try again later.</p>';
  }
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

    const renderedLogs = await Promise.all(
      logsSnapshot.docs.map(async (logDoc) => {
        const log = logDoc.data() || {};
        const source = String(log.source || '').trim().toLowerCase();
        const isAcademic = source === 'academic';

        if (isAcademic) {
          const pointDifference = normalizeNumericValue(log.pointDifference, 0);
          if (pointDifference === 0) {
            return '';
          }

          const displayPoints = normalizeNumericValue(log.pointDifference ?? log.awardedPoints, 0);
          const sign = displayPoints > 0 ? '+' : '';
          const title = String(log.activityTitle || log.title || 'Academic score record').trim() || 'Academic score record';
          const teacherName = await resolveTeacherName(log);
          const details = [
            String(log.componentType || '').trim(),
            Number.isFinite(Number(log.score)) && Number.isFinite(Number(log.maxScore))
              ? `${normalizeNumericValue(log.score)}/${normalizeNumericValue(log.maxScore)}`
              : '',
            formatPercentage(log.percentage) ? `${formatPercentage(log.percentage)}%` : ''
          ]
            .filter(Boolean)
            .join(' • ');

          return `<li>${sign}${escapeHtml(String(displayPoints))} Academic — ${escapeHtml(title)}${
            details ? `<br>${escapeHtml(details)}` : ''
          }<br><strong>Teacher:</strong> ${escapeHtml(teacherName)}</li>`;
        }

        const points = normalizePoints(log.points);
        const sign = log.type === 'demerit' ? '-' : '+';
        const label = log.type === 'demerit' ? 'Demerit' : 'Merit';
        const reason = String(log.reason || 'No reason provided').trim() || 'No reason provided';
        const teacherName = await resolveTeacherName(log);

        return `<li>${sign}${points} ${label} — ${escapeHtml(reason)}<br><strong>Teacher:</strong> ${escapeHtml(
          teacherName
        )}</li>`;
      })
    );

    const filteredLogs = renderedLogs.filter(Boolean);
    listElement.innerHTML = filteredLogs.length ? filteredLogs.join('') : '<li>No point logs available yet.</li>';
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
  currentStudentUser = user;

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
    currentStudentProfile = studentData;
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
    loadMyEnrollments();
    loadAvailableClasses();
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
