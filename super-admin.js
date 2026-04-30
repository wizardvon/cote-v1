import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch
} from './firebase.js';
import { seedAchievementsIfEmpty } from './achievements.js';
import {
  createQuest,
  getQuestsForUser,
  updateQuest,
  deleteQuest,
  getQuestAssignmentCounts,
  isQuestPastDeadline
} from './quests.js';
import { initMessagingUI, refreshConversations, startMessagingAutoRefresh } from './messaging-ui.js';
import { buildStudentNotificationPayload } from './notifications.js';
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

const schoolYearNameInput = document.getElementById('school-year-name');
const addSchoolYearButton = document.getElementById('add-school-year-btn');
const schoolYearMessageElement = document.getElementById('school-year-message');
const schoolYearsListElement = document.getElementById('school-years-list');

const termNameInput = document.getElementById('term-name');
const addTermButton = document.getElementById('add-term-btn');
const termMessageElement = document.getElementById('term-message');
const termsListElement = document.getElementById('terms-list');

const subjectNameInput = document.getElementById('subject-name');
const subjectCodeInput = document.getElementById('subject-code');
const subjectCategorySelect = document.getElementById('subject-category');
const addSubjectButton = document.getElementById('add-subject-btn');
const subjectMessageElement = document.getElementById('subject-message');
const subjectsListElement = document.getElementById('subjects-list');

const sectionGradeLevelSelect = document.getElementById('section-grade-level');
const sectionSchoolYearSelect = document.getElementById('section-school-year');
const sectionNameInput = document.getElementById('section-name');
const addSectionButton = document.getElementById('add-section-btn');
const sectionMessageElement = document.getElementById('section-message');
const sectionsListElement = document.getElementById('sections-list');
const rankingSchoolYearSelect = document.getElementById('ranking-school-year');
const recomputeRankingsButton = document.getElementById('recompute-rankings-btn');
const sectionLeaderboardTableBodyElement = document.getElementById('section-leaderboard-body');
const recomputeStudentRankingsButton = document.getElementById('recompute-student-rankings-btn');
const specialBadgeNameInput = document.getElementById('special-badge-name');
const specialBadgeImageUrlInput = document.getElementById('special-badge-image-url');
const specialBadgeDescriptionInput = document.getElementById('special-badge-description');
const addSpecialBadgeButton = document.getElementById('add-special-badge-btn');
const specialBadgeMessageElement = document.getElementById('special-badge-message');
const specialBadgesListElement = document.getElementById('special-badges-list');
const awardBadgeSelect = document.getElementById('award-badge-select');
const awardSectionFilterSelect = document.getElementById('award-section-filter');
const awardStudentsListElement = document.getElementById('award-students-list');
const awardSpecialBadgeButton = document.getElementById('award-special-badge-btn');
const awardBadgeMessageElement = document.getElementById('award-badge-message');
const achievementBadgesPreviewListElement = document.getElementById('achievement-badges-preview-list');
const announcementModerationListElement = document.getElementById('announcement-moderation-list');
const announcementModerationMessageElement = document.getElementById('announcement-moderation-message');
const superAdminQuestTitleElement = document.getElementById('super-admin-quest-title');
const superAdminQuestDescriptionElement = document.getElementById('super-admin-quest-description');
const superAdminQuestPointsElement = document.getElementById('super-admin-quest-points');
const superAdminQuestBadgeElement = document.getElementById('super-admin-quest-badge');
const superAdminQuestTargetTypeElement = document.getElementById('super-admin-quest-target-type');
const superAdminQuestDeadlineElement = document.getElementById('super-admin-quest-deadline');
const superAdminQuestStatusElement = document.getElementById('super-admin-quest-status');
const superAdminQuestTargetsElement = document.getElementById('super-admin-quest-targets');
const superAdminSaveQuestButton = document.getElementById('super-admin-save-quest-btn');
const superAdminCancelQuestEditButton = document.getElementById('super-admin-cancel-quest-edit-btn');
const superAdminQuestMessageElement = document.getElementById('super-admin-quest-message');
const superAdminQuestsListElement = document.getElementById('super-admin-quests-list');
const superAdminQuestFormTitleElement = document.getElementById('super-admin-quest-form-title');

let overlaySequenceJob = 0;
let schoolYearOptionsCache = [];
let specialBadgeOptionsCache = [];
let studentOptionsCache = [];
let sectionOptionsCache = [];
let superAdminQuests = [];
let teacherAnnouncementModerationCache = [];
let currentSuperAdminUser = null;
let editingSuperAdminQuestId = '';

function getTierFromRank(rank) {
  if (rank === 1) return 'Class A';
  if (rank === 2) return 'Class B';
  if (rank === 3) return 'Class C';
  if (rank === 4) return 'Class D';
  return 'Class E';
}

function normalizePoints(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function commitUpdatePayloadsInBatches(payloads = []) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return;
  }

  const MAX_BATCH_SIZE = 450;
  for (let index = 0; index < payloads.length; index += MAX_BATCH_SIZE) {
    const chunk = payloads.slice(index, index + MAX_BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      batch.update(doc(db, 'students', item.studentId), {
        studentRank: item.studentRank,
        sectionRankTotal: item.sectionRankTotal,
        rankingUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}

const pageTitles = {
  home: 'Home',
  'teacher-approvals': 'Teacher Approvals',
  'active-teachers': 'Active Teachers',
  'academic-setup': 'Academic Setup',
  subjects: 'Subjects',
  sections: 'Sections',
  'special-badges': 'Special Badges',
  quests: 'Quests',
  messages: 'Messages',
  'announcement-moderation': 'Announcements'
};
const LAST_PAGE_STORAGE_KEY = 'cote.superAdmin.lastPage';

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

function setMessageOnElement(element, message, type = '') {
  if (!element) return;

  element.textContent = message;
  element.classList.remove('success', 'error');
  if (type) {
    element.classList.add(type);
  }
}

function setMessage(message, type = '') {
  setMessageOnElement(messageElement, message, type);
}

function safeText(value, fallback = '—') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDriveFileId(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return null;

  const byPath = rawUrl.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  const byIdParam = rawUrl.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return byPath?.[1] || byIdParam?.[1] || null;
}

function getBadgeImageDisplayUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return '';

  const driveFileId = getDriveFileId(rawUrl);
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w256`;
  }

  return rawUrl;
}

function getBadgeInitials(record = {}) {
  return String(record.title || record.name || 'Badge')
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function renderBadgePreviewCard(record = {}, meta = '') {
  const title = escapeHtml(record.title || record.name || 'Untitled Badge');
  const imageUrl = getBadgeImageDisplayUrl(record.badgeImageUrl || record.imageUrl || record.originalImageUrl || '');
  const initials = escapeHtml(getBadgeInitials(record));
  const visual = imageUrl
    ? `<span>${initials}</span><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.remove()" />`
    : `<span>${initials}</span>`;

  return `
    <article class="badge-preview-card">
      <span class="profile-badge-icon" aria-hidden="true">${visual}</span>
      <h3>${title}</h3>
      ${meta ? `<p>${escapeHtml(meta)}</p>` : ''}
    </article>
  `;
}

function sortAchievementsForPreview(records = []) {
  return records.slice().sort((a, b) => {
    const categoryCompare = safeText(a.category, '').localeCompare(safeText(b.category, ''));
    if (categoryCompare !== 0) return categoryCompare;

    const chainCompare = safeText(a.chainKey, '').localeCompare(safeText(b.chainKey, ''));
    if (chainCompare !== 0) return chainCompare;

    return Number(a.chainOrder || 0) - Number(b.chainOrder || 0);
  });
}

function formatTimestampDate(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : value ? new Date(value) : null);
  if (!date || !Number.isFinite(date.getTime())) return 'No date';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

function getTimestampMillis(value) {
  return value?.toMillis?.() || 0;
}

function isAnnouncementExpired(announcement = {}) {
  const expiryDate = announcement.expiresAt?.toDate?.();
  return Boolean(expiryDate && expiryDate.getTime() < Date.now());
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

function showPage(pageName, options = {}) {
  const targetPage = isKnownPage(pageName) ? pageName : 'home';

  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === targetPage);
  });

  menuButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === targetPage);
  });

  if (pageTitleElement) {
    pageTitleElement.textContent = pageTitles[targetPage] || 'Super Admin Dashboard';
  }

  if (options.persist !== false) {
    saveCurrentPage(targetPage);
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

function renderSchoolYears(records) {
  if (!schoolYearsListElement) return;

  if (!records.length) {
    schoolYearsListElement.innerHTML = '<p class="empty-cell">No school years yet.</p>';
    return;
  }

  schoolYearsListElement.innerHTML = records
    .map((record) => {
      const nextStatus = record.status === 'active' ? 'inactive' : 'active';
      return `
      <article class="app-card super-admin-item">
        <p><strong>Name:</strong> ${safeText(record.name)}</p>
        <p><strong>Status:</strong> <span class="status-pill ${record.status === 'active' ? 'status-active' : 'status-pending'}">${safeText(record.status)}</span></p>
        <button type="button" class="approve-button" data-school-year-id="${record.id}" data-current-status="${record.status}">
          Mark as ${nextStatus}
        </button>
      </article>
    `;
    })
    .join('');
}

function renderTerms(records) {
  if (!termsListElement) return;

  if (!records.length) {
    termsListElement.innerHTML = '<p class="empty-cell">No terms yet.</p>';
    return;
  }

  termsListElement.innerHTML = records
    .map((record) => {
      const nextStatus = record.status === 'active' ? 'inactive' : 'active';
      return `
      <article class="app-card super-admin-item">
        <p><strong>Name:</strong> ${safeText(record.name)}</p>
        <p><strong>Status:</strong> <span class="status-pill ${record.status === 'active' ? 'status-active' : 'status-pending'}">${safeText(record.status)}</span></p>
        <button type="button" class="approve-button" data-term-id="${record.id}" data-current-status="${record.status}">
          Mark as ${nextStatus}
        </button>
      </article>
    `;
    })
    .join('');
}

function renderSubjects(records) {
  if (!subjectsListElement) return;

  if (!records.length) {
    subjectsListElement.innerHTML = '<p class="empty-cell">No subjects yet.</p>';
    return;
  }

  subjectsListElement.innerHTML = records
    .map((record) => {
      const nextStatus = record.status === 'active' ? 'inactive' : 'active';
      return `
      <article class="app-card super-admin-item">
        <p><strong>Name:</strong> ${safeText(record.name)}</p>
        <p><strong>Code:</strong> ${safeText(record.code)}</p>
        <p><strong>Category:</strong> ${safeText(record.category)}</p>
        <p><strong>Status:</strong> <span class="status-pill ${record.status === 'active' ? 'status-active' : 'status-pending'}">${safeText(record.status)}</span></p>
        <button type="button" class="approve-button" data-subject-id="${record.id}" data-current-status="${record.status}">
          Mark as ${nextStatus}
        </button>
      </article>
    `;
    })
    .join('');
}

function renderSections(records) {
  if (!sectionsListElement) return;

  if (!records.length) {
    sectionsListElement.innerHTML = '<p class="empty-cell">No sections yet.</p>';
    return;
  }

  sectionsListElement.innerHTML = records
    .map((record) => {
      const nextStatus = record.status === 'active' ? 'inactive' : 'active';
      return `
      <article class="app-card super-admin-item">
        <p><strong>Name:</strong> ${safeText(record.name)}</p>
        <p><strong>Grade Level:</strong> ${safeText(record.gradeLevel)}</p>
        <p><strong>School Year:</strong> ${safeText(record.schoolYearName)}</p>
        <p><strong>Status:</strong> <span class="status-pill ${record.status === 'active' ? 'status-active' : 'status-pending'}">${safeText(record.status)}</span></p>
        <button type="button" class="approve-button" data-section-id="${record.id}" data-current-status="${record.status}">
          Mark as ${nextStatus}
        </button>
      </article>
    `;
    })
    .join('');
}

function makeStudentName(student = {}) {
  const fullName = [student.firstName, student.middleName, student.lastName]
    .map((part) => safeText(part, '').trim())
    .filter(Boolean)
    .join(' ');

  return fullName || safeText(student.email, 'Unnamed Student');
}

function renderSpecialBadges(records) {
  if (!specialBadgesListElement) return;

  if (!records.length) {
    specialBadgesListElement.innerHTML = '<p class="empty-cell">No special badges yet.</p>';
    return;
  }

  specialBadgesListElement.innerHTML = records
    .map((record) => {
      const status = safeText(record.status, 'active');
      const nextStatus = status === 'active' ? 'inactive' : 'active';
      const imageUrl = getBadgeImageDisplayUrl(record.imageUrl);
      const previewHtml = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="" class="special-badge-preview" loading="lazy" />`
        : '<div class="special-badge-preview special-badge-preview-empty">No image</div>';

      return `
      <article class="app-card super-admin-item special-badge-item">
        ${previewHtml}
        <div>
          <p><strong>Name:</strong> ${escapeHtml(record.name || 'Untitled Badge')}</p>
          <p><strong>Description:</strong> ${escapeHtml(record.description || 'No description')}</p>
          <p><strong>Status:</strong> <span class="status-pill ${
            status === 'active' ? 'status-active' : 'status-pending'
          }">${escapeHtml(status)}</span></p>
          <button type="button" class="approve-button" data-special-badge-id="${escapeHtml(
            record.id
          )}" data-current-status="${escapeHtml(status)}">
            Mark as ${escapeHtml(nextStatus)}
          </button>
        </div>
      </article>
    `;
    })
    .join('');
}

function getSelectedQuestTargetIds() {
  if (!superAdminQuestTargetsElement) return [];
  return Array.from(superAdminQuestTargetsElement.selectedOptions)
    .map((option) => safeText(option.value, '').trim())
    .filter(Boolean);
}

function populateQuestTargetOptions(selectedIds = []) {
  if (!superAdminQuestTargetsElement || !superAdminQuestTargetTypeElement) return;

  const targetType = safeText(superAdminQuestTargetTypeElement.value, 'all');
  const selectedSet = new Set(selectedIds);

  if (targetType === 'all') {
    superAdminQuestTargetsElement.innerHTML = '<option value="">All active students</option>';
    superAdminQuestTargetsElement.disabled = true;
    return;
  }

  superAdminQuestTargetsElement.disabled = false;
  const sourceRecords = targetType === 'students' ? studentOptionsCache : sectionOptionsCache;
  superAdminQuestTargetsElement.innerHTML = '';

  sourceRecords.forEach((record) => {
    const option = document.createElement('option');
    option.value = record.id;
    option.textContent =
      targetType === 'students'
        ? record.displayName || makeStudentName(record)
        : [record.name, record.gradeLevel, record.schoolYearName].map((item) => safeText(item, '')).filter(Boolean).join(' - ');
    option.selected = selectedSet.has(record.id);
    superAdminQuestTargetsElement.append(option);
  });

  if (!sourceRecords.length) {
    superAdminQuestTargetsElement.innerHTML = '<option value="">No targets available</option>';
  }
}

function populateSuperAdminQuestBadges() {
  if (!superAdminQuestBadgeElement) return;

  const previousValue = superAdminQuestBadgeElement.value;
  superAdminQuestBadgeElement.innerHTML = '<option value="">No badge</option>';
  specialBadgeOptionsCache
    .filter((badge) => safeText(badge.status, 'active') === 'active')
    .forEach((badge) => {
      const option = document.createElement('option');
      option.value = badge.id;
      option.textContent = badge.name || 'Untitled Badge';
      superAdminQuestBadgeElement.append(option);
    });

  if (previousValue && specialBadgeOptionsCache.some((badge) => badge.id === previousValue)) {
    superAdminQuestBadgeElement.value = previousValue;
  }
}

function setSuperAdminQuestEditMode(quest = null) {
  editingSuperAdminQuestId = quest?.id || '';
  if (superAdminQuestFormTitleElement) {
    superAdminQuestFormTitleElement.textContent = editingSuperAdminQuestId ? 'Edit Quest' : 'Create Quest';
  }
  if (superAdminQuestTitleElement) superAdminQuestTitleElement.value = quest?.title || '';
  if (superAdminQuestDescriptionElement) superAdminQuestDescriptionElement.value = quest?.description || '';
  if (superAdminQuestPointsElement) superAdminQuestPointsElement.value = quest?.points || '';
  if (superAdminQuestBadgeElement) superAdminQuestBadgeElement.value = quest?.badgeId || '';
  if (superAdminQuestTargetTypeElement) superAdminQuestTargetTypeElement.value = quest?.targetType || 'all';
  if (superAdminQuestDeadlineElement) superAdminQuestDeadlineElement.value = timestampToDateTimeInputValue(quest?.deadline);
  if (superAdminQuestStatusElement) superAdminQuestStatusElement.value = quest?.status || 'active';
  populateQuestTargetOptions(Array.isArray(quest?.targetIds) ? quest.targetIds : []);
  if (superAdminSaveQuestButton) superAdminSaveQuestButton.textContent = editingSuperAdminQuestId ? 'Update Quest' : 'Create Quest';
  if (superAdminCancelQuestEditButton) superAdminCancelQuestEditButton.hidden = !editingSuperAdminQuestId;
}

function clearSuperAdminQuestForm() {
  setSuperAdminQuestEditMode(null);
}

function renderAchievementBadgePreviews(records) {
  if (!achievementBadgesPreviewListElement) return;

  const visibleRecords = sortAchievementsForPreview(records).filter((record) => {
    const status = safeText(record.status, 'active').toLowerCase();
    return status === 'active' && !record.isHidden;
  });

  if (!visibleRecords.length) {
    achievementBadgesPreviewListElement.innerHTML = '<p class="empty-cell">No achievement badges found.</p>';
    return;
  }

  achievementBadgesPreviewListElement.innerHTML = visibleRecords
    .map((record) => renderBadgePreviewCard(record, safeText(record.category, 'Achievement')))
    .join('');
}

function renderAnnouncementModeration(records = []) {
  if (!announcementModerationListElement) return;

  if (!records.length) {
    announcementModerationListElement.innerHTML = '<p class="empty-cell">No teacher announcements found.</p>';
    return;
  }

  announcementModerationListElement.innerHTML = records
    .map((announcement) => {
      const status = safeText(announcement.status, 'active');
      const isExpired = isAnnouncementExpired(announcement);
      const displayStatus = status === 'active' && isExpired ? 'expired' : status;
      const target = safeText(announcement.target, 'all');
      const audience = target === 'class' ? safeText(announcement.classLabel, 'Selected class') : 'All students';
      const isInactive = status !== 'active';

      return `
        <article class="app-card super-admin-item">
          <p><strong>Title:</strong> ${escapeHtml(announcement.title || 'Untitled Announcement')}</p>
          <p><strong>Teacher:</strong> ${escapeHtml(announcement.teacherName || 'Teacher')}</p>
          <p><strong>Audience:</strong> ${escapeHtml(audience)}</p>
          <p><strong>Status:</strong> <span class="status-pill ${
            displayStatus === 'active' ? 'status-active' : 'status-pending'
          }">${escapeHtml(displayStatus)}</span></p>
          <p><strong>Created:</strong> ${escapeHtml(formatTimestampDate(announcement.createdAt))}</p>
          <p><strong>Expires:</strong> ${escapeHtml(formatTimestampDate(announcement.expiresAt))}</p>
          <p><strong>Message:</strong> ${escapeHtml(announcement.message || 'No message')}</p>
          <div class="admin-actions">
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

function populateAwardBadgeSelect(records) {
  if (!awardBadgeSelect) return;

  const currentValue = awardBadgeSelect.value;
  const activeRecords = records.filter((record) => safeText(record.status, 'active') === 'active');
  const options = activeRecords
    .map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.name || 'Untitled Badge')}</option>`)
    .join('');

  awardBadgeSelect.innerHTML = '<option value="">Select badge</option>' + options;

  if (currentValue && activeRecords.some((record) => record.id === currentValue)) {
    awardBadgeSelect.value = currentValue;
  }
}

function getStudentSectionFilterValue(student = {}) {
  const sectionId = safeText(student.sectionId, '').trim();
  if (sectionId) return `id:${sectionId}`;

  const sectionName = safeText(student.sectionName || student.section, '').trim();
  if (sectionName) return `name:${sectionName.toLowerCase()}`;

  return 'unassigned';
}

function getStudentSectionLabel(student = {}) {
  return safeText(student.sectionName || student.section, 'No section assigned');
}

function getStudentSexRank(student = {}) {
  const sex = safeText(student.sex || student.gender, '').toLowerCase();
  if (sex === 'male' || sex === 'm') return 1;
  if (sex === 'female' || sex === 'f') return 2;
  return 3;
}

function getStudentSexLabel(student = {}) {
  const sex = safeText(student.sex || student.gender, '').toLowerCase();
  if (sex === 'male' || sex === 'm') return 'Male';
  if (sex === 'female' || sex === 'f') return 'Female';
  return 'Other / Not Set';
}

function sortStudentsForAward(records = []) {
  return records.slice().sort((a, b) => {
    const sexCompare = getStudentSexRank(a) - getStudentSexRank(b);
    if (sexCompare !== 0) return sexCompare;

    return safeText(a.displayName, '').localeCompare(safeText(b.displayName, ''), undefined, {
      sensitivity: 'base'
    });
  });
}

function populateAwardSectionFilter(records) {
  if (!awardSectionFilterSelect) return;

  const currentValue = awardSectionFilterSelect.value;
  const sectionMap = new Map();

  records.forEach((record) => {
    const value = getStudentSectionFilterValue(record);
    const label = getStudentSectionLabel(record);

    if (!sectionMap.has(value)) {
      sectionMap.set(value, label);
    }
  });

  const options = Array.from(sectionMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join('');

  awardSectionFilterSelect.innerHTML = '<option value="">All sections</option>' + options;

  if (currentValue && sectionMap.has(currentValue)) {
    awardSectionFilterSelect.value = currentValue;
  }
}

function renderAwardStudentCheckboxes(records) {
  if (!awardStudentsListElement) return;

  const selectedSection = safeText(awardSectionFilterSelect?.value, '').trim();
  const filteredRecords = selectedSection
    ? records.filter((record) => getStudentSectionFilterValue(record) === selectedSection)
    : records;

  if (!filteredRecords.length) {
    awardStudentsListElement.innerHTML =
      '<p class="empty-cell">No students found for the selected section.</p>';
    return;
  }

  let currentGroup = '';
  const listHtml = sortStudentsForAward(filteredRecords)
    .map((record) => {
      const sexLabel = getStudentSexLabel(record);
      const groupHeader = sexLabel === currentGroup ? '' : `<h3>${escapeHtml(sexLabel)}</h3>`;
      currentGroup = sexLabel;

      return `
        ${groupHeader}
        <label class="award-student-option">
          <input type="checkbox" value="${escapeHtml(record.id)}" />
          <span>
            <strong>${escapeHtml(record.displayName)}</strong>
            <small>${escapeHtml(getStudentSectionLabel(record))}</small>
          </span>
        </label>
      `;
    })
    .join('');

  awardStudentsListElement.innerHTML = listHtml;
}

function getSelectedAwardStudentIds() {
  if (!awardStudentsListElement) return [];

  return Array.from(awardStudentsListElement.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => safeText(input.value, '').trim())
    .filter(Boolean);
}

function populateSchoolYearSelect(records) {
  if (!sectionSchoolYearSelect) return;

  const currentValue = sectionSchoolYearSelect.value;
  const options = records
    .map((record) => `<option value="${record.id}">${safeText(record.name)}</option>`)
    .join('');

  sectionSchoolYearSelect.innerHTML = '<option value="">Select school year</option>' + options;

  if (currentValue && records.some((record) => record.id === currentValue)) {
    sectionSchoolYearSelect.value = currentValue;
  }
}

function populateRankingSchoolYearSelect(records) {
  if (!rankingSchoolYearSelect) return;

  const currentValue = rankingSchoolYearSelect.value;
  const activeRecords = records.filter((item) => safeText(item.status, '').toLowerCase() === 'active');
  const options = activeRecords.map((record) => `<option value="${record.id}">${safeText(record.name)}</option>`).join('');

  rankingSchoolYearSelect.innerHTML = '<option value="">Select school year</option>' + options;

  if (currentValue && activeRecords.some((record) => record.id === currentValue)) {
    rankingSchoolYearSelect.value = currentValue;
    return;
  }

  if (activeRecords.length > 0) {
    rankingSchoolYearSelect.value = activeRecords[0].id;
  }
}

function renderSectionLeaderboard(records) {
  if (!sectionLeaderboardTableBodyElement) return;

  if (!records.length) {
    sectionLeaderboardTableBodyElement.innerHTML = '<tr><td colspan="5" class="empty-cell">No sections found.</td></tr>';
    return;
  }

  sectionLeaderboardTableBodyElement.innerHTML = records
    .map(
      (record) => `
      <tr>
        <td>${record.rank}</td>
        <td><span class="tier-pill ${String(record.tier || '').toLowerCase().replace(/\s+/g, '-')}">${safeText(record.tier)}</span></td>
        <td>${safeText(record.name)}</td>
        <td>${safeText(record.gradeLevel)}</td>
        <td>${normalizePoints(record.totalPoints).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');
}

async function getRankedSectionsBySchoolYear(schoolYearId) {
  const sectionQuery = query(
    collection(db, 'sections'),
    where('schoolYearId', '==', schoolYearId),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(sectionQuery);

  const rankedSections = snapshot.docs
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
        tier: getTierFromRank(rank),
        totalPoints: normalizePoints(record.totalPoints)
      };
    });

  return rankedSections;
}

async function getSavedSectionLeaderboardBySchoolYear(schoolYearId) {
  const sectionQuery = query(
    collection(db, 'sections'),
    where('schoolYearId', '==', schoolYearId),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(sectionQuery);

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
      totalPoints: normalizePoints(item.data()?.totalPoints)
    }))
    .sort((a, b) => {
      const rankA = Number(a.rank);
      const rankB = Number(b.rank);
      const hasRankA = Number.isFinite(rankA) && rankA > 0;
      const hasRankB = Number.isFinite(rankB) && rankB > 0;

      if (hasRankA && hasRankB && rankA !== rankB) return rankA - rankB;
      if (hasRankA !== hasRankB) return hasRankA ? -1 : 1;

      const pointsDelta = normalizePoints(b.totalPoints) - normalizePoints(a.totalPoints);
      if (pointsDelta !== 0) return pointsDelta;
      return safeText(a.name, '').localeCompare(safeText(b.name, ''), undefined, { sensitivity: 'base' });
    });
}

async function refreshSectionLeaderboard() {
  const schoolYearId = safeText(rankingSchoolYearSelect?.value, '').trim();

  if (!schoolYearId) {
    renderSectionLeaderboard([]);
    return;
  }

  try {
    const savedSections = await getSavedSectionLeaderboardBySchoolYear(schoolYearId);
    renderSectionLeaderboard(savedSections);
  } catch (error) {
    console.error('Failed to load section leaderboard:', error);
    setMessageOnElement(sectionMessageElement, 'Unable to load section leaderboard right now.', 'error');
  }
}

async function recomputeSectionRankings() {
  const schoolYearId = safeText(rankingSchoolYearSelect?.value, '').trim();
  if (!schoolYearId) {
    setMessageOnElement(sectionMessageElement, 'Please select a school year first.', 'error');
    return;
  }

  if (recomputeRankingsButton) {
    recomputeRankingsButton.disabled = true;
    recomputeRankingsButton.textContent = 'Recomputing...';
  }

  try {
    const rankedSections = await getRankedSectionsBySchoolYear(schoolYearId);

    await Promise.all(
      rankedSections.map((section) => {
        return updateDoc(doc(db, 'sections', section.id), {
          rank: section.rank,
          tier: section.tier,
          totalPoints: section.totalPoints || 0,
          rankingSchoolYearId: schoolYearId,
          rankingUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      })
    );

    const savedSections = await getSavedSectionLeaderboardBySchoolYear(schoolYearId);
    renderSectionLeaderboard(savedSections);
    setMessageOnElement(sectionMessageElement, 'Section rankings recomputed successfully.', 'success');
    await loadSections();
  } catch (error) {
    console.error('Failed to recompute rankings:', error);
    setMessageOnElement(sectionMessageElement, 'Failed to recompute section rankings.', 'error');
  } finally {
    if (recomputeRankingsButton) {
      recomputeRankingsButton.disabled = false;
      recomputeRankingsButton.textContent = 'Recompute Section Rankings';
    }
  }
}

async function recomputeStudentRankings() {
  const schoolYearId = safeText(rankingSchoolYearSelect?.value, '').trim();
  if (!schoolYearId) {
    setMessageOnElement(sectionMessageElement, 'Please select a school year first.', 'error');
    return;
  }

  if (recomputeStudentRankingsButton) {
    recomputeStudentRankingsButton.disabled = true;
    recomputeStudentRankingsButton.textContent = 'Recomputing...';
  }

  try {
    const studentSnapshot = await getDocs(query(collection(db, 'students'), where('schoolYearId', '==', schoolYearId)));
    const students = studentSnapshot.docs.map((studentDoc) => ({
      id: studentDoc.id,
      ...studentDoc.data(),
      points: normalizePoints(studentDoc.data()?.points)
    }));

    const groupedBySection = students.reduce((accumulator, student) => {
      const sectionId = safeText(student.sectionId, '').trim();
      if (!sectionId) {
        return accumulator;
      }

      if (!accumulator.has(sectionId)) {
        accumulator.set(sectionId, []);
      }

      accumulator.get(sectionId).push(student);
      return accumulator;
    }, new Map());

    const payloads = [];

    groupedBySection.forEach((sectionStudents) => {
      const sortedStudents = [...sectionStudents].sort((a, b) => {
        const pointsDelta = normalizePoints(b.points) - normalizePoints(a.points);
        if (pointsDelta !== 0) return pointsDelta;

        const lastNameCompare = safeText(a.lastName, '').localeCompare(safeText(b.lastName, ''), undefined, {
          sensitivity: 'base'
        });
        if (lastNameCompare !== 0) return lastNameCompare;

        return safeText(a.firstName, '').localeCompare(safeText(b.firstName, ''), undefined, {
          sensitivity: 'base'
        });
      });

      const sectionRankTotal = sortedStudents.length;
      sortedStudents.forEach((student, index) => {
        payloads.push({
          studentId: student.id,
          studentRank: index + 1,
          sectionRankTotal
        });
      });
    });

    await commitUpdatePayloadsInBatches(payloads);

    setMessageOnElement(
      sectionMessageElement,
      `Student rankings recomputed successfully for ${groupedBySection.size} section(s).`,
      'success'
    );
  } catch (error) {
    console.error('Failed to recompute student rankings:', error);
    setMessageOnElement(sectionMessageElement, 'Failed to recompute student rankings.', 'error');
  } finally {
    if (recomputeStudentRankingsButton) {
      recomputeStudentRankingsButton.disabled = false;
      recomputeStudentRankingsButton.textContent = 'Recompute Student Rankings';
    }
  }
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

async function addSchoolYear() {
  const schoolYearName = safeText(schoolYearNameInput?.value, '').trim();

  if (!schoolYearName) {
    setMessageOnElement(schoolYearMessageElement, 'Please enter a school year name.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'schoolYears'), {
      name: schoolYearName,
      status: 'active',
      createdAt: serverTimestamp()
    });

    if (schoolYearNameInput) {
      schoolYearNameInput.value = '';
    }

    setMessageOnElement(schoolYearMessageElement, 'School year added successfully.', 'success');
    await loadSchoolYears();
  } catch (error) {
    console.error('Failed to add school year:', error);
    setMessageOnElement(schoolYearMessageElement, 'Failed to add school year. Please try again.', 'error');
  }
}

async function loadSchoolYears() {
  try {
    const schoolYearsQuery = query(collection(db, 'schoolYears'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(schoolYearsQuery);

    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    schoolYearOptionsCache = records;
    renderSchoolYears(records);
    populateSchoolYearSelect(records);
    populateRankingSchoolYearSelect(records);
    await refreshSectionLeaderboard();
  } catch (error) {
    console.error('Failed to load school years:', error);
    setMessageOnElement(schoolYearMessageElement, 'Unable to load school years right now.', 'error');
  }
}

async function toggleSchoolYearStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'schoolYears', id), { status: nextStatus });
    setMessageOnElement(schoolYearMessageElement, `School year marked as ${nextStatus}.`, 'success');
    await loadSchoolYears();
  } catch (error) {
    console.error('Failed to update school year status:', error);
    setMessageOnElement(schoolYearMessageElement, 'Failed to update school year status.', 'error');
  }
}

async function addTerm() {
  const termName = safeText(termNameInput?.value, '').trim();

  if (!termName) {
    setMessageOnElement(termMessageElement, 'Please enter a term name.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'terms'), {
      name: termName,
      status: 'active',
      createdAt: serverTimestamp()
    });

    if (termNameInput) {
      termNameInput.value = '';
    }

    setMessageOnElement(termMessageElement, 'Term added successfully.', 'success');
    await loadTerms();
  } catch (error) {
    console.error('Failed to add term:', error);
    setMessageOnElement(termMessageElement, 'Failed to add term. Please try again.', 'error');
  }
}

async function loadTerms() {
  try {
    const termsQuery = query(collection(db, 'terms'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(termsQuery);

    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderTerms(records);
  } catch (error) {
    console.error('Failed to load terms:', error);
    setMessageOnElement(termMessageElement, 'Unable to load terms right now.', 'error');
  }
}

async function toggleTermStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'terms', id), { status: nextStatus });
    setMessageOnElement(termMessageElement, `Term marked as ${nextStatus}.`, 'success');
    await loadTerms();
  } catch (error) {
    console.error('Failed to update term status:', error);
    setMessageOnElement(termMessageElement, 'Failed to update term status.', 'error');
  }
}

async function addSubject() {
  const name = safeText(subjectNameInput?.value, '').trim();
  const code = safeText(subjectCodeInput?.value, '').trim();
  const category = safeText(subjectCategorySelect?.value, '').trim();

  if (!name || !code || !category) {
    setMessageOnElement(subjectMessageElement, 'Please fill in all subject fields.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'subjects'), {
      name,
      code,
      category,
      status: 'active',
      createdAt: serverTimestamp()
    });

    if (subjectNameInput) subjectNameInput.value = '';
    if (subjectCodeInput) subjectCodeInput.value = '';
    if (subjectCategorySelect) subjectCategorySelect.value = '';

    setMessageOnElement(subjectMessageElement, 'Subject added successfully.', 'success');
    await loadSubjects();
  } catch (error) {
    console.error('Failed to add subject:', error);
    setMessageOnElement(subjectMessageElement, 'Failed to add subject. Please try again.', 'error');
  }
}

async function loadSubjects() {
  try {
    const subjectsQuery = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(subjectsQuery);

    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderSubjects(records);
  } catch (error) {
    console.error('Failed to load subjects:', error);
    setMessageOnElement(subjectMessageElement, 'Unable to load subjects right now.', 'error');
  }
}

async function toggleSubjectStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'subjects', id), { status: nextStatus });
    setMessageOnElement(subjectMessageElement, `Subject marked as ${nextStatus}.`, 'success');
    await loadSubjects();
  } catch (error) {
    console.error('Failed to update subject status:', error);
    setMessageOnElement(subjectMessageElement, 'Failed to update subject status.', 'error');
  }
}

async function addSection() {
  const gradeLevel = safeText(sectionGradeLevelSelect?.value, '').trim();
  const schoolYearId = safeText(sectionSchoolYearSelect?.value, '').trim();
  const sectionName = safeText(sectionNameInput?.value, '').trim();

  if (!gradeLevel || !schoolYearId || !sectionName) {
    setMessageOnElement(sectionMessageElement, 'Please complete all section fields.', 'error');
    return;
  }

  const schoolYearRecord = schoolYearOptionsCache.find((item) => item.id === schoolYearId);

  if (!schoolYearRecord) {
    setMessageOnElement(sectionMessageElement, 'Selected school year is no longer available.', 'error');
    return;
  }

  try {
    const duplicateQuery = query(
      collection(db, 'sections'),
      where('schoolYearId', '==', schoolYearId),
      where('name', '==', sectionName)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      setMessageOnElement(
        sectionMessageElement,
        'Section name already exists under this school year.',
        'error'
      );
      return;
    }

    await addDoc(collection(db, 'sections'), {
      name: sectionName,
      gradeLevel,
      schoolYearId,
      schoolYearName: safeText(schoolYearRecord.name),
      status: 'active',
      totalPoints: 0,
      rank: null,
      tier: null,
      createdAt: serverTimestamp()
    });

    if (sectionNameInput) sectionNameInput.value = '';
    if (sectionGradeLevelSelect) sectionGradeLevelSelect.value = '';
    if (sectionSchoolYearSelect) sectionSchoolYearSelect.value = '';

    setMessageOnElement(sectionMessageElement, 'Section added successfully.', 'success');
    await loadSections();
  } catch (error) {
    console.error('Failed to add section:', error);
    setMessageOnElement(sectionMessageElement, 'Failed to add section. Please try again.', 'error');
  }
}

async function loadSections() {
  try {
    const sectionsQuery = query(collection(db, 'sections'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(sectionsQuery);

    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    sectionOptionsCache = records;
    renderSections(records);
    populateQuestTargetOptions(getSelectedQuestTargetIds());
  } catch (error) {
    console.error('Failed to load sections:', error);
    setMessageOnElement(sectionMessageElement, 'Unable to load sections right now.', 'error');
  }
}

async function toggleSectionStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'sections', id), { status: nextStatus });
    setMessageOnElement(sectionMessageElement, `Section marked as ${nextStatus}.`, 'success');
    await loadSections();
  } catch (error) {
    console.error('Failed to update section status:', error);
    setMessageOnElement(sectionMessageElement, 'Failed to update section status.', 'error');
  }
}

async function addSpecialBadge() {
  const name = safeText(specialBadgeNameInput?.value, '').trim();
  const originalImageUrl = safeText(specialBadgeImageUrlInput?.value, '').trim();
  const imageUrl = getBadgeImageDisplayUrl(originalImageUrl);
  const description = safeText(specialBadgeDescriptionInput?.value, '').trim();

  if (!name || !originalImageUrl) {
    setMessageOnElement(specialBadgeMessageElement, 'Please enter a badge name and image URL.', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'specialBadges'), {
      name,
      imageUrl,
      originalImageUrl,
      description,
      type: 'special',
      status: 'active',
      createdBy: currentSuperAdminUser?.uid || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (specialBadgeNameInput) specialBadgeNameInput.value = '';
    if (specialBadgeImageUrlInput) specialBadgeImageUrlInput.value = '';
    if (specialBadgeDescriptionInput) specialBadgeDescriptionInput.value = '';

    setMessageOnElement(specialBadgeMessageElement, 'Special badge created successfully.', 'success');
    await loadSpecialBadges();
  } catch (error) {
    console.error('Failed to create special badge:', error);
    setMessageOnElement(specialBadgeMessageElement, 'Failed to create special badge.', 'error');
  }
}

async function loadSpecialBadges() {
  try {
    const badgesQuery = query(collection(db, 'specialBadges'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(badgesQuery);
    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    specialBadgeOptionsCache = records;
    renderSpecialBadges(records);
    populateAwardBadgeSelect(records);
    populateSuperAdminQuestBadges();
  } catch (error) {
    console.error('Failed to load special badges:', error);
    setMessageOnElement(specialBadgeMessageElement, 'Unable to load special badges right now.', 'error');
  }
}

async function loadAchievementBadgePreviews() {
  if (!achievementBadgesPreviewListElement) return;

  try {
    const snapshot = await getDocs(collection(db, 'achievements'));
    const records = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderAchievementBadgePreviews(records);
  } catch (error) {
    console.error('Failed to load achievement badge previews:', error);
    achievementBadgesPreviewListElement.innerHTML =
      '<p class="empty-cell">Unable to load achievement badges right now.</p>';
  }
}

async function loadAnnouncementModeration() {
  if (!announcementModerationListElement) return;

  announcementModerationListElement.innerHTML = '<p class="empty-cell">Loading announcements...</p>';

  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'teacherAnnouncements'), orderBy('createdAt', 'desc')));
    } catch (error) {
      const fallbackSnapshot = await getDocs(collection(db, 'teacherAnnouncements'));
      const docs = [...fallbackSnapshot.docs].sort((a, b) => {
        return getTimestampMillis(b.data()?.createdAt) - getTimestampMillis(a.data()?.createdAt);
      });
      snapshot = { docs };
      console.error('Failed to query announcements with orderBy:', error);
    }

    teacherAnnouncementModerationCache = snapshot.docs.map((announcementDoc) => ({
      id: announcementDoc.id,
      ...announcementDoc.data()
    }));
    renderAnnouncementModeration(teacherAnnouncementModerationCache);
  } catch (error) {
    console.error('Failed to load announcement moderation:', error);
    teacherAnnouncementModerationCache = [];
    announcementModerationListElement.innerHTML =
      '<p class="empty-cell">Unable to load announcements right now.</p>';
    setMessageOnElement(announcementModerationMessageElement, 'Unable to load announcements.', 'error');
  }
}

async function deactivateAnnouncement(announcementId) {
  const id = safeText(announcementId, '').trim();
  if (!id) return;

  try {
    await updateDoc(doc(db, 'teacherAnnouncements', id), {
      status: 'inactive',
      moderatedBy: currentSuperAdminUser?.uid || '',
      moderatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setMessageOnElement(announcementModerationMessageElement, 'Announcement deactivated.', 'success');
    await loadAnnouncementModeration();
  } catch (error) {
    console.error('Failed to deactivate announcement:', error);
    setMessageOnElement(announcementModerationMessageElement, 'Failed to deactivate announcement.', 'error');
  }
}

async function deleteAnnouncement(announcementId) {
  const id = safeText(announcementId, '').trim();
  if (!id) return;

  try {
    await deleteDoc(doc(db, 'teacherAnnouncements', id));
    setMessageOnElement(announcementModerationMessageElement, 'Announcement deleted.', 'success');
    await loadAnnouncementModeration();
  } catch (error) {
    console.error('Failed to delete announcement:', error);
    setMessageOnElement(announcementModerationMessageElement, 'Failed to delete announcement.', 'error');
  }
}

function getSuperAdminQuestPayload() {
  const targetType = safeText(superAdminQuestTargetTypeElement?.value, 'all');
  return {
    title: safeText(superAdminQuestTitleElement?.value, '').trim(),
    description: safeText(superAdminQuestDescriptionElement?.value, '').trim(),
    points: Number(superAdminQuestPointsElement?.value || 0),
    badgeId: safeText(superAdminQuestBadgeElement?.value, '').trim(),
    targetType,
    targetIds: targetType === 'all' ? [] : getSelectedQuestTargetIds(),
    deadline: safeText(superAdminQuestDeadlineElement?.value, '').trim(),
    status: safeText(superAdminQuestStatusElement?.value, 'active').trim()
  };
}

async function saveSuperAdminQuest() {
  if (!currentSuperAdminUser?.uid) {
    setMessageOnElement(superAdminQuestMessageElement, 'You must be logged in to save quests.', 'error');
    return;
  }

  const payload = getSuperAdminQuestPayload();
  if (payload.targetType !== 'all' && !payload.targetIds.length) {
    setMessageOnElement(superAdminQuestMessageElement, 'Select at least one target.', 'error');
    return;
  }

  if (superAdminSaveQuestButton) {
    superAdminSaveQuestButton.disabled = true;
    superAdminSaveQuestButton.textContent = editingSuperAdminQuestId ? 'Updating...' : 'Creating...';
  }

  try {
    if (editingSuperAdminQuestId) {
      await updateQuest(editingSuperAdminQuestId, payload);
      setMessageOnElement(superAdminQuestMessageElement, 'Quest updated successfully.', 'success');
    } else {
      const result = await createQuest(payload);
      setMessageOnElement(
        superAdminQuestMessageElement,
        `Quest created and assigned to ${result.assignedCount} student(s).`,
        'success'
      );
    }

    clearSuperAdminQuestForm();
    await loadSuperAdminQuests();
  } catch (error) {
    console.error('Failed to save quest:', error);
    setMessageOnElement(superAdminQuestMessageElement, error?.message || 'Unable to save quest.', 'error');
  } finally {
    if (superAdminSaveQuestButton) {
      superAdminSaveQuestButton.disabled = false;
      superAdminSaveQuestButton.textContent = editingSuperAdminQuestId ? 'Update Quest' : 'Create Quest';
    }
  }
}

function describeQuestTarget(quest = {}) {
  const targetType = safeText(quest.targetType, 'all');
  const targetIds = Array.isArray(quest.targetIds) ? quest.targetIds : [];

  if (targetType === 'all') return 'All active students';
  if (targetType === 'students') {
    return `${targetIds.length} selected student(s)`;
  }
  return `${targetIds.length} selected section/class target(s)`;
}

function renderSuperAdminQuests(quests = [], counts = new Map()) {
  if (!superAdminQuestsListElement) return;

  if (!quests.length) {
    superAdminQuestsListElement.innerHTML = '<p class="empty-cell">No quests created yet.</p>';
    return;
  }

  superAdminQuestsListElement.innerHTML = quests
    .map((quest) => {
      const count = counts.get(quest.id) || { assigned: 0, completed: 0 };
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
            <p><strong>Audience:</strong> ${escapeHtml(describeQuestTarget(quest))}</p>
            <p><strong>Deadline:</strong> ${escapeHtml(formatQuestDeadline(quest.deadline))}</p>
            <p><strong>Completed:</strong> ${count.completed} of ${count.assigned}</p>
          </div>
          <div class="admin-actions">
            <button type="button" data-super-quest-edit="${escapeHtml(quest.id)}">Edit</button>
            <button type="button" class="danger-button" data-super-quest-delete="${escapeHtml(quest.id)}">Delete</button>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadSuperAdminQuests() {
  if (!currentSuperAdminUser?.uid || !superAdminQuestsListElement) return;

  superAdminQuestsListElement.innerHTML = '<p class="empty-cell">Loading quests...</p>';
  try {
    superAdminQuests = await getQuestsForUser(currentSuperAdminUser.uid);
    const counts = await getQuestAssignmentCounts(superAdminQuests.map((quest) => quest.id));
    renderSuperAdminQuests(superAdminQuests, counts);
  } catch (error) {
    console.error('Failed to load quests:', error);
    superAdminQuests = [];
    superAdminQuestsListElement.innerHTML = '<p class="empty-cell">Unable to load quests right now.</p>';
    setMessageOnElement(superAdminQuestMessageElement, 'Unable to load quests.', 'error');
  }
}

async function deleteSuperAdminQuest(questId) {
  const id = safeText(questId, '').trim();
  if (!id) return;

  try {
    await deleteQuest(id);
    setMessageOnElement(superAdminQuestMessageElement, 'Quest deleted.', 'success');
    await loadSuperAdminQuests();
  } catch (error) {
    console.error('Failed to delete quest:', error);
    setMessageOnElement(superAdminQuestMessageElement, 'Unable to delete quest.', 'error');
  }
}

async function loadStudentOptions() {
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    const records = snapshot.docs
      .map((studentDoc) => {
        const data = studentDoc.data() || {};
        return {
          id: studentDoc.id,
          ...data,
          displayName: makeStudentName(data)
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

    studentOptionsCache = records;
    populateAwardSectionFilter(records);
    renderAwardStudentCheckboxes(records);
    populateQuestTargetOptions(getSelectedQuestTargetIds());
  } catch (error) {
    console.error('Failed to load students for badge awards:', error);
    setMessageOnElement(awardBadgeMessageElement, 'Unable to load students right now.', 'error');
  }
}

async function toggleSpecialBadgeStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    await updateDoc(doc(db, 'specialBadges', id), {
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
    setMessageOnElement(specialBadgeMessageElement, `Special badge marked as ${nextStatus}.`, 'success');
    await loadSpecialBadges();
  } catch (error) {
    console.error('Failed to update special badge:', error);
    setMessageOnElement(specialBadgeMessageElement, 'Failed to update special badge.', 'error');
  }
}

async function awardSpecialBadge() {
  const badgeId = safeText(awardBadgeSelect?.value, '').trim();
  const selectedStudentIds = getSelectedAwardStudentIds();
  const badge = specialBadgeOptionsCache.find((record) => record.id === badgeId);

  if (!badgeId || !badge) {
    setMessageOnElement(awardBadgeMessageElement, 'Please select a badge.', 'error');
    return;
  }

  if (!selectedStudentIds.length) {
    setMessageOnElement(awardBadgeMessageElement, 'Please check at least one student.', 'error');
    return;
  }

  const selectedStudents = selectedStudentIds
    .map((studentId) => studentOptionsCache.find((record) => record.id === studentId))
    .filter(Boolean);

  if (!selectedStudents.length) {
    setMessageOnElement(awardBadgeMessageElement, 'Selected students are no longer available.', 'error');
    return;
  }

  if (awardSpecialBadgeButton) {
    awardSpecialBadgeButton.disabled = true;
    awardSpecialBadgeButton.textContent = 'Awarding...';
  }

  try {
    const duplicateSnapshots = await Promise.all(
      selectedStudents.map((student) =>
        getDocs(query(collection(db, 'studentSpecialBadges'), where('studentId', '==', student.id)))
      )
    );

    const duplicateStudentIds = new Set();
    duplicateSnapshots.forEach((snapshot, index) => {
      const hasActiveDuplicate = snapshot.docs.some((item) => {
        const data = item.data() || {};
        return data.badgeId === badgeId && safeText(data.status, 'active') === 'active';
      });

      if (hasActiveDuplicate) {
        duplicateStudentIds.add(selectedStudents[index].id);
      }
    });

    const studentsToAward = selectedStudents.filter((student) => !duplicateStudentIds.has(student.id));

    if (!studentsToAward.length) {
      setMessageOnElement(awardBadgeMessageElement, 'All checked students already have that active special badge.', 'error');
      return;
    }

    const MAX_BATCH_SIZE = 240;
    for (let index = 0; index < studentsToAward.length; index += MAX_BATCH_SIZE) {
      const chunk = studentsToAward.slice(index, index + MAX_BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((student) => {
        const awardRef = doc(collection(db, 'studentSpecialBadges'));
        batch.set(awardRef, {
          badgeId,
          studentId: student.id,
          studentName: student.displayName,
          name: badge.name || 'Untitled Badge',
          imageUrl: getBadgeImageDisplayUrl(badge.imageUrl || badge.originalImageUrl || ''),
          originalImageUrl: badge.originalImageUrl || badge.imageUrl || '',
          description: badge.description || '',
          type: 'special',
          status: 'active',
          awardedBy: currentSuperAdminUser?.uid || '',
          awardedAt: serverTimestamp()
        });
        batch.set(doc(db, 'notifications', `special_badge_${badgeId}_${student.id}`), buildStudentNotificationPayload({
          studentId: student.id,
          title: 'New Special Badge',
          message: `${badge.name || 'A special badge'} was added to your profile.`,
          type: 'badge',
          sourceType: 'specialBadge',
          sourceId: badgeId,
          actionPage: 'profile',
          metadata: {
            badgeId,
            awardType: 'special'
          }
        }), { merge: true });
      });

      await batch.commit();
    }

    renderAwardStudentCheckboxes(studentOptionsCache);

    const skippedText = duplicateStudentIds.size ? ` ${duplicateStudentIds.size} already had it and were skipped.` : '';
    setMessageOnElement(
      awardBadgeMessageElement,
      `Awarded ${badge.name || 'badge'} to ${studentsToAward.length} student(s).${skippedText}`,
      'success'
    );
  } catch (error) {
    console.error('Failed to award special badge:', error);
    setMessageOnElement(awardBadgeMessageElement, 'Failed to award special badge.', 'error');
  } finally {
    if (awardSpecialBadgeButton) {
      awardSpecialBadgeButton.disabled = false;
      awardSpecialBadgeButton.textContent = 'Award Checked Students';
    }
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

schoolYearsListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.schoolYearId) {
    return;
  }

  target.disabled = true;

  await toggleSchoolYearStatus(target.dataset.schoolYearId, target.dataset.currentStatus || 'inactive');
});

termsListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.termId) {
    return;
  }

  target.disabled = true;

  await toggleTermStatus(target.dataset.termId, target.dataset.currentStatus || 'inactive');
});

subjectsListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.subjectId) {
    return;
  }

  target.disabled = true;

  await toggleSubjectStatus(target.dataset.subjectId, target.dataset.currentStatus || 'inactive');
});

sectionsListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.sectionId) {
    return;
  }

  target.disabled = true;

  await toggleSectionStatus(target.dataset.sectionId, target.dataset.currentStatus || 'inactive');
});

specialBadgesListElement?.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.specialBadgeId) {
    return;
  }

  target.disabled = true;
  await toggleSpecialBadgeStatus(target.dataset.specialBadgeId, target.dataset.currentStatus || 'inactive');
});

announcementModerationListElement?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deactivateButton = target.closest('button[data-announcement-deactivate]');
  if (deactivateButton instanceof HTMLButtonElement) {
    deactivateButton.disabled = true;
    await deactivateAnnouncement(deactivateButton.dataset.announcementDeactivate);
    deactivateButton.disabled = false;
    return;
  }

  const deleteButton = target.closest('button[data-announcement-delete]');
  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.disabled = true;
    await deleteAnnouncement(deleteButton.dataset.announcementDelete);
    deleteButton.disabled = false;
  }
});

superAdminQuestTargetTypeElement?.addEventListener('change', () => {
  populateQuestTargetOptions();
});

superAdminSaveQuestButton?.addEventListener('click', saveSuperAdminQuest);

superAdminCancelQuestEditButton?.addEventListener('click', () => {
  clearSuperAdminQuestForm();
  setMessageOnElement(superAdminQuestMessageElement, 'Edit cancelled.', '');
});

superAdminQuestsListElement?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editButton = target.closest('button[data-super-quest-edit]');
  if (editButton instanceof HTMLButtonElement) {
    const questId = safeText(editButton.dataset.superQuestEdit, '').trim();
    const quest = superAdminQuests.find((item) => item.id === questId);
    if (!quest) {
      setMessageOnElement(superAdminQuestMessageElement, 'Quest is no longer available.', 'error');
      return;
    }
    setSuperAdminQuestEditMode(quest);
    setMessageOnElement(superAdminQuestMessageElement, 'Editing quest. Update the form and save when ready.', '');
    superAdminQuestTitleElement?.focus();
    return;
  }

  const deleteButton = target.closest('button[data-super-quest-delete]');
  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.disabled = true;
    await deleteSuperAdminQuest(deleteButton.dataset.superQuestDelete);
    deleteButton.disabled = false;
  }
});

addSchoolYearButton?.addEventListener('click', addSchoolYear);
addTermButton?.addEventListener('click', addTerm);
addSubjectButton?.addEventListener('click', addSubject);
addSectionButton?.addEventListener('click', addSection);
addSpecialBadgeButton?.addEventListener('click', addSpecialBadge);
awardSpecialBadgeButton?.addEventListener('click', awardSpecialBadge);
awardSectionFilterSelect?.addEventListener('change', () => renderAwardStudentCheckboxes(studentOptionsCache));
recomputeRankingsButton?.addEventListener('click', recomputeSectionRankings);
recomputeStudentRankingsButton?.addEventListener('click', recomputeStudentRankings);
rankingSchoolYearSelect?.addEventListener('change', refreshSectionLeaderboard);

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetPage = button.dataset.target;
    if (!targetPage) return;
    showPage(targetPage);
    if (targetPage === 'quests') {
      loadSuperAdminQuests();
    }
    if (targetPage === 'messages') {
      refreshConversations();
    }
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

  currentSuperAdminUser = user;

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

 await seedAchievementsIfEmpty();

await Promise.all([
  refreshTeacherViews(),
  loadSchoolYears(),
  loadTerms(),
  loadSubjects(),
  loadSections(),
  loadAchievementBadgePreviews(),
  loadAnnouncementModeration(),
  loadSpecialBadges(),
  loadStudentOptions(),
  loadSuperAdminQuests()
]);
await initMessagingUI();
startMessagingAutoRefresh();
showPage(getSavedPage(), { persist: false });
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
  showLoadingOverlay('Initializing C.O.T.E System...');
  playLoadingSequence(
    ['Initializing C.O.T.E System...', 'Loading Command Authority...', 'Syncing Records...'],
    380
  ).then(async () => {
    await wait(190);
    hideLoadingOverlay();
  });
});
