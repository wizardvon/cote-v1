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
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  setDoc
} from './firebase.js';
import { checkAchievements, seedAchievementsIfEmpty } from './achievements.js';
import {
  createQuest,
  getQuestsForUser,
  updateQuest,
  deleteQuest,
  getQuestAssignmentCounts,
  getQuestAssignments,
  completeQuestForStudent,
  isQuestPastDeadline
} from './quests.js';
import { initMessagingUI, refreshConversations, startMessagingAutoRefresh } from './messaging-ui.js';
import {
  buildStudentNotificationPayload,
  createStudentNotifications,
  getApprovedClassStudentIds,
  getAllStudentIds
} from './notifications.js';

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
const teacherLeaderboardPreviewElement = document.getElementById('teacher-leaderboard-preview');
const teacherRankPreviewClassFilterElement = document.getElementById('teacher-rank-preview-class-filter');
const teacherStudentRankPreviewBodyElement = document.getElementById('teacher-student-rank-preview-body');
const resourceClassIdElement = document.getElementById('resource-class-id');
const resourceTitleElement = document.getElementById('resource-title');
const resourceDescriptionElement = document.getElementById('resource-description');
const resourceUrlElement = document.getElementById('resource-url');
const saveResourceButton = document.getElementById('save-resource-button');
const resourceMessageElement = document.getElementById('resource-message');
const resourceYoutubeHintElement = document.getElementById('resource-youtube-hint');
const teacherResourcesListElement = document.getElementById('teacher-resources-list');
const announcementTargetElement = document.getElementById('announcement-target');
const announcementClassIdElement = document.getElementById('announcement-class-id');
const announcementTitleElement = document.getElementById('announcement-title');
const announcementExpiryElement = document.getElementById('announcement-expiry');
const announcementMessageInputElement = document.getElementById('announcement-message');
const saveAnnouncementButton = document.getElementById('save-announcement-button');
const cancelAnnouncementEditButton = document.getElementById('cancel-announcement-edit-button');
const announcementMessageElement = document.getElementById('announcement-message-status');
const teacherAnnouncementsListElement = document.getElementById('teacher-announcements-list');
const teacherQuestTitleElement = document.getElementById('teacher-quest-title');
const teacherQuestDescriptionElement = document.getElementById('teacher-quest-description');
const teacherQuestPointsElement = document.getElementById('teacher-quest-points');
const teacherQuestBadgeElement = document.getElementById('teacher-quest-badge');
const teacherQuestClassElement = document.getElementById('teacher-quest-class');
const teacherQuestDeadlineElement = document.getElementById('teacher-quest-deadline');
const teacherQuestStatusElement = document.getElementById('teacher-quest-status');
const teacherSaveQuestButton = document.getElementById('teacher-save-quest-button');
const teacherCancelQuestEditButton = document.getElementById('teacher-cancel-quest-edit-button');
const teacherQuestMessageElement = document.getElementById('teacher-quest-message');
const teacherQuestsListElement = document.getElementById('teacher-quests-list');
const teacherQuestFormTitleElement = document.getElementById('teacher-quest-form-title');
const teacherCompleteQuestSelectElement = document.getElementById('teacher-complete-quest-select');
const teacherQuestQrPanelElement = document.getElementById('teacher-quest-qr-panel');
const teacherQuestStudentsListElement = document.getElementById('teacher-quest-students-list');
const teacherCompleteSelectedQuestsButton = document.getElementById('teacher-complete-selected-quests-button');
const attendanceClassSelectElement = document.getElementById('attendance-class-select');
const attendanceDateElement = document.getElementById('attendance-date');
const loadAttendanceButton = document.getElementById('load-attendance-button');
const saveAttendanceButton = document.getElementById('save-attendance-button');
const showAttendanceQrButton = document.getElementById('show-attendance-qr-button');
const scanStudentAttendanceQrButton = document.getElementById('scan-student-attendance-qr-button');
const attendanceMessageElement = document.getElementById('attendance-message');
const attendanceQrPanelElement = document.getElementById('attendance-qr-panel');
const attendanceStudentsListElement = document.getElementById('attendance-students-list');
let overlaySequenceJob = 0;

const TABLE_COLUMN_COUNT = 6;

const pageTitles = {
  home: 'Home',
  'give-points': 'Give Points',
  quest: 'Quest',
  resources: 'Resources',
  announcements: 'Announcements',
  messages: 'Messages',
  'my-classes': 'My Classes',
  'class-record': 'Class Record',
  attendance: 'Attendance',
  'enrollment-requests': 'Enrollment Requests'
};
const LAST_PAGE_STORAGE_KEY = 'cote.teacher.lastPage';

function isKnownPage(pageName) {
  return pages.some((page) => page.dataset.page === pageName);
}

function getSavedPage(fallback = 'home') {
  const savedPage = String(localStorage.getItem(LAST_PAGE_STORAGE_KEY) || '').trim();
  return isKnownPage(savedPage) ? savedPage : fallback;
}

function saveCurrentPage(pageName) {
  if (!isKnownPage(pageName)) return;
  localStorage.setItem(LAST_PAGE_STORAGE_KEY, pageName);
}

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
let currentTeacherProfile = null;
let teacherClasses = [];
let selectedTeacherClassId = '';
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
let teacherResources = [];
let teacherAnnouncements = [];
let editingAnnouncementId = '';
let teacherQuests = [];
let teacherQuestBadges = [];
let editingQuestId = '';
let currentQuestStudentRows = [];
let currentAttendanceStudents = [];
let currentAttendanceRecords = new Map();
let currentAttendanceDates = [];

const ATTENDANCE_STATUSES = [
  { code: 'P', label: 'Present', value: 'present' },
  { code: 'A', label: 'Absent', value: 'absent' },
  { code: 'L', label: 'Late', value: 'late' },
  { code: 'O', label: 'Others', value: 'others' }
];

function normalizePoints(points) {
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

function getTierFromRank(rank) {
  if (rank === 1) return 'Class A';
  if (rank === 2) return 'Class B';
  if (rank === 3) return 'Class C';
  if (rank === 4) return 'Class D';
  return 'Class E';
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

function setResourceMessage(message, type = '') {
  if (!resourceMessageElement) return;
  resourceMessageElement.textContent = message;
  resourceMessageElement.classList.remove('success', 'error');
  if (type) {
    resourceMessageElement.classList.add(type);
  }
}

function setAnnouncementMessage(message, type = '') {
  if (!announcementMessageElement) return;
  announcementMessageElement.textContent = message;
  announcementMessageElement.classList.remove('success', 'error');
  if (type) {
    announcementMessageElement.classList.add(type);
  }
}

function setTeacherQuestMessage(message, type = '') {
  if (!teacherQuestMessageElement) return;
  teacherQuestMessageElement.textContent = message;
  teacherQuestMessageElement.classList.remove('success', 'error');
  if (type) {
    teacherQuestMessageElement.classList.add(type);
  }
}

function dateInputToEndOfDay(value) {
  const dateText = String(value || '').trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T23:59:59`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function timestampToDateInputValue(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  if (!date || !Number.isFinite(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestampToDateTimeInputValue(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : value ? new Date(value) : null);
  if (!date || !Number.isFinite(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatQuestDeadline(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : value ? new Date(value) : null);
  if (!date || !Number.isFinite(date.getTime())) return 'No deadline';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatTimestampDate(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  if (!date || !Number.isFinite(date.getTime())) return 'No expiry';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isAnnouncementExpired(announcement = {}) {
  const expiryDate = announcement.expiresAt?.toDate?.();
  return Boolean(expiryDate && expiryDate.getTime() < Date.now());
}

function setAnnouncementEditMode(announcement = null) {
  editingAnnouncementId = announcement?.id || '';

  if (announcementTargetElement) {
    announcementTargetElement.value = announcement?.target || 'all';
  }
  if (announcementClassIdElement) {
    announcementClassIdElement.value = announcement?.target === 'class' ? announcement.classId || '' : '';
  }
  if (announcementTitleElement) {
    announcementTitleElement.value = announcement?.title || '';
  }
  if (announcementExpiryElement) {
    announcementExpiryElement.value = timestampToDateInputValue(announcement?.expiresAt);
  }
  if (announcementMessageInputElement) {
    announcementMessageInputElement.value = announcement?.message || '';
  }
  if (saveAnnouncementButton) {
    saveAnnouncementButton.textContent = editingAnnouncementId ? 'Update Announcement' : 'Post Announcement';
  }
  if (cancelAnnouncementEditButton) {
    cancelAnnouncementEditButton.hidden = !editingAnnouncementId;
  }
}

function clearAnnouncementForm() {
  setAnnouncementEditMode(null);
}

function renderTeacherSectionLeaderboardPreview(records) {
  if (!teacherLeaderboardPreviewElement) return;

  if (!records.length) {
    teacherLeaderboardPreviewElement.innerHTML = '<p>No section leaderboard data available yet.</p>';
    return;
  }

  teacherLeaderboardPreviewElement.innerHTML = records
    .slice(0, 8)
    .map((record) => {
      const tierClass = String(record.tier || '').toLowerCase().replace(/\s+/g, '-');
      return `
        <p><strong>${safeText(record.name)}</strong> —
          <span class="tier-pill ${tierClass}">${safeText(record.tier)}</span>
          • ${normalizePoints(record.totalPoints).toLocaleString()} pts • Rank ${record.rank}
        </p>
      `;
    })
    .join('');
}

async function loadTeacherSectionLeaderboardPreview() {
  if (!teacherLeaderboardPreviewElement) return;

  teacherLeaderboardPreviewElement.innerHTML = '<p>Loading section leaderboard...</p>';

  try {
    const activeSchoolYearsSnapshot = await getDocs(query(collection(db, 'schoolYears'), where('status', '==', 'active')));
    const sortedActiveSchoolYears = activeSchoolYearsSnapshot.docs.sort((a, b) => {
      const aTime = a.data()?.createdAt?.toMillis?.() || 0;
      const bTime = b.data()?.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    const schoolYearDoc = sortedActiveSchoolYears[0];

    if (!schoolYearDoc) {
      renderTeacherSectionLeaderboardPreview([]);
      return;
    }

    const sectionsSnapshot = await getDocs(
      query(
        collection(db, 'sections'),
        where('status', '==', 'active'),
        where('schoolYearId', '==', schoolYearDoc.id)
      )
    );

    const ranked = sectionsSnapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }))
      .sort((a, b) => {
        const pointsDelta = normalizePoints(b.totalPoints) - normalizePoints(a.totalPoints);
        if (pointsDelta !== 0) return pointsDelta;
        return safeText(a.name, '').localeCompare(safeText(b.name, ''), undefined, { sensitivity: 'base' });
      })
      .map((record, index) => {
        const rank = index + 1;
        return {
          ...record,
          rank,
          tier: String(record.tier || '').trim() || getTierFromRank(rank)
        };
      });

    renderTeacherSectionLeaderboardPreview(ranked);
  } catch (error) {
    console.error('Failed to load teacher section leaderboard preview:', error);
    teacherLeaderboardPreviewElement.innerHTML = '<p>Unable to load section leaderboard right now.</p>';
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

function compareQuestStudents(a, b) {
  const sexCompare = getSexSortRank(a.sex) - getSexSortRank(b.sex);
  if (sexCompare !== 0) return sexCompare;

  const lastNameCompare = safeText(a.lastName, '').localeCompare(safeText(b.lastName, ''), undefined, {
    sensitivity: 'base'
  });
  if (lastNameCompare !== 0) return lastNameCompare;

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

function showPage(pageName, options = {}) {
  const targetPage = isKnownPage(pageName) ? pageName : 'home';

  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === targetPage);
  });

  menuButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === targetPage);
  });

  if (pageTitleElement) {
    pageTitleElement.textContent = pageTitles[targetPage] || 'Teacher Dashboard';
  }

  if (options.persist !== false) {
    saveCurrentPage(targetPage);
  }

  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function runPageLoaders(pageName) {
  if (pageName === 'my-classes' && auth.currentUser?.uid) {
    loadMyClasses();
  }

  if (pageName === 'class-record' && auth.currentUser?.uid) {
    loadClassRecordClasses();
  }

  if (pageName === 'enrollment-requests' && auth.currentUser?.uid) {
    loadEnrollmentRequests();
  }

  if (pageName === 'resources' && auth.currentUser?.uid) {
    loadTeacherResources();
  }

  if (pageName === 'announcements' && auth.currentUser?.uid) {
    loadTeacherAnnouncements();
  }

  if (pageName === 'quest' && auth.currentUser?.uid) {
    loadTeacherQuests();
  }

  if (pageName === 'attendance' && auth.currentUser?.uid) {
    loadAttendancePage();
  }

  if (pageName === 'messages' && auth.currentUser?.uid) {
    refreshConversations();
  }
}

function formatClassLabel(classItem) {
  const subject = safeText(classItem.subjectName, 'Untitled Subject');
  const section = safeText(classItem.sectionName, 'No Section');
  const term = safeText(classItem.termName, '');
  const schoolYear = safeText(classItem.schoolYearName, '');
  const details = [section, term, schoolYear].filter(Boolean).join(' • ');
  return details ? `${subject} — ${details}` : subject;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAttendanceDate() {
  const value = String(attendanceDateElement?.value || '').trim();
  return value || getLocalDateKey();
}

function makeAttendanceLogId(classId, studentId, dateKey = getAttendanceDate()) {
  return [dateKey, classId, studentId]
    .map((part) => String(part || '').trim().replace(/[^A-Za-z0-9_-]/g, '_'))
    .join('_');
}

function setAttendanceMessage(message, type = '') {
  if (!attendanceMessageElement) return;
  attendanceMessageElement.textContent = message || '';
  attendanceMessageElement.classList.remove('success', 'error');
  if (type) attendanceMessageElement.classList.add(type);
}

function buildClassAttendanceQrPayload(classId, dateKey = getAttendanceDate()) {
  return `cote:attendance-class:${String(classId || '').trim()}:${dateKey}:${auth.currentUser?.uid || ''}`;
}

function normalizeAttendanceStatus(value, fallback = 'absent') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['present', 'absent', 'late', 'others'].includes(normalized)) return normalized;
  if (normalized === 'p') return 'present';
  if (normalized === 'a') return 'absent';
  if (normalized === 'l') return 'late';
  if (normalized === 'o' || normalized === 'other') return 'others';
  return fallback;
}

function getAttendanceRecord(studentId, dateKey) {
  return currentAttendanceRecords.get(`${studentId}::${dateKey}`) || null;
}

function buildAttendanceStatusOptions(value) {
  const normalized = normalizeAttendanceStatus(value);
  return ATTENDANCE_STATUSES
    .map((item) => `<option value="${item.value}" ${item.value === normalized ? 'selected' : ''}>${item.code}</option>`)
    .join('');
}

function extractStudentIdFromAttendanceQr(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (value.startsWith('cote:attendance-student:')) {
    return value.replace('cote:attendance-student:', '').trim();
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed?.type === 'student-attendance') {
      return String(parsed.studentId || '').trim();
    }
  } catch (error) {
    return '';
  }

  return '';
}

function populateAttendanceClassFilter(classes = []) {
  if (!attendanceClassSelectElement) return;

  const previousValue = attendanceClassSelectElement.value;
  const options = classes
    .map((classItem) => `<option value="${escapeHtml(classItem.id)}">${escapeHtml(formatClassLabel(classItem))}</option>`)
    .join('');
  attendanceClassSelectElement.innerHTML = `<option value="">Select a class first</option>${options}`;

  if (previousValue && classes.some((classItem) => classItem.id === previousValue)) {
    attendanceClassSelectElement.value = previousValue;
  }
}

function populateTeacherClassSelectors(classes = []) {
  const selectors = [
    teacherClassFilterElement,
    classRecordFilterElement,
    teacherRankPreviewClassFilterElement,
    teacherQuestClassElement
  ].filter(Boolean);

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

function renderTeacherStudentRankPreviewRows(students = []) {
  if (!teacherStudentRankPreviewBodyElement) return;

  if (!students.length) {
    teacherStudentRankPreviewBodyElement.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">No approved students found for this class.</td>
      </tr>
    `;
    return;
  }

  teacherStudentRankPreviewBodyElement.innerHTML = students
    .map((student) => {
      const studentRank = Number(student.studentRank);
      const sectionRankTotal = Number(student.sectionRankTotal);
      const hasRank = Number.isFinite(studentRank) && studentRank > 0;
      const hasTotal = Number.isFinite(sectionRankTotal) && sectionRankTotal > 0;
      const rankLabel = hasRank && hasTotal ? `#${studentRank} of ${sectionRankTotal}` : 'Not yet assigned';

      return `
        <tr>
          <td>${formatFullName(student)}</td>
          <td>${normalizePoints(student.points)}</td>
          <td>${rankLabel}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadTeacherStudentRankPreview(classId = '') {
  if (!teacherStudentRankPreviewBodyElement) return;

  const selectedClassId = String(classId || teacherRankPreviewClassFilterElement?.value || '').trim();
  if (!selectedClassId) {
    teacherStudentRankPreviewBodyElement.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">Select a class to preview student ranks.</td>
      </tr>
    `;
    return;
  }

  teacherStudentRankPreviewBodyElement.innerHTML = `
    <tr>
      <td colspan="3" class="empty-cell">Loading approved students...</td>
    </tr>
  `;

  try {
    const students = await loadStudentsFromApprovedEnrollments(selectedClassId);
    const sorted = [...students].sort((a, b) => {
      const rankA = Number(a.studentRank);
      const rankB = Number(b.studentRank);
      const hasRankA = Number.isFinite(rankA) && rankA > 0;
      const hasRankB = Number.isFinite(rankB) && rankB > 0;

      if (hasRankA && hasRankB && rankA !== rankB) return rankA - rankB;
      if (hasRankA !== hasRankB) return hasRankA ? -1 : 1;

      const pointsDelta = normalizePoints(b.points) - normalizePoints(a.points);
      if (pointsDelta !== 0) return pointsDelta;

      return safeText(a.lastName, '').localeCompare(safeText(b.lastName, ''), undefined, { sensitivity: 'base' });
    });

    renderTeacherStudentRankPreviewRows(sorted);
  } catch (error) {
    console.error('Failed to load student rank preview:', error);
    teacherStudentRankPreviewBodyElement.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">Unable to load rank preview right now.</td>
      </tr>
    `;
  }
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

function populateResourceClassFilter(classes = []) {
  if (!resourceClassIdElement) return;

  const previousValue = resourceClassIdElement.value;
  resourceClassIdElement.innerHTML = '<option value="">Select a class first</option>';

  classes.forEach((classItem) => {
    const option = document.createElement('option');
    option.value = classItem.id;
    option.textContent = formatClassLabel(classItem);
    resourceClassIdElement.append(option);
  });

  if (previousValue && classes.some((item) => item.id === previousValue)) {
    resourceClassIdElement.value = previousValue;
  }
}

function populateAnnouncementClassFilter(classes = []) {
  if (!announcementClassIdElement) return;

  const previousValue = announcementClassIdElement.value;
  announcementClassIdElement.innerHTML = '<option value="">Select a class first</option>';

  classes.forEach((classItem) => {
    const option = document.createElement('option');
    option.value = classItem.id;
    option.textContent = formatClassLabel(classItem);
    announcementClassIdElement.append(option);
  });

  if (previousValue && classes.some((item) => item.id === previousValue)) {
    announcementClassIdElement.value = previousValue;
  }
}

function isValidHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function isYouTubeUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;

  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  } catch (_error) {
    return false;
  }
}

function getYouTubeEmbedUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl || !isYouTubeUrl(rawUrl)) return null;

  const match = rawUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&/]|$)/);
  const videoId = match?.[1] || '';
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

function isGoogleDriveUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;

  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname.includes('drive.google.com');
  } catch (_error) {
    return false;
  }
}

function isGoogleSlides(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().includes('docs.google.com') && parsed.pathname.includes('/presentation/');
  } catch (_error) {
    return false;
  }
}

function isGoogleSheets(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().includes('docs.google.com') && parsed.pathname.includes('/spreadsheets/');
  } catch (_error) {
    return false;
  }
}

function isGoogleDocs(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().includes('docs.google.com') && parsed.pathname.includes('/document/');
  } catch (_error) {
    return false;
  }
}

function getDriveFileId(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return null;

  const byPath = rawUrl.match(/\/(?:file|presentation|spreadsheets|document)\/d\/([A-Za-z0-9_-]+)/);
  const byIdParam = rawUrl.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return byPath?.[1] || byIdParam?.[1] || null;
}

function renderResourceMedia(resource) {
  const originalUrl = String(resource?.url || '').trim();
  if (!originalUrl) return '';

  const youtubeEmbedUrl = getYouTubeEmbedUrl(originalUrl);
  if (youtubeEmbedUrl) {
    return `
      <div class="video-wrapper">
        <iframe
          src="${escapeHtml(youtubeEmbedUrl)}"
          title="Embedded Video"
          frameborder="0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      </div>
    `;
  }

  const fileId = getDriveFileId(originalUrl);

  if (isGoogleSlides(originalUrl) && fileId) {
    const slidesEmbedUrl = `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    return `
      <div class="video-wrapper">
        <iframe
          src="${escapeHtml(slidesEmbedUrl)}"
          title="Embedded Resource"
          frameborder="0"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      </div>
    `;
  }

  if (isGoogleSheets(originalUrl) && fileId) {
    const sheetsEmbedUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    return `
      <div class="video-wrapper">
        <iframe
          src="${escapeHtml(sheetsEmbedUrl)}"
          title="Embedded Resource"
          frameborder="0"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      </div>
    `;
  }

  if (isGoogleDocs(originalUrl) && fileId) {
    const docsEmbedUrl = `https://docs.google.com/document/d/${fileId}/preview`;
    return `
      <div class="video-wrapper">
        <iframe
          src="${escapeHtml(docsEmbedUrl)}"
          title="Embedded Resource"
          frameborder="0"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      </div>
    `;
  }

  if (isGoogleDriveUrl(originalUrl) && fileId) {
    const driveEmbedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    return `
      <div class="video-wrapper">
        <iframe
          src="${escapeHtml(driveEmbedUrl)}"
          title="Embedded Resource"
          frameborder="0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin">
        </iframe>
      </div>
    `;
  }

  return `
    <div class="admin-actions">
      <button type="button" data-resource-url="${escapeHtml(originalUrl)}">Open Resource</button>
    </div>
  `;
}

function renderTeacherResources(resources = []) {
  if (!teacherResourcesListElement) return;

  if (!resources.length) {
    teacherResourcesListElement.innerHTML = '<p>No resources yet. Add your first learning link above.</p>';
    return;
  }

  teacherResourcesListElement.innerHTML = resources
    .map((resource) => {
      return `
        <article class="app-card">
          <h4>${safeText(resource.title, 'Untitled Resource')}</h4>
          <p><strong>Subject:</strong> ${safeText(resource.subjectName)}</p>
          <p><strong>Section:</strong> ${safeText(resource.sectionName)}</p>
          <p><strong>School Year:</strong> ${safeText(resource.schoolYearName)}</p>
          <p><strong>Term:</strong> ${safeText(resource.termName)}</p>
          <p><strong>Description:</strong> ${safeText(resource.description, 'No description')}</p>
          ${renderResourceMedia(resource)}
          <p><strong>Status:</strong> ${safeText(resource.status, 'active')}</p>
          <p><strong>Created:</strong> ${formatTimestamp(resource.createdAt)}</p>
          <div class="admin-actions">
            <button type="button" class="danger-button" data-resource-deactivate="${resource.id}" ${
              String(resource.status || '').toLowerCase() !== 'active' ? 'disabled' : ''
            }>
              Deactivate
            </button>
            <button type="button" class="danger-button" data-resource-delete="${resource.id}">
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  teacherResourcesListElement.querySelectorAll('button[data-resource-url]').forEach((button) => {
    button.addEventListener('click', () => {
      const url = String(button.dataset.resourceUrl || '').trim();
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });
}

async function loadTeacherResources() {
  if (!auth.currentUser?.uid || !teacherResourcesListElement) return;

  teacherResourcesListElement.innerHTML = '<p>Loading resources...</p>';

  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(collection(db, 'resources'), where('teacherId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'))
      );
    } catch (error) {
      const fallbackSnapshot = await getDocs(query(collection(db, 'resources'), where('teacherId', '==', auth.currentUser.uid)));
      const docs = [...fallbackSnapshot.docs].sort((a, b) => {
        const aTime = a.data()?.createdAt?.toMillis?.() || 0;
        const bTime = b.data()?.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      snapshot = { docs };
      console.error('Failed to query teacher resources with orderBy:', error);
    }

    teacherResources = snapshot.docs.map((resourceDoc) => ({ id: resourceDoc.id, ...resourceDoc.data() }));
    renderTeacherResources(teacherResources);
  } catch (error) {
    console.error('Failed to load teacher resources:', error);
    teacherResources = [];
    teacherResourcesListElement.innerHTML = '<p>Unable to load resources right now.</p>';
    setResourceMessage('Unable to load your resources. Please try again.', 'error');
  }
}

async function saveResource() {
  const teacher = auth.currentUser;
  if (!teacher?.uid) {
    setResourceMessage('You must be logged in to save resources.', 'error');
    return;
  }

  const classId = String(resourceClassIdElement?.value || '').trim();
  const title = String(resourceTitleElement?.value || '').trim();
  const description = String(resourceDescriptionElement?.value || '').trim();
  const url = String(resourceUrlElement?.value || '').trim();

  if (!classId) {
    setResourceMessage('Select a class first.', 'error');
    return;
  }

  const selectedClass = teacherClasses.find((classItem) => classItem.id === classId);
  if (!selectedClass) {
    setResourceMessage('Invalid class selection.', 'error');
    return;
  }

  if (!title) {
    setResourceMessage('Title is required.', 'error');
    return;
  }

  if (!url || !isValidHttpUrl(url)) {
    setResourceMessage('Enter a valid URL (http/https).', 'error');
    return;
  }

  if (saveResourceButton) {
    saveResourceButton.disabled = true;
    saveResourceButton.textContent = 'Saving...';
  }

  try {
    await addDoc(collection(db, 'resources'), {
      classId,
      teacherId: teacher.uid,
      teacherName: safeText(currentTeacherProfile?.displayName, 'Unknown Teacher'),
      subjectName: safeText(selectedClass.subjectName, ''),
      sectionName: safeText(selectedClass.sectionName, ''),
      schoolYearId: safeText(selectedClass.schoolYearId, ''),
      schoolYearName: safeText(selectedClass.schoolYearName, ''),
      termId: safeText(selectedClass.termId, ''),
      termName: safeText(selectedClass.termName, ''),
      title,
      description,
      resourceType: 'link',
      url,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (resourceTitleElement) resourceTitleElement.value = '';
    if (resourceDescriptionElement) resourceDescriptionElement.value = '';
    if (resourceUrlElement) resourceUrlElement.value = '';

    setResourceMessage('Resource saved successfully.', 'success');
    await loadTeacherResources();
  } catch (error) {
    console.error('Failed to save resource:', error);
    setResourceMessage('Unable to save resource. Please try again.', 'error');
  } finally {
    if (saveResourceButton) {
      saveResourceButton.disabled = false;
      saveResourceButton.textContent = 'Save Resource';
    }
  }
}

async function deactivateResource(resourceId) {
  const id = String(resourceId || '').trim();
  if (!id || !auth.currentUser?.uid) return;

  const matched = teacherResources.find((item) => item.id === id);
  if (!matched || String(matched.teacherId || '').trim() !== auth.currentUser.uid) {
    setResourceMessage('You can only deactivate your own resources.', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'resources', id), {
      status: 'inactive',
      updatedAt: serverTimestamp()
    });
    setResourceMessage('Resource deactivated.', 'success');
    await loadTeacherResources();
  } catch (error) {
    console.error('Failed to deactivate resource:', error);
    setResourceMessage('Unable to deactivate resource. Please try again.', 'error');
  }
}

async function deleteResource(resourceId) {
  const id = String(resourceId || '').trim();
  if (!id || !auth.currentUser?.uid) return;

  const matched = teacherResources.find((item) => item.id === id);
  if (!matched || String(matched.teacherId || '').trim() !== auth.currentUser.uid) {
    setResourceMessage('You can only delete your own resources.', 'error');
    return;
  }

  try {
    await deleteDoc(doc(db, 'resources', id));
    setResourceMessage('Resource deleted.', 'success');
    await loadTeacherResources();
  } catch (error) {
    console.error('Failed to delete resource:', error);
    setResourceMessage('Unable to delete resource. Please try again.', 'error');
  }
}

function renderTeacherAnnouncements(announcements = []) {
  if (!teacherAnnouncementsListElement) return;

  if (!announcements.length) {
    teacherAnnouncementsListElement.innerHTML = '<p>No announcements yet.</p>';
    return;
  }

  teacherAnnouncementsListElement.innerHTML = announcements
    .map((announcement) => {
      const target = safeText(announcement.target, 'all');
      const targetLabel = target === 'class' ? safeText(announcement.classLabel, 'Selected class') : 'All students';
      const status = safeText(announcement.status, 'active');
      const isExpired = isAnnouncementExpired(announcement);
      const displayStatus = isExpired && status === 'active' ? 'expired' : status;
      const isInactive = status !== 'active' || isExpired;

      return `
        <article class="app-card">
          <h4>${escapeHtml(announcement.title || 'Untitled Announcement')}</h4>
          <p><strong>Audience:</strong> ${escapeHtml(targetLabel)}</p>
          <p><strong>Status:</strong> <span class="status-pill ${
            displayStatus === 'active' ? 'status-active' : 'status-pending'
          }">${escapeHtml(displayStatus)}</span></p>
          <p><strong>Expires:</strong> ${escapeHtml(formatTimestampDate(announcement.expiresAt))}</p>
          <p>${escapeHtml(announcement.message || 'No message')}</p>
          <div class="admin-actions">
            <button type="button" data-announcement-edit="${escapeHtml(announcement.id)}">
              Edit
            </button>
            <button type="button" class="danger-button" data-announcement-deactivate="${escapeHtml(
              announcement.id
            )}" ${isInactive ? 'disabled' : ''}>
              Deactivate
            </button>
            <button type="button" class="danger-button" data-announcement-delete="${escapeHtml(announcement.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadTeacherAnnouncements() {
  if (!auth.currentUser?.uid || !teacherAnnouncementsListElement) return;

  teacherAnnouncementsListElement.innerHTML = '<p>Loading announcements...</p>';

  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(
          collection(db, 'teacherAnnouncements'),
          where('teacherId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        )
      );
    } catch (error) {
      const fallbackSnapshot = await getDocs(
        query(collection(db, 'teacherAnnouncements'), where('teacherId', '==', auth.currentUser.uid))
      );
      const docs = [...fallbackSnapshot.docs].sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis?.() || 0;
        const bTime = b.data().createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      snapshot = { docs };
      console.error('Failed to query announcements with orderBy:', error);
    }

    teacherAnnouncements = snapshot.docs.map((announcementDoc) => ({
      id: announcementDoc.id,
      ...announcementDoc.data()
    }));
    renderTeacherAnnouncements(teacherAnnouncements);
  } catch (error) {
    console.error('Failed to load announcements:', error);
    teacherAnnouncements = [];
    teacherAnnouncementsListElement.innerHTML = '<p>Unable to load announcements right now.</p>';
    setAnnouncementMessage('Unable to load announcements. Please try again.', 'error');
  }
}

async function saveAnnouncement() {
  if (!auth.currentUser?.uid) {
    setAnnouncementMessage('You must be logged in to post announcements.', 'error');
    return;
  }

  const target = String(announcementTargetElement?.value || 'all').trim();
  const classId = String(announcementClassIdElement?.value || '').trim();
  const title = String(announcementTitleElement?.value || '').trim();
  const expiryDate = dateInputToEndOfDay(announcementExpiryElement?.value);
  const message = String(announcementMessageInputElement?.value || '').trim();
  const selectedClass = teacherClasses.find((classItem) => classItem.id === classId);

  if (!title) {
    setAnnouncementMessage('Title is required.', 'error');
    return;
  }

  if (!message) {
    setAnnouncementMessage('Message is required.', 'error');
    return;
  }

  if (target === 'class' && !selectedClass) {
    setAnnouncementMessage('Select a class for this announcement.', 'error');
    return;
  }

  if (!expiryDate) {
    setAnnouncementMessage('Expiry date is required.', 'error');
    return;
  }

  try {
    const payload = {
      title,
      message,
      target,
      classId: target === 'class' ? classId : '',
      classIds: target === 'class' ? [classId] : [],
      classLabel: target === 'class' ? formatClassLabel(selectedClass) : '',
      expiresAt: expiryDate,
      teacherId: auth.currentUser.uid,
      teacherName: currentTeacherProfile?.displayName || 'Teacher',
      updatedAt: serverTimestamp()
    };

    if (editingAnnouncementId) {
      const matched = teacherAnnouncements.find((item) => item.id === editingAnnouncementId);
      if (!matched || String(matched.teacherId || '').trim() !== auth.currentUser.uid) {
        setAnnouncementMessage('You can only edit your own announcements.', 'error');
        return;
      }

      if (saveAnnouncementButton) {
        saveAnnouncementButton.disabled = true;
        saveAnnouncementButton.textContent = 'Updating...';
      }

      await updateDoc(doc(db, 'teacherAnnouncements', editingAnnouncementId), payload);
      setAnnouncementMessage('Announcement updated successfully.', 'success');
    } else {
      if (saveAnnouncementButton) {
        saveAnnouncementButton.disabled = true;
        saveAnnouncementButton.textContent = 'Posting...';
      }

      const announcementRef = doc(collection(db, 'teacherAnnouncements'));
      await setDoc(announcementRef, {
        ...payload,
        status: 'active',
        createdAt: serverTimestamp()
      });
      const recipientIds = target === 'class' ? await getApprovedClassStudentIds(classId) : await getAllStudentIds();
      await createStudentNotifications(
        recipientIds,
        () => ({
          title: 'New Announcement',
          message: title,
          type: 'announcement',
          sourceType: 'teacherAnnouncement',
          sourceId: announcementRef.id,
          actionPage: 'home',
          metadata: {
            announcementId: announcementRef.id,
            target,
            classId: target === 'class' ? classId : ''
          }
        }),
        { type: 'announcement', sourceId: announcementRef.id }
      );
      setAnnouncementMessage('Announcement posted successfully.', 'success');
    }

    clearAnnouncementForm();
    await loadTeacherAnnouncements();
  } catch (error) {
    console.error('Failed to save announcement:', error);
    setAnnouncementMessage('Unable to save announcement. Please try again.', 'error');
  } finally {
    if (saveAnnouncementButton) {
      saveAnnouncementButton.disabled = false;
      saveAnnouncementButton.textContent = editingAnnouncementId ? 'Update Announcement' : 'Post Announcement';
    }
  }
}

async function deactivateAnnouncement(announcementId) {
  const id = String(announcementId || '').trim();
  if (!id || !auth.currentUser?.uid) return;

  const matched = teacherAnnouncements.find((item) => item.id === id);
  if (!matched || String(matched.teacherId || '').trim() !== auth.currentUser.uid) {
    setAnnouncementMessage('You can only deactivate your own announcements.', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'teacherAnnouncements', id), {
      status: 'inactive',
      updatedAt: serverTimestamp()
    });
    setAnnouncementMessage('Announcement deactivated.', 'success');
    await loadTeacherAnnouncements();
  } catch (error) {
    console.error('Failed to deactivate announcement:', error);
    setAnnouncementMessage('Unable to deactivate announcement. Please try again.', 'error');
  }
}

async function deleteAnnouncement(announcementId) {
  const id = String(announcementId || '').trim();
  if (!id || !auth.currentUser?.uid) return;

  const matched = teacherAnnouncements.find((item) => item.id === id);
  if (!matched || String(matched.teacherId || '').trim() !== auth.currentUser.uid) {
    setAnnouncementMessage('You can only delete your own announcements.', 'error');
    return;
  }

  try {
    await deleteDoc(doc(db, 'teacherAnnouncements', id));
    setAnnouncementMessage('Announcement deleted.', 'success');
    await loadTeacherAnnouncements();
  } catch (error) {
    console.error('Failed to delete announcement:', error);
    setAnnouncementMessage('Unable to delete announcement. Please try again.', 'error');
  }
}

function populateTeacherQuestBadges() {
  if (!teacherQuestBadgeElement) return;

  const previousValue = teacherQuestBadgeElement.value;
  teacherQuestBadgeElement.innerHTML = '<option value="">No badge</option>';
  teacherQuestBadges
    .filter((badge) => safeText(badge.status, 'active') === 'active')
    .forEach((badge) => {
      const option = document.createElement('option');
      option.value = badge.id;
      option.textContent = badge.name || 'Untitled Badge';
      teacherQuestBadgeElement.append(option);
    });

  if (previousValue && teacherQuestBadges.some((badge) => badge.id === previousValue)) {
    teacherQuestBadgeElement.value = previousValue;
  }
}

async function loadTeacherQuestBadges() {
  try {
    const snapshot = await getDocs(query(collection(db, 'specialBadges'), orderBy('createdAt', 'desc')));
    teacherQuestBadges = snapshot.docs.map((badgeDoc) => ({ id: badgeDoc.id, ...badgeDoc.data() }));
    populateTeacherQuestBadges();
  } catch (error) {
    console.error('Failed to load quest badges:', error);
    teacherQuestBadges = [];
    populateTeacherQuestBadges();
  }
}

function setTeacherQuestEditMode(quest = null) {
  editingQuestId = quest?.id || '';
  if (teacherQuestFormTitleElement) {
    teacherQuestFormTitleElement.textContent = editingQuestId ? 'Edit Quest' : 'Create Quest';
  }
  if (teacherQuestTitleElement) teacherQuestTitleElement.value = quest?.title || '';
  if (teacherQuestDescriptionElement) teacherQuestDescriptionElement.value = quest?.description || '';
  if (teacherQuestPointsElement) teacherQuestPointsElement.value = quest?.points || '';
  if (teacherQuestBadgeElement) teacherQuestBadgeElement.value = quest?.badgeId || '';
  if (teacherQuestClassElement) teacherQuestClassElement.value = Array.isArray(quest?.targetIds) ? quest.targetIds[0] || '' : '';
  if (teacherQuestDeadlineElement) teacherQuestDeadlineElement.value = timestampToDateTimeInputValue(quest?.deadline);
  if (teacherQuestStatusElement) teacherQuestStatusElement.value = quest?.status || 'active';
  if (teacherSaveQuestButton) teacherSaveQuestButton.textContent = editingQuestId ? 'Update Quest' : 'Create Quest';
  if (teacherCancelQuestEditButton) teacherCancelQuestEditButton.hidden = !editingQuestId;
}

function clearTeacherQuestForm() {
  setTeacherQuestEditMode(null);
}

function getTeacherQuestFormPayload() {
  const classId = safeText(teacherQuestClassElement?.value, '');
  return {
    title: safeText(teacherQuestTitleElement?.value, ''),
    description: safeText(teacherQuestDescriptionElement?.value, ''),
    points: Number(teacherQuestPointsElement?.value || 0),
    badgeId: safeText(teacherQuestBadgeElement?.value, ''),
    targetType: 'class',
    targetIds: classId ? [classId] : [],
    deadline: safeText(teacherQuestDeadlineElement?.value, ''),
    status: safeText(teacherQuestStatusElement?.value, 'active')
  };
}

async function saveTeacherQuest() {
  if (!auth.currentUser?.uid) {
    setTeacherQuestMessage('You must be logged in to save quests.', 'error');
    return;
  }

  const payload = getTeacherQuestFormPayload();
  if (!payload.targetIds.length) {
    setTeacherQuestMessage('Select a class for this quest.', 'error');
    return;
  }

  const selectedClass = teacherClasses.find((classItem) => classItem.id === payload.targetIds[0]);
  if (!selectedClass) {
    setTeacherQuestMessage('Select one of your classes.', 'error');
    return;
  }

  if (teacherSaveQuestButton) {
    teacherSaveQuestButton.disabled = true;
    teacherSaveQuestButton.textContent = editingQuestId ? 'Updating...' : 'Creating...';
  }

  try {
    if (editingQuestId) {
      const matched = teacherQuests.find((quest) => quest.id === editingQuestId);
      if (!matched || safeText(matched.createdBy) !== auth.currentUser.uid) {
        setTeacherQuestMessage('You can only edit your own quests.', 'error');
        return;
      }
      await updateQuest(editingQuestId, payload);
      setTeacherQuestMessage('Quest updated successfully.', 'success');
    } else {
      const result = await createQuest(payload);
      setTeacherQuestMessage(`Quest created and assigned to ${result.assignedCount} student(s).`, 'success');
    }

    clearTeacherQuestForm();
    await loadTeacherQuests();
  } catch (error) {
    console.error('Failed to save quest:', error);
    setTeacherQuestMessage(error?.message || 'Unable to save quest. Please try again.', 'error');
  } finally {
    if (teacherSaveQuestButton) {
      teacherSaveQuestButton.disabled = false;
      teacherSaveQuestButton.textContent = editingQuestId ? 'Update Quest' : 'Create Quest';
    }
  }
}

function renderTeacherQuests(quests = [], counts = new Map()) {
  if (!teacherQuestsListElement) return;

  if (!quests.length) {
    teacherQuestsListElement.innerHTML = '<p class="empty-cell">No quests created yet.</p>';
    return;
  }

  teacherQuestsListElement.innerHTML = quests
    .map((quest) => {
      const count = counts.get(quest.id) || { assigned: 0, completed: 0 };
      const classLabel = teacherClasses.find((classItem) => classItem.id === quest.targetIds?.[0]);
      const status = safeText(quest.status, 'active');
      const isExpired = isQuestPastDeadline(quest);
      return `
        <article class="app-card quest-card">
          <div class="quest-card-header">
            <h4>${escapeHtml(quest.title || 'Untitled Quest')}</h4>
            <span class="status-pill ${status === 'active' && !isExpired ? 'status-active' : 'status-pending'}">${
              isExpired && status === 'active' ? 'expired' : escapeHtml(status)
            }</span>
          </div>
          <p>${escapeHtml(quest.description || 'No description')}</p>
          <div class="quest-meta-grid">
            <p><strong>Reward:</strong> ${Number(quest.points || 0)} points${quest.badgeId ? ' + badge' : ''}</p>
            <p><strong>Class:</strong> ${escapeHtml(classLabel ? formatClassLabel(classLabel) : 'Selected class')}</p>
            <p><strong>Deadline:</strong> ${escapeHtml(formatQuestDeadline(quest.deadline))}</p>
            <p><strong>Completed:</strong> ${count.completed} of ${count.assigned}</p>
          </div>
          <div class="admin-actions">
            <button type="button" data-quest-edit="${escapeHtml(quest.id)}">Edit</button>
            <button type="button" data-quest-manage="${escapeHtml(quest.id)}">Manage Students</button>
            <button type="button" class="danger-button" data-quest-delete="${escapeHtml(quest.id)}">Delete</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function populateTeacherCompleteQuestSelect() {
  if (!teacherCompleteQuestSelectElement) return;

  const previousValue = teacherCompleteQuestSelectElement.value;
  teacherCompleteQuestSelectElement.innerHTML = '<option value="">Select a quest first</option>';

  teacherQuests.forEach((quest) => {
    const option = document.createElement('option');
    option.value = quest.id;
    option.textContent = quest.title || 'Untitled Quest';
    teacherCompleteQuestSelectElement.append(option);
  });

  if (previousValue && teacherQuests.some((quest) => quest.id === previousValue)) {
    teacherCompleteQuestSelectElement.value = previousValue;
  }
}

function getStudentQuestQrPayload(questId) {
  const dashboardPath = `${window.location.origin}${window.location.pathname.replace(/admin\.html.*$/i, 'dashboard.html')}`;
  return `${dashboardPath}?questId=${encodeURIComponent(questId)}`;
}

function renderQuestQrPanel(quest = null) {
  if (!teacherQuestQrPanelElement) return;

  if (!quest?.id) {
    teacherQuestQrPanelElement.hidden = true;
    teacherQuestQrPanelElement.innerHTML = '';
    return;
  }

  const payload = getStudentQuestQrPayload(quest.id);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
  teacherQuestQrPanelElement.hidden = false;
  teacherQuestQrPanelElement.innerHTML = `
    <div>
      <h4>Quest QR Code</h4>
      <p>Students can scan this with the Quest scanner to complete the selected quest.</p>
      <p class="quest-qr-code-text">${escapeHtml(payload)}</p>
    </div>
    <img src="${escapeHtml(qrImageUrl)}" alt="QR code for ${escapeHtml(quest.title || 'quest')}" />
  `;
}

function renderTeacherQuestStudents(rows = []) {
  if (!teacherQuestStudentsListElement) return;

  if (!rows.length) {
    teacherQuestStudentsListElement.innerHTML = '<p class="empty-cell">No assigned students found for this quest.</p>';
    return;
  }

  teacherQuestStudentsListElement.innerHTML = rows
    .map((row) => {
      const isCompleted = row.assignment?.status === 'completed';
      return `
        <label class="quest-student-row">
          <input type="checkbox" data-quest-student-id="${escapeHtml(row.id)}" ${isCompleted ? 'disabled' : ''} />
          <span>
            <strong>${escapeHtml(formatFullName(row))}</strong>
            <small>${escapeHtml(safeText(row.sex, 'Unspecified'))} • ${escapeHtml(
              isCompleted ? `Completed ${formatTimestamp(row.assignment?.completedAt)}` : 'Assigned'
            )}</small>
          </span>
        </label>
      `;
    })
    .join('');
}

async function loadTeacherQuestStudents(questId) {
  const quest = teacherQuests.find((item) => item.id === questId);
  if (!quest) {
    currentQuestStudentRows = [];
    renderQuestQrPanel(null);
    renderTeacherQuestStudents([]);
    return;
  }

  renderQuestQrPanel(quest);
  if (teacherQuestStudentsListElement) {
    teacherQuestStudentsListElement.innerHTML = '<p class="empty-cell">Loading assigned students...</p>';
  }

  try {
    const classId = safeText(quest.targetIds?.[0], '');
    const students = await loadStudentsFromApprovedEnrollments(classId);
    const assignments = await getQuestAssignments(quest.id);
    const assignmentMap = new Map(assignments.map((assignment) => [safeText(assignment.studentId), assignment]));

    currentQuestStudentRows = students
      .filter((student) => assignmentMap.has(student.id))
      .map((student) => ({
        ...student,
        assignment: assignmentMap.get(student.id)
      }))
      .sort(compareQuestStudents);

    renderTeacherQuestStudents(currentQuestStudentRows);
  } catch (error) {
    console.error('Failed to load quest students:', error);
    currentQuestStudentRows = [];
    renderTeacherQuestStudents([]);
    setTeacherQuestMessage('Unable to load quest students.', 'error');
  }
}

async function loadTeacherQuests() {
  if (!auth.currentUser?.uid || !teacherQuestsListElement) return;

  teacherQuestsListElement.innerHTML = '<p class="empty-cell">Loading quests...</p>';
  try {
    teacherQuests = await getQuestsForUser(auth.currentUser.uid);
    const counts = await getQuestAssignmentCounts(teacherQuests.map((quest) => quest.id));
    renderTeacherQuests(teacherQuests, counts);
    populateTeacherCompleteQuestSelect();
  } catch (error) {
    console.error('Failed to load teacher quests:', error);
    teacherQuests = [];
    populateTeacherCompleteQuestSelect();
    teacherQuestsListElement.innerHTML = '<p class="empty-cell">Unable to load quests right now.</p>';
    setTeacherQuestMessage('Unable to load quests. Please try again.', 'error');
  }
}

function getCheckedQuestStudentIds() {
  if (!teacherQuestStudentsListElement) return [];
  return Array.from(teacherQuestStudentsListElement.querySelectorAll('input[data-quest-student-id]:checked'))
    .map((input) => input.dataset.questStudentId || '')
    .filter(Boolean);
}

async function completeCheckedQuestStudents() {
  const questId = safeText(teacherCompleteQuestSelectElement?.value, '');
  const selectedStudentIds = getCheckedQuestStudentIds();

  if (!questId) {
    setTeacherQuestMessage('Select a quest first.', 'error');
    return;
  }

  if (!selectedStudentIds.length) {
    setTeacherQuestMessage('Check at least one assigned student.', 'error');
    return;
  }

  if (teacherCompleteSelectedQuestsButton) {
    teacherCompleteSelectedQuestsButton.disabled = true;
    teacherCompleteSelectedQuestsButton.textContent = 'Completing...';
  }

  try {
    const results = await Promise.all(
      selectedStudentIds.map((studentId) =>
        completeQuestForStudent(questId, studentId, {
          completedByName: safeText(currentTeacherProfile?.displayName, 'Teacher')
        })
      )
    );
    const completedCount = results.filter((result) => result.completed).length;
    setTeacherQuestMessage(`Completed quest for ${completedCount} student(s).`, 'success');
    await loadTeacherQuestStudents(questId);
    await loadTeacherQuests();
  } catch (error) {
    console.error('Failed to complete selected quest students:', error);
    setTeacherQuestMessage(error?.message || 'Unable to complete selected students.', 'error');
  } finally {
    if (teacherCompleteSelectedQuestsButton) {
      teacherCompleteSelectedQuestsButton.disabled = false;
      teacherCompleteSelectedQuestsButton.textContent = 'Complete Checked Students';
    }
  }
}

async function deleteTeacherQuest(questId) {
  const id = safeText(questId, '');
  if (!id || !auth.currentUser?.uid) return;

  const matched = teacherQuests.find((quest) => quest.id === id);
  if (!matched || safeText(matched.createdBy) !== auth.currentUser.uid) {
    setTeacherQuestMessage('You can only delete your own quests.', 'error');
    return;
  }

  try {
    await deleteQuest(id);
    setTeacherQuestMessage('Quest deleted.', 'success');
    await loadTeacherQuests();
  } catch (error) {
    console.error('Failed to delete quest:', error);
    setTeacherQuestMessage('Unable to delete quest. Please try again.', 'error');
  }
}

function getSelectedAttendanceClass() {
  const classId = String(attendanceClassSelectElement?.value || '').trim();
  return teacherClasses.find((classItem) => classItem.id === classId) || null;
}

function renderAttendanceStudents(students = []) {
  if (!attendanceStudentsListElement) return;

  if (!students.length) {
    attendanceStudentsListElement.innerHTML = '<p class="empty-cell">No approved students found for this class.</p>';
    return;
  }

  const selectedDate = getAttendanceDate();
  const dates = currentAttendanceDates.includes(selectedDate)
    ? currentAttendanceDates
    : [...currentAttendanceDates, selectedDate].sort();
  attendanceStudentsListElement.innerHTML = `
    <div class="admin-table-wrap attendance-table-wrap" role="region" aria-label="Attendance table" tabindex="0">
      <table class="student-table attendance-table">
        <thead>
          <tr>
            <th scope="col" class="sticky-name-col">Student</th>
            ${dates.map((dateKey) => `<th scope="col" class="${dateKey === selectedDate ? 'attendance-active-date' : ''}">${escapeHtml(dateKey)}</th>`).join('')}
            <th scope="col">P</th>
            <th scope="col">L</th>
            <th scope="col">A</th>
            <th scope="col">O</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map((student) => {
              const totals = { present: 0, late: 0, absent: 0, others: 0 };
              const cells = dates
                .map((dateKey) => {
                  const record = getAttendanceRecord(student.id, dateKey);
                  const status = normalizeAttendanceStatus(record?.status, 'absent');
                  totals[status] += 1;
                  const isEditableDate = dateKey === selectedDate;
                  return `
                    <td>
                      <select
                        class="attendance-status-select"
                        data-attendance-student-id="${escapeHtml(student.id)}"
                        data-attendance-date="${escapeHtml(dateKey)}"
                        ${isEditableDate ? '' : 'disabled'}
                        aria-label="Attendance for ${escapeHtml(formatFullName(student))} on ${escapeHtml(dateKey)}"
                      >
                        ${buildAttendanceStatusOptions(status)}
                      </select>
                    </td>
                  `;
                })
                .join('');

              return `
                <tr>
                  <th scope="row" class="sticky-name-col">
                    <span>${escapeHtml(formatFullName(student) || 'Unnamed Student')}</span>
                    <small>${escapeHtml(safeText(student.sex, 'Unspecified'))}</small>
                  </th>
                  ${cells}
                  <td class="attendance-total">${totals.present}</td>
                  <td class="attendance-total">${totals.late}</td>
                  <td class="attendance-total">${totals.absent}</td>
                  <td class="attendance-total">${totals.others}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="attendance-table-note">Only the selected date column is editable. Totals update after saving or scanning.</p>
  `;
}

function renderAttendanceRecords(records = []) {
  currentAttendanceRecords = new Map();
  currentAttendanceDates = [];
  const dateSet = new Set();

  records.forEach((record) => {
    const studentId = safeText(record.studentId, '');
    const dateKey = safeText(record.attendanceDate, '');
    if (!studentId || !dateKey) return;
    dateSet.add(dateKey);
    currentAttendanceRecords.set(`${studentId}::${dateKey}`, record);
  });

  currentAttendanceDates = [...dateSet].sort();
  renderAttendanceStudents(currentAttendanceStudents);
}

async function loadAttendanceRecords() {
  const selectedClass = getSelectedAttendanceClass();
  if (!selectedClass) {
    renderAttendanceRecords([]);
    return;
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'attendanceLogs'),
      where('classId', '==', selectedClass.id)
    )
  );

  const records = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => {
      const dateCompare = safeText(a.attendanceDate, '').localeCompare(safeText(b.attendanceDate, ''));
      if (dateCompare !== 0) return dateCompare;
      return safeText(a.studentName, '').localeCompare(safeText(b.studentName, ''), undefined, { sensitivity: 'base' });
    });
  renderAttendanceRecords(records);
}

async function loadAttendanceStudents() {
  const selectedClass = getSelectedAttendanceClass();
  if (!selectedClass) {
    setAttendanceMessage('Select a class first.', 'error');
    currentAttendanceStudents = [];
    renderAttendanceStudents([]);
    return;
  }

  setAttendanceMessage('Loading attendance students...');
  try {
    currentAttendanceStudents = (await loadStudentsFromApprovedEnrollments(selectedClass.id)).sort(compareClassRecordStudents);
    await loadAttendanceRecords();
    setAttendanceMessage(`Loaded ${currentAttendanceStudents.length} student(s).`, 'success');
  } catch (error) {
    console.error('Failed to load attendance students:', error);
    currentAttendanceStudents = [];
    currentAttendanceRecords = new Map();
    currentAttendanceDates = [];
    renderAttendanceStudents([]);
    setAttendanceMessage('Unable to load attendance students.', 'error');
  }
}

async function saveManualAttendance() {
  const selectedClass = getSelectedAttendanceClass();
  if (!selectedClass) {
    setAttendanceMessage('Select a class first.', 'error');
    return;
  }

  if (!currentAttendanceStudents.length) {
    await loadAttendanceStudents();
  }

  if (!currentAttendanceStudents.length) {
    setAttendanceMessage('No students to save attendance for.', 'error');
    return;
  }

  const dateKey = getAttendanceDate();
  const statusByStudentId = new Map(
    Array.from(
      attendanceStudentsListElement?.querySelectorAll(
        `select.attendance-status-select[data-attendance-date="${CSS.escape(dateKey)}"]`
      ) || []
    ).map((select) => [select.dataset.attendanceStudentId, normalizeAttendanceStatus(select.value)])
  );

  if (saveAttendanceButton) {
    saveAttendanceButton.disabled = true;
    saveAttendanceButton.textContent = 'Saving...';
  }

  try {
    await Promise.all(
      currentAttendanceStudents.map((student) => {
        const status = statusByStudentId.get(student.id) || 'absent';
        return setDoc(
          doc(db, 'attendanceLogs', makeAttendanceLogId(selectedClass.id, student.id, dateKey)),
          {
            classId: selectedClass.id,
            classLabel: formatClassLabel(selectedClass),
            studentId: student.id,
            studentName: formatFullName(student),
            teacherId: auth.currentUser?.uid || '',
            teacherName: safeText(currentTeacherProfile?.displayName, 'Teacher'),
            attendanceDate: dateKey,
            status,
            method: 'manual',
            recordedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      })
    );

    await loadAttendanceRecords();
    setAttendanceMessage('Attendance saved.', 'success');
  } catch (error) {
    console.error('Failed to save attendance:', error);
    setAttendanceMessage('Unable to save attendance.', 'error');
  } finally {
    if (saveAttendanceButton) {
      saveAttendanceButton.disabled = false;
      saveAttendanceButton.textContent = 'Save Attendance Date';
    }
  }
}

function showClassroomAttendanceQr() {
  const selectedClass = getSelectedAttendanceClass();
  if (!selectedClass || !attendanceQrPanelElement) {
    setAttendanceMessage('Select a class first.', 'error');
    return;
  }

  const dateKey = getAttendanceDate();
  const payload = buildClassAttendanceQrPayload(selectedClass.id, dateKey);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
  attendanceQrPanelElement.hidden = false;
  attendanceQrPanelElement.innerHTML = `
    <div>
      <p>Students scan this QR to mark themselves present for ${escapeHtml(dateKey)}.</p>
      <p class="quest-qr-code-text">${escapeHtml(payload)}</p>
    </div>
    <img src="${escapeHtml(qrImageUrl)}" alt="Attendance QR for ${escapeHtml(formatClassLabel(selectedClass))}" />
  `;
  setAttendanceMessage('Classroom Attendance QR is ready.', 'success');
}

async function recordScannedStudentAttendance(studentId) {
  const selectedClass = getSelectedAttendanceClass();
  if (!selectedClass) {
    setAttendanceMessage('Select a class before scanning student QR codes.', 'error');
    return;
  }

  const normalizedStudentId = safeText(studentId, '');
  if (!normalizedStudentId) {
    setAttendanceMessage('This is not a valid student attendance QR.', 'error');
    return;
  }

  if (!currentAttendanceStudents.length) {
    currentAttendanceStudents = (await loadStudentsFromApprovedEnrollments(selectedClass.id)).sort(compareClassRecordStudents);
    renderAttendanceStudents(currentAttendanceStudents);
  }

  const student = currentAttendanceStudents.find((item) => item.id === normalizedStudentId);
  if (!student) {
    setAttendanceMessage('Scanned student is not approved in this class.', 'error');
    return;
  }

  const dateKey = getAttendanceDate();
  await setDoc(
    doc(db, 'attendanceLogs', makeAttendanceLogId(selectedClass.id, student.id, dateKey)),
    {
      classId: selectedClass.id,
      classLabel: formatClassLabel(selectedClass),
      studentId: student.id,
      studentName: formatFullName(student),
      teacherId: auth.currentUser?.uid || '',
      teacherName: safeText(currentTeacherProfile?.displayName, 'Teacher'),
      attendanceDate: dateKey,
      status: 'present',
      method: 'student_qr',
      recordedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  const checkbox = Array.from(
    attendanceStudentsListElement?.querySelectorAll(
      `select.attendance-status-select[data-attendance-date="${CSS.escape(dateKey)}"]`
    ) || []
  ).find(
    (input) => input.dataset.attendanceStudentId === student.id
  );
  if (checkbox) checkbox.value = 'present';
  await loadAttendanceRecords();
  setAttendanceMessage(`${formatFullName(student)} marked present.`, 'success');
}

async function openStudentAttendanceScanner() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    setAttendanceMessage('Camera scanning is not available on this browser.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'quest-scanner-overlay';
  overlay.innerHTML = `
    <div class="quest-scanner-panel">
      <div class="quest-scanner-header">
        <h3>Scan Student Attendance QR</h3>
        <button type="button" aria-label="Close scanner">Close</button>
      </div>
      <video autoplay playsinline></video>
      <p class="form-message">Point your camera at the student's attendance QR code.</p>
    </div>
  `;
  document.body.append(overlay);

  const video = overlay.querySelector('video');
  const closeButton = overlay.querySelector('button');
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  let stream = null;
  let isClosed = false;

  const closeScanner = () => {
    isClosed = true;
    stream?.getTracks?.().forEach((track) => track.stop());
    overlay.remove();
  };

  closeButton?.addEventListener('click', closeScanner);

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();

    const scanFrame = async () => {
      if (isClosed) return;

      try {
        const codes = await detector.detect(video);
        const rawValue = codes?.[0]?.rawValue || '';
        if (rawValue) {
          closeScanner();
          await recordScannedStudentAttendance(extractStudentIdFromAttendanceQr(rawValue));
          return;
        }
      } catch (error) {
        console.warn('Student attendance scan frame failed:', error);
      }

      window.requestAnimationFrame(scanFrame);
    };

    scanFrame();
  } catch (error) {
    console.error('Failed to open student attendance scanner:', error);
    closeScanner();
    setAttendanceMessage('Unable to open camera scanner.', 'error');
  }
}

async function loadAttendancePage() {
  if (attendanceDateElement && !attendanceDateElement.value) {
    attendanceDateElement.value = getLocalDateKey();
  }
  if (!teacherClasses.length) {
    await loadTeacherClassesForSelection();
  }
  if (attendanceClassSelectElement?.value) {
    await loadAttendanceStudents();
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
  populateResourceClassFilter(teacherClasses);
  populateAnnouncementClassFilter(teacherClasses);
  populateAttendanceClassFilter(teacherClasses);
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
      <table class="student-table class-record-grid">
        <thead>
          <tr>
            <th scope="col" class="sticky-name-col">Student</th>
            ${renderGroupHeader('Written Works', grouped.WW)}
            ${renderGroupHeader('Performance Task', grouped.PT)}
            ${renderGroupHeader('Exam', grouped.Exam)}
          </tr>
          <tr>
            <th scope="col" class="sticky-name-col">Activities</th>
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
    <table class="student-table class-record-grid">
      <thead>
        <tr>
          <th scope="col" class="sticky-name-col">Student</th>
          ${renderGroupHeader('Written Works', grouped.WW)}
          ${renderGroupHeader('Performance Task', grouped.PT)}
          ${renderGroupHeader('Exam', grouped.Exam)}
        </tr>
        <tr>
          <th scope="col" class="sticky-name-col">Activities</th>
          ${orderedActivities.length ? orderedActivities.map(renderActivityHeaderCell).join('') : '<th scope="col">No activities yet</th>'}
        </tr>
      </thead>
      <tbody>
        ${students
          .map(
            (student) => `
              <tr>
                <th scope="row" class="sticky-name-col">${escapeHtml(formatFullName(student))}</th>
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

  if (transactionResult.pointDifference !== 0) {
    await addDoc(collection(db, 'notifications'), buildStudentNotificationPayload({
      studentId,
      title: 'Academic Points Updated',
      message: `${activityTitle}: ${transactionResult.pointDifference > 0 ? '+' : ''}${transactionResult.pointDifference} point(s).`,
      type: 'points',
      sourceType: 'academic',
      sourceId: pointLogId,
      actionPage: 'records',
      metadata: {
        classId,
        activityId,
        pointDifference: transactionResult.pointDifference
      }
    }));
  }

  try {
    await checkAchievements(studentId, {
      triggerType: 'score_update',
      classId,
      activityId,
      sourceId: activityId
    });
    await checkAchievements(studentId, {
      triggerType: 'points_update',
      classId,
      activityId,
      sourceId: activityId
    });
  } catch (achievementError) {
    console.warn('Achievement check skipped after score save:', achievementError);
  }

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
          <td>${
            Number.isFinite(Number(student.studentRank)) &&
            Number(student.studentRank) > 0 &&
            Number.isFinite(Number(student.sectionRankTotal)) &&
            Number(student.sectionRankTotal) > 0
              ? `#${Number(student.studentRank)} of ${Number(student.sectionRankTotal)}`
              : 'Not yet assigned'
          }</td>
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

async function loadStudents({ showStatusMessage = true, classId = '' } = {}) {
  if (!tableBody) return false;
  const activeClassId = String(classId || selectedTeacherClassId || '').trim();

  if (!activeClassId) {
    allStudents = [];
    visibleStudents = [];
    renderTableRows();
    if (showStatusMessage) {
      setMessage('Select a class first.', 'error');
    }
    return false;
  }

  setMessage('Loading students...');
  tableBody.innerHTML = `
    <tr>
      <td colspan="${TABLE_COLUMN_COUNT}" class="empty-cell">Loading students...</td>
    </tr>
  `;

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

      const pointLogRef = await addDoc(collection(db, 'pointLogs'), {
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

      await addDoc(collection(db, 'notifications'), buildStudentNotificationPayload({
        studentId,
        title: action === 'add' ? 'Merit Points Awarded' : 'Demerit Points Added',
        message: `${action === 'add' ? '+' : '-'}${pointValue} point(s): ${reason}`,
        type: 'points',
        sourceType: action === 'add' ? 'merit' : 'demerit',
        sourceId: pointLogRef.id,
        actionPage: 'records',
        metadata: {
          classId: selectedTeacherClassId,
          pointDifference: delta
        }
      }));

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

    await loadTeacherStudentRankPreview();

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
    runPageLoaders(targetPage);
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

teacherRankPreviewClassFilterElement?.addEventListener('change', () => {
  loadTeacherStudentRankPreview();
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

createClassButton?.addEventListener('click', () => {
  createClass();
});

saveResourceButton?.addEventListener('click', () => {
  saveResource();
});

saveAnnouncementButton?.addEventListener('click', () => {
  saveAnnouncement();
});

cancelAnnouncementEditButton?.addEventListener('click', () => {
  clearAnnouncementForm();
  setAnnouncementMessage('Edit cancelled.', '');
});

teacherSaveQuestButton?.addEventListener('click', () => {
  saveTeacherQuest();
});

teacherCancelQuestEditButton?.addEventListener('click', () => {
  clearTeacherQuestForm();
  setTeacherQuestMessage('Edit cancelled.', '');
});

teacherCompleteQuestSelectElement?.addEventListener('change', () => {
  loadTeacherQuestStudents(safeText(teacherCompleteQuestSelectElement.value, ''));
});

teacherCompleteSelectedQuestsButton?.addEventListener('click', completeCheckedQuestStudents);

resourceUrlElement?.addEventListener('input', () => {
  if (!resourceYoutubeHintElement) return;

  const url = resourceUrlElement.value;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(url);
  const driveFileId = getDriveFileId(url);

  if (youtubeEmbedUrl) {
    resourceYoutubeHintElement.textContent = 'Detected YouTube video. Students can watch this inside the app.';
    return;
  }

  if (isGoogleSlides(url) && driveFileId) {
    resourceYoutubeHintElement.textContent = 'Detected Google Slides. This will be embedded for students.';
    return;
  }

  if (isGoogleSheets(url) && driveFileId) {
    resourceYoutubeHintElement.textContent = 'Detected Google Sheets. This will be embedded for students.';
    return;
  }

  if (isGoogleDocs(url) && driveFileId) {
    resourceYoutubeHintElement.textContent = 'Detected Google Docs. This will be embedded for students.';
    return;
  }

  if (isGoogleDriveUrl(url) && driveFileId) {
    resourceYoutubeHintElement.textContent = 'Detected Google Drive file. This will be embedded for students.';
    return;
  }

  resourceYoutubeHintElement.textContent = '';
});

teacherResourcesListElement?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deactivateButton = target.closest('button[data-resource-deactivate]');
  if (deactivateButton instanceof HTMLButtonElement) {
    deactivateButton.disabled = true;
    deactivateResource(deactivateButton.dataset.resourceDeactivate).finally(() => {
      deactivateButton.disabled = false;
    });
    return;
  }

  const deleteButton = target.closest('button[data-resource-delete]');
  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.disabled = true;
    deleteResource(deleteButton.dataset.resourceDelete).finally(() => {
      deleteButton.disabled = false;
    });
  }
});

teacherAnnouncementsListElement?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editButton = target.closest('button[data-announcement-edit]');
  if (editButton instanceof HTMLButtonElement) {
    const announcementId = String(editButton.dataset.announcementEdit || '').trim();
    const announcement = teacherAnnouncements.find((item) => item.id === announcementId);
    if (!announcement) {
      setAnnouncementMessage('Announcement is no longer available.', 'error');
      return;
    }

    setAnnouncementEditMode(announcement);
    setAnnouncementMessage('Editing announcement. Update the form and save when ready.', '');
    announcementTitleElement?.focus();
    return;
  }

  const deactivateButton = target.closest('button[data-announcement-deactivate]');
  if (deactivateButton instanceof HTMLButtonElement) {
    deactivateButton.disabled = true;
    deactivateAnnouncement(deactivateButton.dataset.announcementDeactivate).finally(() => {
      deactivateButton.disabled = false;
    });
    return;
  }

  const deleteButton = target.closest('button[data-announcement-delete]');
  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.disabled = true;
    deleteAnnouncement(deleteButton.dataset.announcementDelete).finally(() => {
      deleteButton.disabled = false;
    });
  }
});

teacherQuestsListElement?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editButton = target.closest('button[data-quest-edit]');
  if (editButton instanceof HTMLButtonElement) {
    const questId = String(editButton.dataset.questEdit || '').trim();
    const quest = teacherQuests.find((item) => item.id === questId);
    if (!quest) {
      setTeacherQuestMessage('Quest is no longer available.', 'error');
      return;
    }
    setTeacherQuestEditMode(quest);
    setTeacherQuestMessage('Editing quest. Update the form and save when ready.', '');
    teacherQuestTitleElement?.focus();
    return;
  }

  const manageButton = target.closest('button[data-quest-manage]');
  if (manageButton instanceof HTMLButtonElement) {
    const questId = safeText(manageButton.dataset.questManage, '');
    if (teacherCompleteQuestSelectElement) {
      teacherCompleteQuestSelectElement.value = questId;
    }
    loadTeacherQuestStudents(questId);
    teacherQuestStudentsListElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const deleteButton = target.closest('button[data-quest-delete]');
  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.disabled = true;
    deleteTeacherQuest(deleteButton.dataset.questDelete).finally(() => {
      deleteButton.disabled = false;
    });
  }
});

attendanceClassSelectElement?.addEventListener('change', () => {
  currentAttendanceStudents = [];
  if (attendanceQrPanelElement) {
    attendanceQrPanelElement.hidden = true;
    attendanceQrPanelElement.innerHTML = '';
  }
  loadAttendanceStudents();
});

attendanceDateElement?.addEventListener('change', () => {
  if (attendanceClassSelectElement?.value) {
    renderAttendanceStudents(currentAttendanceStudents);
  }
});

loadAttendanceButton?.addEventListener('click', loadAttendanceStudents);
saveAttendanceButton?.addEventListener('click', saveManualAttendance);
showAttendanceQrButton?.addEventListener('click', showClassroomAttendanceQr);
scanStudentAttendanceQrButton?.addEventListener('click', openStudentAttendanceScanner);

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

    setClassMessage('Create and manage your own classes here.', '');
    setEnrollmentMessage('Review pending enrollment requests for your classes.', '');
    setResourceMessage('Share external learning links for your classes.', '');
    setAnnouncementMessage('Post updates for students here.', '');
    setTeacherQuestMessage('Create class quests here.', '');
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
    await loadTeacherResources();
    await loadTeacherAnnouncements();
    await loadTeacherQuestBadges();
    await loadTeacherQuests();
    await loadTeacherSectionLeaderboardPreview();
    await loadTeacherStudentRankPreview();
    await initMessagingUI();
    startMessagingAutoRefresh();
    const restoredPage = getSavedPage();
    showPage(restoredPage, { persist: false });
    runPageLoaders(restoredPage);

    await seedAchievementsIfEmpty();
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
