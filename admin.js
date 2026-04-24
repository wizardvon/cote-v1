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
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction
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
const loadingOverlay = document.getElementById('loadingOverlay');

const teacherClassFilterElement = document.getElementById('teacher-class-filter');
const searchInput = document.getElementById('student-search');
const loadStudentsButton = document.getElementById('load-students-button');
const selectAllCheckbox = document.getElementById('selectAll') || document.getElementById('select-all');
const tableBody = document.getElementById('studentTableBody') || document.getElementById('students-table-body');
const pointsValueInput = document.getElementById('points-value');
const reasonInput = document.getElementById('reason-input');
const addPointsButton = document.getElementById('add-points-button');
const deductPointsButton = document.getElementById('deduct-points-button');
const messageElement = document.getElementById('admin-message');
const scoreClassFilterElement = document.getElementById('score-class-filter');
const scoreTypeElement = document.getElementById('score-type');
const scoreTitleElement = document.getElementById('score-title');
const scoreMaxElement = document.getElementById('score-max');
const loadScoreStudentsButton = document.getElementById('load-score-students-button');
const saveScoresButton = document.getElementById('save-scores-button');
const scoresTableBody = document.getElementById('scoresTableBody');
const scoreMessageElement = document.getElementById('score-message');
const classSubjectElement = document.getElementById('class-subject');
const classSchoolYearElement = document.getElementById('class-school-year');
const classTermElement = document.getElementById('class-term');
const classSectionElement = document.getElementById('class-section');
const createClassButton = document.getElementById('create-class-button');
const classMessageElement = document.getElementById('class-message');
const myClassesListElement = document.getElementById('my-classes-list');
const enrollmentClassFilterElement = document.getElementById('enrollment-class-filter');
const enrollmentRequestsListElement = document.getElementById('enrollment-requests-list');
const enrollmentMessageElement = document.getElementById('enrollment-message');
const classRecordFilterElement = document.getElementById('class-record-filter');
const classRecordActivityTitleElement = document.getElementById('class-record-activity-title');
const classRecordComponentTypeElement = document.getElementById('class-record-component-type');
const classRecordMaxScoreElement = document.getElementById('class-record-max-score');
const classRecordAddActivityButton = document.getElementById('class-record-add-activity-button');
const classRecordTableElement = document.getElementById('class-record-table');
const classRecordDownloadButton = document.getElementById('class-record-download-button');
const classRecordPrintButton = document.getElementById('class-record-print-button');
const classRecordMessageElement = document.getElementById('class-record-message');
let overlaySequenceJob = 0;

const TABLE_COLUMN_COUNT = 5;

const pageTitles = {
  home: 'Home',
  'give-points': 'Give Points',
  scores: 'Scores',
  quest: 'Quest',
  resources: 'Resources',
  'my-classes': 'My Classes',
  'class-record': 'Class Record',
  'enrollment-requests': 'Enrollment Requests'
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

let allStudents = [];
let visibleStudents = [];
let scoreStudents = [];
let currentTeacherProfile = null;
let teacherClasses = [];
let selectedTeacherClassId = '';
let selectedScoreClassId = '';
let classSubjects = [];
let classSchoolYears = [];
let classTerms = [];
let classSections = [];
let enrollmentRequests = [];
let currentClassRecordClassId = '';
let currentClassRecordClassName = '';
let currentClassRecordStudents = [];
let currentClassRecordActivities = [];
let currentClassRecordScores = new Map();
let currentEditingActivityId = '';

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

function safeText(value, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toTitleCase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function buildTeacherFullName(data, fallback = 'Unknown Teacher') {
  const fullName = [data?.firstName, data?.middleName, data?.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return fullName || fallback;
}

function formatFullName(student) {
  const lastName = toTitleCase(safeText(student.lastName, ''));
  const firstName = toTitleCase(safeText(student.firstName, ''));
  const middleName = toTitleCase(safeText(student.middleName, ''));
  const middleInitial = middleName ? `${middleName.charAt(0)}.` : '';
  const namePart = [firstName, middleInitial].filter(Boolean).join(' ');

  if (lastName && namePart) return `${lastName}, ${namePart}`;
  if (lastName) return lastName;
  if (namePart) return namePart;
  return '—';
}

function setMessage(message, type = '') {
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.remove('success', 'error');

  if (type) {
    messageElement.classList.add(type);
  }
}

function setScoreMessage(message, type = '') {
  if (!scoreMessageElement) return;
  scoreMessageElement.textContent = message;
  scoreMessageElement.classList.remove('success', 'error');

  if (type) {
    scoreMessageElement.classList.add(type);
  }
}

function setClassMessage(message, type = '') {
  if (!classMessageElement) return;
  classMessageElement.textContent = message;
  classMessageElement.classList.remove('success', 'error');

  if (type) {
    classMessageElement.classList.add(type);
  }
}

function setEnrollmentMessage(message, type = '') {
  if (!enrollmentMessageElement) return;
  enrollmentMessageElement.textContent = message;
  enrollmentMessageElement.classList.remove('success', 'error');

  if (type) {
    enrollmentMessageElement.classList.add(type);
  }
}

function setClassRecordMessage(message, type = '') {
  if (!classRecordMessageElement) return;
  classRecordMessageElement.textContent = message;
  classRecordMessageElement.classList.remove('success', 'error');

  if (type) {
    classRecordMessageElement.classList.add(type);
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

function getSexSortRank(sexValue) {
  const normalizedSex = String(sexValue || '').trim().toLowerCase();
  if (normalizedSex === 'male') return 0;
  if (normalizedSex === 'female') return 1;
  return 2;
}

function compareClassRecordStudents(a, b) {
  const sexCompare = getSexSortRank(a.sex) - getSexSortRank(b.sex);
  if (sexCompare !== 0) {
    return sexCompare;
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

function formatClassLabel(classItem) {
  const subject = safeText(classItem.subjectName, 'Untitled Subject');
  const section = safeText(classItem.sectionName, 'No Section');
  const term = safeText(classItem.termName, '');
  const schoolYear = safeText(classItem.schoolYearName, '');
  const details = [section, term, schoolYear].filter(Boolean).join(' • ');
  return details ? `${subject} — ${details}` : subject;
}

function populateTeacherClassSelectors(classes = []) {
  const selectors = [teacherClassFilterElement, scoreClassFilterElement, classRecordFilterElement].filter(Boolean);

  selectors.forEach((selectElement) => {
    const previousValue = selectElement.value;
    selectElement.innerHTML = '<option value="">Select a class first</option>';

    classes.forEach((classItem) => {
      const option = document.createElement('option');
      option.value = classItem.id;
      option.textContent = formatClassLabel(classItem);
      selectElement.append(option);
    });

    if (previousValue && classes.some((item) => item.id === previousValue)) {
      selectElement.value = previousValue;
    }
  });
}

function renderScoreStudentsTable(emptyMessage = 'No students found for the selected section.') {
  if (!scoresTableBody) return;

  if (!scoreStudents.length) {
    scoresTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">${emptyMessage}</td>
      </tr>
    `;
    return;
  }

  scoresTableBody.innerHTML = scoreStudents
    .map((student) => {
      return `
        <tr>
          <td>${formatFullName(student)}</td>
          <td>${safeText(student.lrn)}</td>
          <td>
            <input
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              class="score-input"
              data-score-student-id="${student.id}"
              placeholder="Enter score"
            />
          </td>
        </tr>
      `;
    })
    .join('');
}

function populateSelectOptions(selectElement, data, placeholder, getLabel) {
  if (!selectElement) return;
  selectElement.innerHTML = `<option value="">${placeholder}</option>`;

  data.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = getLabel(item);
    selectElement.append(option);
  });
}

function getDocName(data, fallback = 'Unnamed') {
  return safeText(
    data?.name ?? data?.title ?? data?.label ?? data?.schoolYear ?? data?.term ?? data?.section ?? data?.subjectName,
    fallback
  );
}

function formatClassCreatedAt(createdAt) {
  if (!createdAt) return '—';
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().toLocaleString();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString();
  return '—';
}

function formatTimestamp(value) {
  if (!value) return '—';
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return '—';
}

async function loadSubjectsForClassForm() {
  if (!classSubjectElement) return;

  const snapshot = await getDocs(query(collection(db, 'subjects'), where('status', '==', 'active')));
  classSubjects = snapshot.docs.map((subjectDoc) => {
    const data = subjectDoc.data();
    return {
      id: subjectDoc.id,
      name: getDocName(data, 'Unnamed Subject'),
      code: safeText(data.code ?? data.subjectCode, ''),
      category: safeText(data.category ?? data.subjectCategory, ''),
      ...data
    };
  });

  populateSelectOptions(classSubjectElement, classSubjects, 'Select Subject', (subject) => {
    const codePart = subject.code ? ` (${subject.code})` : '';
    return `${subject.name}${codePart}`;
  });
}

async function loadSchoolYearsForClassForm() {
  if (!classSchoolYearElement) return;

  const snapshot = await getDocs(query(collection(db, 'schoolYears'), where('status', '==', 'active')));
  classSchoolYears = snapshot.docs.map((schoolYearDoc) => {
    const data = schoolYearDoc.data();
    return { id: schoolYearDoc.id, name: getDocName(data, 'Unnamed School Year'), ...data };
  });

  populateSelectOptions(classSchoolYearElement, classSchoolYears, 'Select School Year', (schoolYear) => schoolYear.name);
}

async function loadTermsForClassForm() {
  if (!classTermElement) return;

  const snapshot = await getDocs(query(collection(db, 'terms'), where('status', '==', 'active')));
  classTerms = snapshot.docs.map((termDoc) => {
    const data = termDoc.data();
    return { id: termDoc.id, name: getDocName(data, 'Unnamed Term'), ...data };
  });

  populateSelectOptions(classTermElement, classTerms, 'Select Term', (term) => term.name);
}

async function loadSectionsForClassForm() {
  if (!classSectionElement) return;

  const snapshot = await getDocs(query(collection(db, 'sections'), where('status', '==', 'active')));
  classSections = snapshot.docs.map((sectionDoc) => {
    const data = sectionDoc.data();
    return {
      id: sectionDoc.id,
      name: getDocName(data, 'Unnamed Section'),
      gradeLevel: safeText(data.gradeLevel, ''),
      schoolYearName: safeText(data.schoolYearName ?? data.schoolYear, ''),
      ...data
    };
  });

  populateSelectOptions(classSectionElement, classSections, 'Select Section', (section) => {
    const labels = [section.gradeLevel && `Grade ${section.gradeLevel}`, section.name, section.schoolYearName].filter(Boolean);
    return labels.join(' | ');
  });
}

function renderMyClasses(classes = []) {
  if (!myClassesListElement) return;

  if (!classes.length) {
    myClassesListElement.innerHTML = '<p class="empty-cell">No classes yet. Create your first class above.</p>';
    return;
  }

  myClassesListElement.innerHTML = classes
    .map(
      (item) => `
        <article class="app-card">
          <h4>${safeText(item.subjectName)}</h4>
          <p><strong>Subject Code:</strong> ${safeText(item.subjectCode)}</p>
          <p><strong>Category:</strong> ${safeText(item.subjectCategory)}</p>
          <p><strong>Section:</strong> ${safeText(item.sectionName)}</p>
          <p><strong>Grade Level:</strong> ${safeText(item.gradeLevel)}</p>
          <p><strong>School Year:</strong> ${safeText(item.schoolYearName)}</p>
          <p><strong>Term:</strong> ${safeText(item.termName)}</p>
          <p><strong>Status:</strong> ${safeText(item.status, 'active')}</p>
          <p><strong>Created:</strong> ${formatClassCreatedAt(item.createdAt)}</p>
        </article>
      `
    )
    .join('');
}

function populateEnrollmentClassFilter(classes = []) {
  if (!enrollmentClassFilterElement) return;

  const previousValue = enrollmentClassFilterElement.value;
  enrollmentClassFilterElement.innerHTML = '<option value="">All My Classes</option>';

  classes.forEach((classItem) => {
    const option = document.createElement('option');
    option.value = classItem.id;
    option.textContent = formatClassLabel(classItem);
    enrollmentClassFilterElement.append(option);
  });

  if (previousValue && classes.some((item) => item.id === previousValue)) {
    enrollmentClassFilterElement.value = previousValue;
  }
}

async function loadMyClasses() {
  if (!auth.currentUser?.uid) return;

  if (myClassesListElement) {
    myClassesListElement.innerHTML = '<p class="empty-cell">Loading classes...</p>';
  }

  try {
    const snapshot = await getDocs(
      query(collection(db, 'classes'), where('teacherId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'))
    );

    const classes = snapshot.docs.map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }));
    renderMyClasses(classes);
  } catch (error) {
    console.error('Failed to load classes:', error);
    if (myClassesListElement) {
      myClassesListElement.innerHTML = '<p class="empty-cell">Unable to load classes right now.</p>';
    }
    setClassMessage('Unable to load your classes. Please try again.', 'error');
  }
}

async function loadTeacherClassesForSelection() {
  if (!auth.currentUser?.uid) return [];

  const snapshot = await getDocs(
    query(collection(db, 'classes'), where('teacherId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'))
  );

  teacherClasses = snapshot.docs.map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }));
  populateTeacherClassSelectors(teacherClasses);
  populateEnrollmentClassFilter(teacherClasses);
  return teacherClasses;
}

function renderEnrollmentRequests(requests = []) {
  if (!enrollmentRequestsListElement) return;

  if (!requests.length) {
    enrollmentRequestsListElement.innerHTML = '<p class="empty-cell">No pending enrollment requests found.</p>';
    return;
  }

  enrollmentRequestsListElement.innerHTML = requests
    .map((requestItem) => {
      return `
        <article class="app-card">
          <h4>${safeText(requestItem.studentName, 'Student')}</h4>
          <p><strong>Student Email:</strong> ${safeText(requestItem.studentEmail)}</p>
          <p><strong>Student Section:</strong> ${safeText(requestItem.sectionName)}</p>
          <p><strong>Subject:</strong> ${safeText(requestItem.classSubjectName)}</p>
          <p><strong>Class Section:</strong> ${safeText(requestItem.classSectionName)}</p>
          <p><strong>School Year:</strong> ${safeText(requestItem.classSchoolYearName)}</p>
          <p><strong>Term:</strong> ${safeText(requestItem.classTermName)}</p>
          <p><strong>Requested At:</strong> ${formatTimestamp(requestItem.requestedAt)}</p>
          <div class="admin-actions">
            <button type="button" data-enrollment-action="approve" data-enrollment-id="${requestItem.id}">
              Approve
            </button>
            <button
              type="button"
              class="danger-button"
              data-enrollment-action="reject"
              data-enrollment-id="${requestItem.id}"
            >
              Reject
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadEnrollmentRequests(selectedClassId = '') {
  if (!auth.currentUser?.uid) return;
  if (!enrollmentRequestsListElement) return;

  const classId = String(selectedClassId || enrollmentClassFilterElement?.value || '').trim();
  const allowedClasses = teacherClasses.filter((item) => Boolean(item?.id));
  const allowedClassIds = new Set(allowedClasses.map((item) => item.id));

  enrollmentRequestsListElement.innerHTML = '<p class="empty-cell">Loading enrollment requests...</p>';
  setEnrollmentMessage('Loading pending requests...');

  try {
    if (!allowedClasses.length) {
      enrollmentRequests = [];
      renderEnrollmentRequests(enrollmentRequests);
      setEnrollmentMessage('No classes found for this teacher.');
      return;
    }

    let classesToQuery = allowedClasses;
    if (classId) {
      if (!allowedClassIds.has(classId)) {
        enrollmentRequests = [];
        renderEnrollmentRequests(enrollmentRequests);
        setEnrollmentMessage('Invalid class selection.', 'error');
        return;
      }

      classesToQuery = allowedClasses.filter((teacherClass) => teacherClass.id === classId);
    }

    const snapshots = await Promise.all(
      classesToQuery.map((teacherClass) =>
        getDocs(
          query(
            collection(db, 'classEnrollments'),
            where('classId', '==', teacherClass.id),
            where('status', '==', 'pending')
          )
        )
      )
    );

    const classById = new Map(allowedClasses.map((item) => [item.id, item]));
    const mappedRequests = snapshots
      .flatMap((snapshot) => snapshot.docs.map((enrollmentDoc) => ({ id: enrollmentDoc.id, ...enrollmentDoc.data() })))
      .filter((item) => allowedClassIds.has(String(item.classId || '').trim()))
      .map((item) => {
        const classItem = classById.get(String(item.classId || '').trim()) || {};
        return {
          ...item,
          classSubjectName: safeText(item.subjectName || item.classSubjectName || classItem.subjectName),
          classSectionName: safeText(item.classSectionName || classItem.sectionName),
          classSchoolYearName: safeText(item.schoolYearName || item.classSchoolYearName || classItem.schoolYearName),
          classTermName: safeText(item.termName || item.classTermName || classItem.termName),
          requestedAt: item.requestedAt || item.createdAt || null
        };
      })
      .sort((a, b) => {
        const aSeconds = a.requestedAt?.seconds || 0;
        const bSeconds = b.requestedAt?.seconds || 0;
        return bSeconds - aSeconds;
      });

    enrollmentRequests = mappedRequests;
    renderEnrollmentRequests(enrollmentRequests);

    if (!enrollmentRequests.length) {
      setEnrollmentMessage('No pending enrollment requests found.');
      return;
    }

    setEnrollmentMessage(`Loaded ${enrollmentRequests.length} pending enrollment request(s).`, 'success');
  } catch (error) {
    console.error('Failed to load enrollment requests:', error);
    enrollmentRequests = [];
    renderEnrollmentRequests(enrollmentRequests);
    setEnrollmentMessage('Unable to load enrollment requests. Please try again.', 'error');
  }
}

async function approveEnrollmentRequest(enrollmentId) {
  const id = String(enrollmentId || '').trim();
  if (!id) return;

  try {
    await updateDoc(doc(db, 'classEnrollments', id), {
      status: 'approved',
      approvedAt: serverTimestamp()
    });
    setEnrollmentMessage('Enrollment request approved.', 'success');
    await loadEnrollmentRequests();
  } catch (error) {
    console.error('Failed to approve enrollment request:', error);
    setEnrollmentMessage('Unable to approve request. Please try again.', 'error');
  }
}

async function rejectEnrollmentRequest(enrollmentId) {
  const id = String(enrollmentId || '').trim();
  if (!id) return;

  try {
    await updateDoc(doc(db, 'classEnrollments', id), {
      status: 'rejected',
      reviewedAt: serverTimestamp()
    });
    setEnrollmentMessage('Enrollment request rejected.', 'success');
    await loadEnrollmentRequests();
  } catch (error) {
    console.error('Failed to reject enrollment request:', error);
    setEnrollmentMessage('Unable to reject request. Please try again.', 'error');
  }
}


function getScoreTypeKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'ww' || raw === 'written work' || raw === 'written works') return 'WW';
  if (raw === 'pt' || raw === 'performance task' || raw === 'performance tasks') return 'PT';
  if (raw === 'exam' || raw === 'examination') return 'Exam';
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getActivitiesByComponent(activities = []) {
  return {
    WW: activities.filter((activity) => activity.componentType === 'WW'),
    PT: activities.filter((activity) => activity.componentType === 'PT'),
    Exam: activities.filter((activity) => activity.componentType === 'Exam')
  };
}

function buildScoreMap(scoreDocs = []) {
  const map = new Map();
  scoreDocs.forEach((scoreItem) => {
    const studentId = String(scoreItem.studentId || '').trim();
    const activityId = String(scoreItem.activityId || '').trim();
    if (!studentId || !activityId) return;
    map.set(`${studentId}::${activityId}`, scoreItem);
  });
  return map;
}

function renderClassRecordTable(students = [], activities = [], scoresMap = new Map(), emptyMessage = '') {
  if (!classRecordTableElement) return;

  const grouped = getActivitiesByComponent(activities);
  const orderedActivities = [...grouped.WW, ...grouped.PT, ...grouped.Exam];
  const colSpan = Math.max(orderedActivities.length + 1, 2);

  const renderGroupHeader = (label, items) => {
    if (!items.length) return '';
    return `<th scope="colgroup" colspan="${items.length}">${label}</th>`;
  };

  const renderActivityHeaderCell = (activity) => {
    const isEditing = currentEditingActivityId === activity.id;
    return `
      <th scope="col" class="class-record-activity-header-cell">
        <div class="class-record-activity-header">
          <span class="class-record-activity-title">${escapeHtml(safeText(activity.title, '-'))}</span>
          <span class="class-record-activity-max">${escapeHtml(String(activity.maxScore ?? '-'))}</span>
          <button
            type="button"
            class="class-record-activity-edit-btn"
            data-activity-edit-btn="${escapeHtml(activity.id)}"
            aria-label="${isEditing ? 'Save' : 'Edit'} scores for ${escapeHtml(safeText(activity.title, 'activity'))}"
          >${isEditing ? 'Save' : 'Edit'}</button>
        </div>
      </th>
    `;
  };

  if (!students.length) {
    classRecordTableElement.innerHTML = `
      <table class="student-table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            ${renderGroupHeader('Written Works', grouped.WW)}
            ${renderGroupHeader('Performance Task', grouped.PT)}
            ${renderGroupHeader('Exam', grouped.Exam)}
          </tr>
          <tr>
            <th scope="col">Activities</th>
            ${orderedActivities.length ? orderedActivities.map(renderActivityHeaderCell).join('') : '<th scope="col">-</th>'}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="${colSpan}" class="empty-cell">${safeText(
      emptyMessage || 'No approved enrolled students found for this class.',
      'No records found.'
    )}</td>
          </tr>
        </tbody>
      </table>
    `;
    return;
  }

  classRecordTableElement.innerHTML = `
    <table class="student-table">
      <thead>
        <tr>
          <th scope="col">Student</th>
          ${renderGroupHeader('Written Works', grouped.WW)}
          ${renderGroupHeader('Performance Task', grouped.PT)}
          ${renderGroupHeader('Exam', grouped.Exam)}
        </tr>
        <tr>
          <th scope="col">Activities</th>
          ${orderedActivities.length ? orderedActivities.map(renderActivityHeaderCell).join('') : '<th scope="col">No activities yet</th>'}
        </tr>
      </thead>
      <tbody>
        ${students
          .map(
            (student) => `
              <tr>
                <th scope="row">${escapeHtml(formatFullName(student))}</th>
                ${
                  orderedActivities.length
                    ? orderedActivities
                        .map((activity) => {
                          const key = `${student.id}::${activity.id}`;
                          const existing = scoresMap.get(key);
                          const value = existing && Number.isFinite(Number(existing.score)) ? Number(existing.score) : '';
                          const isEditable = currentEditingActivityId === activity.id;
                          return `
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="${escapeHtml(String(activity.maxScore))}"
                                step="0.01"
                                inputmode="decimal"
                                class="score-input class-record-score-input"
                                data-student-id="${escapeHtml(student.id)}"
                                data-activity-id="${escapeHtml(activity.id)}"
                                data-max-score="${escapeHtml(String(activity.maxScore))}"
                                data-component-type="${escapeHtml(activity.componentType)}"
                                data-title="${escapeHtml(activity.title)}"
                                data-last-saved="${escapeHtml(String(value))}"
                                value="${escapeHtml(String(value))}"
                                ${isEditable ? '' : 'readonly disabled'}
                                aria-label="Score for ${escapeHtml(formatFullName(student))} in ${escapeHtml(activity.title)}"
                              />
                            </td>
                          `;
                        })
                        .join('')
                    : '<td class="empty-cell">No activities added yet.</td>'
                }
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function setClassRecordColumnEditable(activityId, editable) {
  if (!classRecordTableElement) return;

  const targetActivityId = String(activityId || '').trim();
  if (!targetActivityId) return;

  const columnInputs = classRecordTableElement.querySelectorAll(
    `.class-record-score-input[data-activity-id="${CSS.escape(targetActivityId)}"]`
  );

  columnInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.readOnly = !editable;
    input.disabled = !editable;
  });
}

function getClassRecordColumnInputs(activityId) {
  if (!classRecordTableElement) return [];
  const targetActivityId = String(activityId || '').trim();
  if (!targetActivityId) return [];

  return Array.from(
    classRecordTableElement.querySelectorAll(
      `.class-record-score-input[data-activity-id="${CSS.escape(targetActivityId)}"]`
    )
  ).filter((input) => input instanceof HTMLInputElement);
}

function updateClassRecordEditButtons() {
  if (!classRecordTableElement) return;

  classRecordTableElement.querySelectorAll('button[data-activity-edit-btn]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const activityId = String(button.dataset.activityEditBtn || '').trim();
    const isEditing = currentEditingActivityId && currentEditingActivityId === activityId;
    button.textContent = isEditing ? 'Save' : 'Edit';
    button.setAttribute('aria-label', `${isEditing ? 'Save' : 'Edit'} activity column`);
  });
}

async function saveClassRecordActivityColumn(activityId) {
  const inputs = getClassRecordColumnInputs(activityId);
  if (!inputs.length) return true;

  for (const input of inputs) {
    const result = await saveClassRecordScore(input, { lockInputAfterSave: false });
    if (!result.ok) {
      input.focus();
      input.select();
      return false;
    }
  }

  return true;
}

async function toggleClassRecordActivityEdit(activityId) {
  const targetActivityId = String(activityId || '').trim();
  if (!targetActivityId) return;

  if (currentEditingActivityId && currentEditingActivityId !== targetActivityId) {
    setClassRecordMessage('Only one activity can be edited at a time. Save the current column first.', 'error');
    return;
  }

  if (currentEditingActivityId === targetActivityId) {
    const didSave = await saveClassRecordActivityColumn(targetActivityId);
    if (!didSave) return;

    currentEditingActivityId = '';
    setClassRecordColumnEditable(targetActivityId, false);
    updateClassRecordEditButtons();
    setClassRecordMessage('Activity scores saved and locked.', 'success');
    return;
  }

  currentEditingActivityId = targetActivityId;
  setClassRecordColumnEditable(targetActivityId, true);
  updateClassRecordEditButtons();

  const [firstInput] = getClassRecordColumnInputs(targetActivityId);
  if (firstInput) {
    firstInput.focus();
    firstInput.select();
  }

  setClassRecordMessage('Editing enabled for selected activity. Press Enter to move to the next student.', '');
}

async function loadClassRecord(classId) {
  const selectedClassId = String(classId || '').trim();
  currentClassRecordClassId = selectedClassId;
  currentEditingActivityId = '';

  if (!selectedClassId) {
    currentClassRecordStudents = [];
    currentClassRecordActivities = [];
    currentClassRecordScores = new Map();
    currentClassRecordClassName = '';
    renderClassRecordTable([], [], new Map(), 'Select a class first.');
    setClassRecordMessage('Select a class first.', '');
    return;
  }

  renderClassRecordTable([], [], new Map(), 'Loading class record...');
  setClassRecordMessage('Loading class record...');

  try {
    const selectedClass = teacherClasses.find((classItem) => classItem.id === selectedClassId) || {};
    currentClassRecordClassName = formatClassLabel(selectedClass);

    const [students, activitySnapshot, scoreSnapshot] = await Promise.all([
      loadStudentsFromApprovedEnrollments(selectedClassId),
      getDocs(query(collection(db, 'activities'), where('classId', '==', selectedClassId))),
      getDocs(query(collection(db, 'scores'), where('classId', '==', selectedClassId)))
    ]);

    currentClassRecordStudents = [...students].sort(compareClassRecordStudents);
    currentClassRecordActivities = activitySnapshot.docs
      .map((activityDoc) => ({
        id: activityDoc.id,
        ...activityDoc.data(),
        componentType: getScoreTypeKey(activityDoc.data().componentType),
        maxScore: Number(activityDoc.data().maxScore)
      }))
      .filter((activity) => ['WW', 'PT', 'Exam'].includes(activity.componentType) && Number.isFinite(activity.maxScore))
      .sort((a, b) => {
        const order = { WW: 1, PT: 2, Exam: 3 };
        const componentCompare = order[a.componentType] - order[b.componentType];
        if (componentCompare !== 0) return componentCompare;
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        if (aTime !== bTime) return aTime - bTime;
        return safeText(a.title, '').localeCompare(safeText(b.title, ''), undefined, { sensitivity: 'base' });
      });

    currentClassRecordScores = buildScoreMap(
      scoreSnapshot.docs
        .map((scoreDoc) => ({ id: scoreDoc.id, ...scoreDoc.data() }))
        .filter((scoreItem) => String(scoreItem.activityId || '').trim())
    );

    if (!currentClassRecordStudents.length) {
      renderClassRecordTable([], currentClassRecordActivities, currentClassRecordScores, 'No approved enrolled students found for this class.');
      setClassRecordMessage('No approved enrolled students found for this class.');
      return;
    }

    renderClassRecordTable(currentClassRecordStudents, currentClassRecordActivities, currentClassRecordScores);
    setClassRecordMessage(
      `Loaded ${currentClassRecordStudents.length} student(s) and ${currentClassRecordActivities.length} activit${
        currentClassRecordActivities.length === 1 ? 'y' : 'ies'
      }.`,
      'success'
    );
  } catch (error) {
    console.error('Failed to load class record:', error);
    currentClassRecordStudents = [];
    currentClassRecordActivities = [];
    currentClassRecordScores = new Map();
    renderClassRecordTable([], [], new Map(), 'Unable to load class record right now.');
    setClassRecordMessage('Unable to load class record. Please try again.', 'error');
  }
}

async function loadClassRecordClasses() {
  if (!classRecordFilterElement) return;

  if (!teacherClasses.length) {
    await loadTeacherClassesForSelection();
    await loadClassRecordClasses();
  }

  const selectedClassId = String(classRecordFilterElement.value || '').trim();
  if (selectedClassId) {
    await loadClassRecord(selectedClassId);
  } else {
    renderClassRecordTable([], [], new Map(), 'Select a class first.');
    setClassRecordMessage('Select a class first.');
  }
}

async function addClassRecordActivity() {
  const classId = String(classRecordFilterElement?.value || '').trim();
  const title = String(classRecordActivityTitleElement?.value || '').trim();
  const selectedType = String(classRecordComponentTypeElement?.value || '').trim();
  const maxScore = Number(classRecordMaxScoreElement?.value);
  const validTypes = ['WW', 'PT', 'Exam'];

  if (!classId) {
    setClassRecordMessage('Select a class first.', 'error');
    return;
  }

  if (!title) {
    setClassRecordMessage('Activity title is required.', 'error');
    return;
  }

  if (!validTypes.includes(selectedType)) {
    setClassRecordMessage('Component type must be WW, PT, or Exam.', 'error');
    return;
  }

  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    setClassRecordMessage('Highest possible score must be greater than 0.', 'error');
    return;
  }

  if (classRecordAddActivityButton) {
    classRecordAddActivityButton.disabled = true;
    classRecordAddActivityButton.textContent = 'Adding...';
  }

  try {
    await addDoc(collection(db, 'activities'), {
      classId,
      teacherId: auth.currentUser?.uid || '',
      title,
      type: selectedType,
      componentType: selectedType,
      maxScore: Number(maxScore.toFixed(2)),
      createdAt: serverTimestamp()
    });

    if (classRecordActivityTitleElement) classRecordActivityTitleElement.value = '';
    if (classRecordMaxScoreElement) classRecordMaxScoreElement.value = '';

    setClassRecordMessage('Activity added successfully.', 'success');
    await loadClassRecord(classId);
  } catch (error) {
    console.error('Failed to add class record activity:', error);
    setClassRecordMessage('Unable to add activity right now. Please try again.', 'error');
  } finally {
    if (classRecordAddActivityButton) {
      classRecordAddActivityButton.disabled = false;
      classRecordAddActivityButton.textContent = 'Add Activity';
    }
  }
}

function calculateAcademicPoints(score, maxScore) {
  const normalizedScore = Number(score);
  const normalizedMaxScore = Number(maxScore);

  if (!Number.isFinite(normalizedScore) || !Number.isFinite(normalizedMaxScore) || normalizedMaxScore <= 0) {
    return 0;
  }

  const percentage = (normalizedScore / normalizedMaxScore) * 100;

  if (percentage === 100) return 100;
  if (percentage >= 90) return 75;
  if (percentage >= 75) return 50;
  if (percentage >= 50) return 25;
  return 0;
}

function buildAcademicPointLogId(classId, activityId, studentId) {
  return `academic_${classId}_${activityId}_${studentId}`;
}

async function saveScoreWithAcademicPoints(payload) {
  const classData = payload?.classData || {};
  const activity = payload?.activity || {};
  const student = payload?.student || {};
  const scoreValue = Number(payload?.score);
  const maxScore = Number(activity?.maxScore);

  const classId = String(classData.id || '').trim();
  const activityId = String(activity.id || '').trim();
  const studentId = String(student.id || '').trim();
  const componentType = getScoreTypeKey(activity.componentType || activity.type || '');
  const activityTitle = String(activity.title || '').trim();

  if (!classId || !activityId || !studentId || !componentType || !activityTitle) {
    throw new Error('Missing class record metadata for score saving.');
  }

  if (!Number.isFinite(scoreValue) || !Number.isFinite(maxScore) || maxScore <= 0 || scoreValue < 0 || scoreValue > maxScore) {
    throw new Error(`Score must be between 0 and ${maxScore}.`);
  }

  const roundedScore = Number(scoreValue.toFixed(2));
  const percentage = Number(((roundedScore / maxScore) * 100).toFixed(2));
  const newAwardedPoints = calculateAcademicPoints(roundedScore, maxScore);
  const scoreKey = `${studentId}::${activityId}`;
  const existingScore = currentClassRecordScores.get(scoreKey);
  const scoreRef = existingScore?.id ? doc(db, 'scores', existingScore.id) : doc(collection(db, 'scores'));
  const pointLogId = buildAcademicPointLogId(classId, activityId, studentId);
  const pointLogRef = doc(db, 'pointLogs', pointLogId);
  const studentRef = doc(db, 'students', studentId);
  const sectionId = String(classData.sectionId || '').trim();
  const sectionRef = sectionId ? doc(db, 'sections', sectionId) : null;
  const teacherId = String(auth.currentUser?.uid || '').trim();
  const teacherName = safeText(currentTeacherProfile?.displayName, 'Unknown Teacher');
  const studentName = formatFullName(student);

  const transactionResult = await runTransaction(db, async (transaction) => {
    const [studentSnap, pointLogSnap, sectionSnap] = await Promise.all([
      transaction.get(studentRef),
      transaction.get(pointLogRef),
      sectionRef ? transaction.get(sectionRef) : Promise.resolve(null)
    ]);

    if (!studentSnap.exists()) {
      throw new Error('Student record does not exist.');
    }
    if (sectionRef && !sectionSnap?.exists()) {
      throw new Error('Section record does not exist.');
    }

    const studentData = studentSnap.data() || {};
    const existingPointLog = pointLogSnap.exists() ? pointLogSnap.data() || {} : {};
    const previousAwardedPoints = Number.isFinite(Number(existingPointLog.awardedPoints))
      ? Number(existingPointLog.awardedPoints)
      : 0;
    const pointDifference = newAwardedPoints - previousAwardedPoints;

    console.log({
      studentId,
      previousAwardedPoints,
      newAwardedPoints,
      pointDifference
    });

    const existingStudentPoints = normalizePoints(studentData.points);
    const nextStudentPoints = existingStudentPoints + pointDifference;

    const scoreDocPayload = {
      classId,
      studentId,
      activityId,
      teacherId,
      teacherName,
      score: roundedScore,
      maxScore,
      type: componentType,
      componentType,
      title: activityTitle,
      updatedAt: serverTimestamp(),
      createdAt: existingScore?.createdAt || serverTimestamp()
    };

    const pointLogPayload = {
      studentId,
      studentName,
      classId,
      activityId,
      activityTitle,
      componentType,
      score: roundedScore,
      maxScore,
      percentage,
      awardedPoints: newAwardedPoints,
      previousAwardedPoints,
      pointDifference,
      source: 'academic',
      teacherId,
      teacherName,
      sectionId,
      sectionName: safeText(classData.sectionName, ''),
      schoolYearId: safeText(classData.schoolYearId, ''),
      schoolYearName: safeText(classData.schoolYearName, ''),
      termId: safeText(classData.termId, ''),
      termName: safeText(classData.termName, ''),
      updatedAt: serverTimestamp(),
      createdAt: pointLogSnap.exists() ? existingPointLog.createdAt || serverTimestamp() : serverTimestamp()
    };

    transaction.set(scoreRef, scoreDocPayload, { merge: true });
    transaction.set(pointLogRef, pointLogPayload, { merge: true });

    if (pointDifference !== 0) {
      transaction.update(studentRef, { points: nextStudentPoints });

      if (sectionRef && sectionSnap?.exists()) {
        const sectionData = sectionSnap.data() || {};
        const currentSectionTotalPoints = normalizePoints(sectionData.totalPoints);
        transaction.update(sectionRef, { totalPoints: currentSectionTotalPoints + pointDifference });
      }
    }

    return {
      scoreId: scoreRef.id,
      scorePayload: scoreDocPayload,
      pointDifference
    };
  });

  const updatedScore = {
    ...(existingScore || {}),
    ...transactionResult.scorePayload,
    id: transactionResult.scoreId
  };

  currentClassRecordScores.set(scoreKey, updatedScore);

  return transactionResult;
}

async function saveClassRecordScore(inputElement, options = {}) {
  if (!(inputElement instanceof HTMLInputElement)) return { ok: false, skipped: true };

  const { lockInputAfterSave = true } = options;
  const classId = String(currentClassRecordClassId || '').trim();
  const studentId = String(inputElement.dataset.studentId || '').trim();
  const activityId = String(inputElement.dataset.activityId || '').trim();
  const maxScore = Number(inputElement.dataset.maxScore);
  const componentType = getScoreTypeKey(inputElement.dataset.componentType || '');
  const title = String(inputElement.dataset.title || '').trim();
  const rawValue = String(inputElement.value || '').trim();
  const previousSavedValue = String(inputElement.dataset.lastSaved || '').trim();

  if (!classId || !studentId || !activityId || !Number.isFinite(maxScore) || !componentType || !title) {
    return { ok: false, skipped: true };
  }

  if (!rawValue) {
    const hasSavedValue = previousSavedValue !== '';
    if (hasSavedValue) {
      inputElement.value = previousSavedValue;
      setClassRecordMessage('Empty score is allowed only when no score has been recorded yet.', 'error');
      return { ok: false, skipped: false };
    }

    return { ok: true, skipped: true };
  }

  const scoreValue = Number(rawValue);
  if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > maxScore) {
    setClassRecordMessage(`Score must be between 0 and ${maxScore}.`, 'error');
    inputElement.value = previousSavedValue;
    return { ok: false, skipped: false };
  }

  const roundedScore = Number(scoreValue.toFixed(2));
  if (String(roundedScore) === previousSavedValue) {
    return { ok: true, skipped: true };
  }

  const student = currentClassRecordStudents.find((item) => item.id === studentId);
  const selectedClass = teacherClasses.find((classItem) => classItem.id === classId) || {};

  if (lockInputAfterSave) {
    inputElement.disabled = true;
  }

  try {
    await saveScoreWithAcademicPoints({
      classData: { id: classId, ...selectedClass },
      activity: { id: activityId, componentType, title, maxScore },
      student: { ...(student || {}), id: studentId },
      score: roundedScore
    });

    inputElement.dataset.lastSaved = String(roundedScore);
    inputElement.value = String(roundedScore);
    setClassRecordMessage(`Saved score for ${safeText(formatFullName(student), 'student')} (${title}).`, 'success');
    return { ok: true, skipped: false };
  } catch (error) {
    console.error('Failed to save class record score:', error);
    setClassRecordMessage('Unable to save score right now. Please try again.', 'error');
    inputElement.value = previousSavedValue;
    return { ok: false, skipped: false };
  } finally {
    if (lockInputAfterSave) {
      inputElement.disabled = false;
    }
  }
}

function downloadCSV() {
  if (!currentClassRecordStudents.length) {
    setClassRecordMessage('No class record data to download.', 'error');
    return;
  }

  const grouped = getActivitiesByComponent(currentClassRecordActivities);
  const orderedActivities = [...grouped.WW, ...grouped.PT, ...grouped.Exam];
  if (!orderedActivities.length) {
    setClassRecordMessage('Add at least one activity before downloading CSV.', 'error');
    return;
  }

  const rows = [
    ['', ...orderedActivities.map((activity) =>
      activity.componentType === 'WW' ? 'Written Works' : activity.componentType === 'PT' ? 'Performance Task' : 'Exam'
    )],
    ['Activities:', ...orderedActivities.map((activity) => safeText(activity.title, ''))],
    ['Name / Highest Possible Score:', ...orderedActivities.map((activity) => activity.maxScore)],
    ...currentClassRecordStudents.map((student) => [
      formatFullName(student),
      ...orderedActivities.map((activity) => {
        const scoreItem = currentClassRecordScores.get(`${student.id}::${activity.id}`);
        return scoreItem && Number.isFinite(Number(scoreItem.score)) ? Number(scoreItem.score) : '';
      })
    ])
  ];

  const csv = rows
    .map((columns) =>
      columns
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeClassName = safeText(currentClassRecordClassName || 'class', 'class').replace(/[^a-z0-9-_]+/gi, '-');

  link.href = url;
  link.download = `class-record-${safeClassName}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setClassRecordMessage('Class record CSV downloaded.', 'success');
}

function printClassRecord() {
  if (!currentClassRecordStudents.length) {
    setClassRecordMessage('No class record data to print.', 'error');
    return;
  }

  const table = classRecordTableElement?.querySelector('table');
  if (!table) {
    setClassRecordMessage('Nothing to print yet.', 'error');
    return;
  }

  const printableTable = table.cloneNode(true);
  printableTable.querySelectorAll('input.class-record-score-input').forEach((input) => {
    const parent = input.parentElement;
    if (!parent) return;
    parent.textContent = String(input.value || '');
  });

  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) {
    setClassRecordMessage('Unable to open print view. Please allow popups and try again.', 'error');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Class Record - ${safeText(currentClassRecordClassName, 'Class')}</title>
      </head>
      <body>
        <h2>Class Record</h2>
        <p><strong>Class:</strong> ${safeText(currentClassRecordClassName, 'Class')}</p>
        ${printableTable.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function loadApprovedEnrollmentsByClass(classId) {
  if (!classId) return [];

  const enrollmentSnapshot = await getDocs(
    query(collection(db, 'classEnrollments'), where('classId', '==', classId), where('status', '==', 'approved'))
  );

  return enrollmentSnapshot.docs.map((enrollmentDoc) => ({ id: enrollmentDoc.id, ...enrollmentDoc.data() }));
}

async function loadStudentsFromApprovedEnrollments(classId) {
  const enrollments = await loadApprovedEnrollmentsByClass(classId);
  const uniqueStudentIds = [...new Set(enrollments.map((item) => String(item.studentId || '').trim()).filter(Boolean))];

  if (!uniqueStudentIds.length) {
    return [];
  }

  const studentSnapshots = await Promise.all(uniqueStudentIds.map((studentId) => getDoc(doc(db, 'students', studentId))));

  return studentSnapshots
    .filter((studentSnap) => studentSnap.exists())
    .map((studentSnap) => {
      const data = studentSnap.data();
      return {
        id: studentSnap.id,
        ...data,
        points: normalizePoints(data.points)
      };
    })
    .sort(compareStudents);
}

async function createClass() {
  const teacher = auth.currentUser;

  if (!teacher?.uid) {
    setClassMessage('You must be logged in to create a class.', 'error');
    return;
  }

  const subjectId = String(classSubjectElement?.value || '').trim();
  const schoolYearId = String(classSchoolYearElement?.value || '').trim();
  const termId = String(classTermElement?.value || '').trim();
  const sectionId = String(classSectionElement?.value || '').trim();

  if (!subjectId || !schoolYearId || !termId || !sectionId) {
    setClassMessage('Subject, School Year, Term, and Section are required.', 'error');
    return;
  }

  const subject = classSubjects.find((item) => item.id === subjectId);
  const schoolYear = classSchoolYears.find((item) => item.id === schoolYearId);
  const term = classTerms.find((item) => item.id === termId);
  const section = classSections.find((item) => item.id === sectionId);

  if (!subject || !schoolYear || !term || !section) {
    setClassMessage('Please select valid active options from all dropdowns.', 'error');
    return;
  }

  const duplicateSnapshot = await getDocs(
    query(
      collection(db, 'classes'),
      where('teacherId', '==', teacher.uid),
      where('subjectId', '==', subjectId),
      where('sectionId', '==', sectionId),
      where('schoolYearId', '==', schoolYearId),
      where('termId', '==', termId)
    )
  );

  if (!duplicateSnapshot.empty) {
    setClassMessage('This class already exists for the selected subject, section, school year, and term.', 'error');
    return;
  }

  const teacherName =
    String(currentTeacherProfile?.displayName || '').trim() || String(teacher.displayName || '').trim() || 'Unknown Teacher';
  const teacherEmail = String(currentTeacherProfile?.email || teacher.email || '').trim();

  if (createClassButton) {
    createClassButton.disabled = true;
    createClassButton.textContent = 'Creating...';
  }

  try {
    await addDoc(collection(db, 'classes'), {
      subjectId,
      subjectName: subject.name,
      subjectCode: safeText(subject.code, ''),
      subjectCategory: safeText(subject.category, ''),
      sectionId,
      sectionName: section.name,
      gradeLevel: safeText(section.gradeLevel, ''),
      schoolYearId,
      schoolYearName: schoolYear.name,
      termId,
      termName: term.name,
      teacherId: teacher.uid,
      teacherName,
      teacherEmail,
      status: 'active',
      createdAt: serverTimestamp()
    });

    if (classSubjectElement) classSubjectElement.value = '';
    if (classSchoolYearElement) classSchoolYearElement.value = '';
    if (classTermElement) classTermElement.value = '';
    if (classSectionElement) classSectionElement.value = '';

    setClassMessage('Class created successfully.', 'success');
    await loadMyClasses();
  } catch (error) {
    console.error('Failed to create class:', error);
    setClassMessage('Unable to create class. Please try again.', 'error');
  } finally {
    if (createClassButton) {
      createClassButton.disabled = false;
      createClassButton.textContent = 'Create Class';
    }
  }
}

async function ensureStudentsLoadedForScores() {
  if (allStudents.length > 0) {
    return true;
  }

  const loaded = await loadStudents({ showStatusMessage: false, classId: selectedScoreClassId });
  if (!loaded) {
    setScoreMessage('Unable to load students. Please try again.', 'error');
    return false;
  }

  return true;
}

async function loadStudentsForScores() {
  if (!scoreClassFilterElement) return;

  const classId = scoreClassFilterElement.value;
  if (!classId) {
    setScoreMessage('Select a class first.', 'error');
    return;
  }

  const hasStudents = await ensureStudentsLoadedForScores();
  if (!hasStudents) return;

  if (loadScoreStudentsButton) {
    loadScoreStudentsButton.disabled = true;
    loadScoreStudentsButton.textContent = 'Loading...';
  }

  try {
    selectedScoreClassId = classId;
    const loaded = await loadStudents({ showStatusMessage: false, classId, silent: true });

    if (!loaded) {
      setScoreMessage('Unable to load students for the selected class.', 'error');
      return;
    }

    scoreStudents = [...allStudents];
    renderScoreStudentsTable();

    if (!scoreStudents.length) {
      setScoreMessage('No approved enrolled students found for the selected class.', 'error');
      return;
    }

    setScoreMessage(`Loaded ${scoreStudents.length} students for the selected class.`, 'success');
  } finally {
    if (loadScoreStudentsButton) {
      loadScoreStudentsButton.disabled = false;
      loadScoreStudentsButton.textContent = 'Load Students';
    }
  }
}

function collectScoreInputs() {
  if (!scoresTableBody) return [];

  const maxScore = Number(scoreMaxElement?.value);
  const scoreInputs = Array.from(scoresTableBody.querySelectorAll('input[data-score-student-id]'));

  return scoreInputs
    .map((input) => {
      const rawValue = String(input.value || '').trim();
      if (!rawValue) return null;

      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0) return null;
      if (Number.isFinite(maxScore) && maxScore > 0 && value > maxScore) return null;

      const studentId = input.dataset.scoreStudentId || '';
      const student = scoreStudents.find((item) => item.id === studentId);

      if (!student) return null;

      return {
        student,
        score: value
      };
    })
    .filter(Boolean);
}

async function saveAllScores() {
  if (!saveScoresButton) return;

  const classId = String(scoreClassFilterElement?.value || '').trim();
  const type = String(scoreTypeElement?.value || '').trim();
  const title = String(scoreTitleElement?.value || '').trim();
  const maxScore = Number(scoreMaxElement?.value);

  if (!classId) {
    setScoreMessage('Select a class first.', 'error');
    return;
  }

  if (!type) {
    setScoreMessage('Please select a score type.', 'error');
    return;
  }

  if (!title) {
    setScoreMessage('Please enter an activity title.', 'error');
    return;
  }

  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    setScoreMessage('Please enter a valid max score.', 'error');
    return;
  }

  if (!scoreStudents.length) {
    setScoreMessage('Please load students for the selected class.', 'error');
    return;
  }

  const enteredScores = collectScoreInputs();

  if (!enteredScores.length) {
    setScoreMessage('Enter at least one student score before saving.', 'error');
    return;
  }

  const invalidInputExists = Array.from(scoresTableBody.querySelectorAll('input[data-score-student-id]')).some((input) => {
    const rawValue = String(input.value || '').trim();
    if (!rawValue) return false;

    const value = Number(rawValue);
    return !Number.isFinite(value) || value < 0 || value > maxScore;
  });

  if (invalidInputExists) {
    setScoreMessage('One or more scores are invalid. Check values and max score.', 'error');
    return;
  }

  const teacherId = auth.currentUser?.uid || '';
  const teacherName =
    String(currentTeacherProfile?.displayName || '').trim() ||
    String(currentTeacherProfile?.email || '').trim() ||
    'Unknown Teacher';
  const teacherEmail = String(currentTeacherProfile?.email || auth.currentUser?.email || '').trim();
  const selectedClass = teacherClasses.find((classItem) => classItem.id === classId);

  saveScoresButton.disabled = true;
  saveScoresButton.textContent = 'Saving...';

  try {
    await Promise.all(
      enteredScores.map(({ student, score }) =>
        addDoc(collection(db, 'scores'), {
          classId,
          className: formatClassLabel(selectedClass || {}),
          studentId: student.id,
          studentName: formatFullName(student),
          lrn: safeText(student.lrn, ''),
          section: safeText(selectedClass?.sectionName || student.section, ''),
          gradeLevel: safeText(student.gradeLevel, ''),
          type,
          title,
          score,
          maxScore,
          teacherId,
          teacherName,
          teacherEmail,
          createdAt: serverTimestamp()
        })
      )
    );

    Array.from(scoresTableBody.querySelectorAll('input[data-score-student-id]')).forEach((input) => {
      input.value = '';
    });

    setScoreMessage(`Saved ${enteredScores.length} score record(s).`, 'success');
  } catch (error) {
    console.error('Failed to save scores:', error);
    setScoreMessage('Unable to save scores. Please try again.', 'error');
  } finally {
    saveScoresButton.disabled = false;
    saveScoresButton.textContent = 'Save All Scores';
  }
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
            <input id="student-${student.id}" type="checkbox" data-student-id="${student.id}" aria-label="Select student" />
          </td>
          <td>${formatFullName(student)}</td>
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
  if (!searchInput) return [];
  const keyword = searchInput.value.trim().toLowerCase();

  return allStudents.filter((student) => {
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
  return students;
}

async function loadStudents({ showStatusMessage = true, silent = false, classId = '' } = {}) {
  if (!tableBody) return false;
  const activeClassId = String(classId || selectedTeacherClassId || '').trim();

  if (!activeClassId) {
    allStudents = [];
    visibleStudents = [];
    renderTableRows();
    scoreStudents = [];
    renderScoreStudentsTable('Select a class first.');
    if (showStatusMessage) {
      setMessage('Select a class first.', 'error');
    }
    return false;
  }

  if (!silent) {
    setMessage('Loading students...');
    tableBody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Loading students...</td>
      </tr>
    `;
  }

  if (loadStudentsButton) {
    loadStudentsButton.disabled = true;
    loadStudentsButton.textContent = 'Loading...';
  }

  try {
    allStudents = await loadStudentsFromApprovedEnrollments(activeClassId);
    populateSectionFilter(allStudents);

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
    let teacherName = safeText(currentTeacherProfile?.displayName, 'Unknown Teacher');

    if (teacherUid) {
      const teacherRef = doc(db, 'teachers', teacherUid);
      const teacherSnap = await getDoc(teacherRef);

      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        teacherName = buildTeacherFullName(teacherData, teacherName);
      }
    }

    const updates = selectedIds.map(async (studentId) => {
      const studentRef = doc(db, 'students', studentId);
      const current = allStudents.find((student) => student.id === studentId);
      const currentPoints = normalizePoints(current?.points);

      await updateDoc(studentRef, { points: currentPoints + delta });

      await addDoc(collection(db, 'pointLogs'), {
        classId: selectedTeacherClassId,
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

    if (targetPage === 'my-classes' && auth.currentUser?.uid) {
      loadMyClasses();
    }

    if (targetPage === 'class-record' && auth.currentUser?.uid) {
      loadClassRecordClasses();
    }

    if (targetPage === 'enrollment-requests' && auth.currentUser?.uid) {
      loadEnrollmentRequests();
    }
  });
});

burgerButton?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

loadStudentsButton?.addEventListener('click', () => {
  const classId = String(teacherClassFilterElement?.value || '').trim();
  selectedTeacherClassId = classId;
  loadStudents({ classId });
});

teacherClassFilterElement?.addEventListener('change', () => {
  selectedTeacherClassId = String(teacherClassFilterElement?.value || '').trim();

  if (!selectedTeacherClassId) {
    allStudents = [];
    visibleStudents = [];
    renderTableRows();
    setMessage('Select a class first.', 'error');
    return;
  }

  loadStudents({ classId: selectedTeacherClassId });
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

loadScoreStudentsButton?.addEventListener('click', () => {
  loadStudentsForScores();
});

scoreClassFilterElement?.addEventListener('change', () => {
  selectedScoreClassId = String(scoreClassFilterElement?.value || '').trim();

  if (!selectedScoreClassId) {
    scoreStudents = [];
    renderScoreStudentsTable('Select a class first.');
    setScoreMessage('Select a class first.', '');
    return;
  }

  loadStudentsForScores();
});


classRecordFilterElement?.addEventListener('change', () => {
  const classId = String(classRecordFilterElement.value || '').trim();
  loadClassRecord(classId);
});

classRecordAddActivityButton?.addEventListener('click', () => {
  addClassRecordActivity();
});

classRecordTableElement?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editButton = target.closest('button[data-activity-edit-btn]');
  if (!(editButton instanceof HTMLButtonElement)) return;

  const activityId = String(editButton.dataset.activityEditBtn || '').trim();
  if (!activityId) return;

  toggleClassRecordActivityEdit(activityId);
});

classRecordTableElement?.addEventListener('keydown', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains('class-record-score-input')) return;
  if (event.key !== 'Enter') return;

  event.preventDefault();

  const activityId = String(target.dataset.activityId || '').trim();
  if (!activityId || currentEditingActivityId !== activityId) return;

  const columnInputs = getClassRecordColumnInputs(activityId);
  const currentIndex = columnInputs.findIndex((input) => input === target);
  if (currentIndex < 0) return;

  const nextInput = columnInputs[currentIndex + 1];
  if (nextInput) {
    nextInput.focus();
    nextInput.select();
    return;
  }

  await toggleClassRecordActivityEdit(activityId);
});

classRecordTableElement?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains('class-record-score-input')) return;
  const activityId = String(target.dataset.activityId || '').trim();
  if (!activityId || currentEditingActivityId !== activityId) return;

  const rawValue = String(target.value || '').trim();
  if (!rawValue) return;

  const scoreValue = Number(rawValue);
  const maxScore = Number(target.dataset.maxScore);
  if (!Number.isFinite(scoreValue) || !Number.isFinite(maxScore)) return;

  if (scoreValue < 0) {
    target.value = '0';
    return;
  }

  if (scoreValue > maxScore) {
    target.value = String(maxScore);
  }
});

classRecordDownloadButton?.addEventListener('click', () => {
  downloadCSV();
});

classRecordPrintButton?.addEventListener('click', () => {
  printClassRecord();
});

classRecordMaxScoreElement?.addEventListener('input', () => {
  if (!classRecordMaxScoreElement) return;
  const value = Number(classRecordMaxScoreElement.value);
  if (Number.isFinite(value) && value < 0) {
    classRecordMaxScoreElement.value = '';
  }
});

enrollmentClassFilterElement?.addEventListener('change', () => {
  loadEnrollmentRequests(String(enrollmentClassFilterElement.value || '').trim());
});

enrollmentRequestsListElement?.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest('button[data-enrollment-action][data-enrollment-id]');
  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = actionButton.dataset.enrollmentAction;
  const enrollmentId = actionButton.dataset.enrollmentId || '';

  actionButton.disabled = true;

  if (action === 'approve') {
    approveEnrollmentRequest(enrollmentId).finally(() => {
      actionButton.disabled = false;
    });
    return;
  }

  if (action === 'reject') {
    rejectEnrollmentRequest(enrollmentId).finally(() => {
      actionButton.disabled = false;
    });
  }
});

saveScoresButton?.addEventListener('click', () => {
  saveAllScores();
});
createClassButton?.addEventListener('click', () => {
  createClass();
});

scoreMaxElement?.addEventListener('input', () => {
  if (!scoreMaxElement) return;
  const value = Number(scoreMaxElement.value);
  if (Number.isFinite(value) && value < 0) {
    scoreMaxElement.value = '';
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
    const status = String(userData.status || '').trim();

    if (role !== 'teacher' || status !== 'active') {
      window.location.replace('dashboard.html');
      return;
    }

    const displayEmail = userData.email || user.email || 'No email available';
    const teacherRef = doc(db, 'teachers', user.uid);
    const teacherSnap = await getDoc(teacherRef);
    const teacherData = teacherSnap.exists() ? teacherSnap.data() || {} : {};
    const displayName = buildTeacherFullName(
      {
        firstName: teacherData.firstName ?? userData.firstName,
        middleName: teacherData.middleName ?? userData.middleName,
        lastName: teacherData.lastName ?? userData.lastName
      },
      'Unknown Teacher'
    );

    currentTeacherProfile = {
      displayName,
      email: displayEmail
    };

    if (adminEmailElement) {
      adminEmailElement.textContent = displayEmail;
    }

    if (sidebarTeacherNameElement) {
      sidebarTeacherNameElement.textContent = displayName;
    }

    setMessage('Teacher access granted.', 'success');

    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Loading students...</td>
        </tr>
      `;
    }

    renderScoreStudentsTable('Select a class first.');
    setScoreMessage('Select class, type, title, then enter scores.', '');
    setClassMessage('Create and manage your own classes here.', '');
    setEnrollmentMessage('Review pending enrollment requests for your classes.', '');
    renderClassRecordTable([], [], new Map(), 'Select a class first.');
    setClassRecordMessage('Select a class first.', '');

    await loadTeacherClassesForSelection();
    await loadClassRecordClasses();
    await Promise.all([
      loadSubjectsForClassForm(),
      loadSchoolYearsForClassForm(),
      loadTermsForClassForm(),
      loadSectionsForClassForm()
    ]);
    await loadMyClasses();
    await loadEnrollmentRequests();
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

window.addEventListener('load', () => {
  showLoadingOverlay('Initializing C.O.T.E System...');
  playLoadingSequence(['Initializing C.O.T.E System...', 'Loading Faculty Console...', 'Syncing Records...'], 380).then(
    async () => {
      await wait(190);
      hideLoadingOverlay();
    }
  );
});
