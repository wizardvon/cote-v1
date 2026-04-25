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
import {
  getVisibleAchievementsForStudent,
  getStudentUnlockedAchievementIds,
  getAchievementRequirementText,
  seedAchievementsIfEmpty
} from './achievements.js';

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
const homeSectionNameElement = document.getElementById('home-section-name');
const homeSectionTierElement = document.getElementById('home-section-tier');
const homeSectionRankElement = document.getElementById('home-section-rank');
const homeSectionPointsElement = document.getElementById('home-section-points');
const leaderboardListElement = document.getElementById('leaderboard-list');
const profileRankElement = document.getElementById('profile-rank');
const profileStudentRankElement = document.getElementById('profile-student-rank');
const profileSectionTierElement = document.getElementById('profile-section-tier');
const profileSectionRankElement = document.getElementById('profile-section-rank');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const burgerButton = document.getElementById('burger-button');

const menuButtons = Array.from(document.querySelectorAll('.menu-btn'));
const pages = Array.from(document.querySelectorAll('.page'));
const recordsPageElement = document.getElementById('page-records');
const achievementsPageElement = document.getElementById('page-achievements');
const achievementsSummaryElement = document.getElementById('achievements-summary');
const unlockedAchievementsListElement = document.getElementById('unlocked-achievements-list');
const nextAchievementsListElement = document.getElementById('next-achievements-list');
const availableClassesListElement = document.getElementById('available-classes-list');
const myEnrollmentsListElement = document.getElementById('my-enrollments-list');
const myClassesFeedbackElement = document.getElementById('my-classes-feedback');
const classRecordsDetailElement = document.getElementById('class-records-detail');
const studentResourcesListElement = document.getElementById('student-resources-list');
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
  achievements: 'Achievements',
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

function formatDateTime(value) {
  if (!value?.toDate) return '';
  return value.toDate().toLocaleString();
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

function renderStudentResources(resources = []) {
  if (!studentResourcesListElement) return;

  if (!resources.length) {
    studentResourcesListElement.innerHTML = '<p>No active resources found for your approved classes.</p>';
    return;
  }

  studentResourcesListElement.innerHTML = resources
    .map((resource) => {
      return `
        <article class="app-card">
          <h4>${escapeHtml(resource.title || 'Untitled Resource')}</h4>
          <p><strong>Subject:</strong> ${escapeHtml(resource.subjectName || 'Not provided')}</p>
          <p><strong>Teacher:</strong> ${escapeHtml(resource.teacherName || 'Unknown Teacher')}</p>
          <p><strong>Description:</strong> ${escapeHtml(resource.description || 'No description')}</p>
          <p><strong>Class:</strong> ${escapeHtml(resource.sectionName || 'Not provided')}</p>
          <p><strong>Uploaded:</strong> ${escapeHtml(formatDateTime(resource.createdAt) || '—')}</p>
          ${renderResourceMedia(resource)}
        </article>
      `;
    })
    .join('');

  studentResourcesListElement.querySelectorAll('button[data-resource-url]').forEach((button) => {
    button.addEventListener('click', () => {
      const url = String(button.dataset.resourceUrl || '').trim();
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

}

async function loadStudentResources() {
  if (!studentResourcesListElement || !currentStudentUser?.uid) return;

  const classIds = [...enrolledClassIds].filter(Boolean);
  if (!classIds.length) {
    studentResourcesListElement.innerHTML = '<p>Get approved in classes to view resources.</p>';
    return;
  }

  studentResourcesListElement.innerHTML = '<p>Loading resources...</p>';

  try {
    const chunks = [];
    for (let i = 0; i < classIds.length; i += 10) {
      chunks.push(classIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
      chunks.map((ids) =>
        getDocs(query(collection(db, 'resources'), where('classId', 'in', ids), where('status', '==', 'active')))
      )
    );

    const resources = snapshots
      .flatMap((snapshot) => snapshot.docs.map((resourceDoc) => ({ id: resourceDoc.id, ...resourceDoc.data() })))
      .filter((resource) => classIds.includes(String(resource.classId || '').trim()))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    renderStudentResources(resources);
  } catch (error) {
    console.error('Failed to load student resources:', error);
    studentResourcesListElement.innerHTML = '<p>Unable to load resources right now.</p>';
  }
}

function renderMyEnrollments(enrollments) {
  if (!myEnrollmentsListElement) return;

  if (!enrollments.length) {
    myEnrollmentsListElement.innerHTML = '<p>No approved classes yet.</p>';
    return;
  }

  myEnrollmentsListElement.innerHTML = enrollments
    .map((enrollment) => {
      const classData = enrollment.classData || {};
      const subjectName = classData.subjectName || enrollment.subjectName || 'Unknown Subject';
      const subjectCode = classData.subjectCode || enrollment.subjectCode || 'Not provided';
      const sectionName = classData.sectionName || enrollment.sectionName || 'Not provided';
      const schoolYear = classData.schoolYearName || classData.schoolYear || enrollment.schoolYearName || 'Not provided';
      const term = classData.termName || classData.term || enrollment.termName || 'Not provided';
      const teacherName =
        classData.teacherName ||
        enrollment.teacherName ||
        classData.teacherEmail ||
        'Not assigned';

      return `
        <article class="app-card">
          <p><strong>Subject:</strong> ${escapeHtml(subjectName)}</p>
          <p><strong>Subject Code:</strong> ${escapeHtml(subjectCode)}</p>
          <p><strong>Section:</strong> ${escapeHtml(sectionName)}</p>
          <p><strong>School Year:</strong> ${escapeHtml(schoolYear)}</p>
          <p><strong>Term:</strong> ${escapeHtml(term)}</p>
          <p><strong>Teacher:</strong> ${escapeHtml(teacherName)}</p>
          <button type="button" class="view-records-btn" data-class-id="${escapeHtml(enrollment.classId || '')}">
            View Records
          </button>
        </article>
      `;
    })
    .join('');

  const viewRecordButtons = myEnrollmentsListElement.querySelectorAll('.view-records-btn');
  viewRecordButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const classId = String(button.dataset.classId || '').trim();
      const selectedEnrollment = enrollments.find((item) => String(item.classId || '').trim() === classId);
      await loadClassRecordsDetail(selectedEnrollment || {});
    });
  });
}

function formatScoreValue(score, maxScore) {
  const normalizedScore = normalizeNumericValue(score, Number.NaN);
  const normalizedMax = normalizeNumericValue(maxScore, Number.NaN);

  if (!Number.isFinite(normalizedScore) || !Number.isFinite(normalizedMax) || normalizedMax <= 0) {
    return '--';
  }

  return `${normalizedScore}/${normalizedMax}`;
}

function formatSignedNumber(value) {
  const normalized = normalizeNumericValue(value, 0);
  if (normalized > 0) return `+${normalized}`;
  return String(normalized);
}

function getClassMetadata(enrollment = {}) {
  const classData = enrollment.classData || {};
  return {
    classId: String(enrollment.classId || classData.id || '').trim(),
    subjectName: classData.subjectName || enrollment.subjectName || 'Unknown Subject',
    subjectCode: classData.subjectCode || enrollment.subjectCode || 'Not provided',
    teacherName: classData.teacherName || enrollment.teacherName || classData.teacherEmail || 'Not assigned',
    schoolYearName: classData.schoolYearName || classData.schoolYear || enrollment.schoolYearName || 'Not provided',
    termName: classData.termName || classData.term || enrollment.termName || 'Not provided',
    sectionName: classData.sectionName || enrollment.sectionName || 'Not provided',
  };
}

function renderClassRecordsDetail({ metadata = {}, rows = [], summary = {} } = {}) {
  if (!classRecordsDetailElement) return;

  if (!metadata.classId) {
    classRecordsDetailElement.innerHTML = '<p>Select an approved class and click <strong>View Records</strong>.</p>';
    return;
  }

  const rowsHtml = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.activityTitle)}</td>
              <td>${escapeHtml(row.type)}</td>
              <td>${escapeHtml(row.scoreDisplay)}</td>
              <td>${escapeHtml(row.percentageDisplay)}</td>
              <td>${escapeHtml(row.academicPointsDisplay)}</td>
            </tr>
          `
        )
        .join('')
    : `<tr><td colspan="5" class="empty-cell">No records available for this class yet.</td></tr>`;

  classRecordsDetailElement.innerHTML = `
    <div class="info-grid">
      <p><strong>Subject Name:</strong> ${escapeHtml(metadata.subjectName || 'Not provided')}</p>
      <p><strong>Subject Code:</strong> ${escapeHtml(metadata.subjectCode || 'Not provided')}</p>
      <p><strong>Teacher Name:</strong> ${escapeHtml(metadata.teacherName || 'Not provided')}</p>
      <p><strong>School Year:</strong> ${escapeHtml(metadata.schoolYearName || 'Not provided')}</p>
      <p><strong>Term:</strong> ${escapeHtml(metadata.termName || 'Not provided')}</p>
      <p><strong>Section:</strong> ${escapeHtml(metadata.sectionName || 'Not provided')}</p>
    </div>

    <div class="my-classes-summary-grid">
      <article class="summary-card">
        <p>Total Activities</p>
        <h4>${escapeHtml(String(summary.totalActivities || 0))}</h4>
      </article>
      <article class="summary-card">
        <p>Total Academic Points</p>
        <h4>${escapeHtml(formatSignedNumber(summary.totalAcademicPoints || 0))}</h4>
      </article>
      <article class="summary-card">
        <p>Average Percentage</p>
        <h4>${escapeHtml(summary.averagePercentageDisplay || '0%')}</h4>
      </article>
    </div>

    <div class="admin-table-wrap">
      <table class="student-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Type</th>
            <th>Score</th>
            <th>Percentage</th>
            <th>Academic Points</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

async function loadClassRecordsDetail(enrollment = {}) {
  if (!currentStudentUser?.uid || !classRecordsDetailElement) return;

  const metadata = getClassMetadata(enrollment);
  if (!metadata.classId) {
    renderClassRecordsDetail({ metadata });
    return;
  }

  classRecordsDetailElement.innerHTML = '<p>Loading class records...</p>';

  try {
    const classId = metadata.classId;
    const studentId = currentStudentUser.uid;
    const activitiesSnapshot = await getDocs(query(collection(db, 'activities'), where('classId', '==', classId)));

    let scoresSnapshot;
    try {
      scoresSnapshot = await getDocs(
        query(collection(db, 'scores'), where('classId', '==', classId), where('studentId', '==', studentId))
      );
    } catch (error) {
      console.error('Failed to query scores with compound filter:', error);
      const fallbackSnapshot = await getDocs(query(collection(db, 'scores'), where('classId', '==', classId)));
      const filteredDocs = fallbackSnapshot.docs.filter(
        (scoreDoc) => String(scoreDoc.data().studentId || '').trim() === studentId
      );
      scoresSnapshot = { docs: filteredDocs };
    }

    let pointLogsSnapshot;
    try {
      pointLogsSnapshot = await getDocs(
        query(
          collection(db, 'pointLogs'),
          where('classId', '==', classId),
          where('studentId', '==', studentId),
          where('source', '==', 'academic')
        )
      );
    } catch (error) {
      console.error('Failed to query point logs with compound filter:', error);
      const fallbackSnapshot = await getDocs(query(collection(db, 'pointLogs'), where('classId', '==', classId)));
      const filteredDocs = fallbackSnapshot.docs.filter((logDoc) => {
        const log = logDoc.data() || {};
        return String(log.studentId || '').trim() === studentId && String(log.source || '').trim().toLowerCase() === 'academic';
      });
      pointLogsSnapshot = { docs: filteredDocs };
    }

    const activities = activitiesSnapshot.docs.map((activityDoc) => ({
      id: activityDoc.id,
      ...activityDoc.data(),
    }));

    const scoresByActivityId = new Map(
      scoresSnapshot.docs.map((scoreDoc) => {
        const score = scoreDoc.data() || {};
        return [String(score.activityId || '').trim(), score];
      })
    );

    const pointsByActivityId = new Map(
      pointLogsSnapshot.docs.map((pointLogDoc) => {
        const log = pointLogDoc.data() || {};
        return [String(log.activityId || '').trim(), log];
      })
    );

    const rows = activities.map((activity) => {
      const activityId = String(activity.id || '').trim();
      const scoreEntry = scoresByActivityId.get(activityId) || {};
      const pointLogEntry = pointsByActivityId.get(activityId) || {};
      const score = Number(scoreEntry.score);
      const maxScore = Number(activity.maxScore ?? scoreEntry.maxScore);
      const hasValidScore = Number.isFinite(score) && Number.isFinite(maxScore) && maxScore > 0;
      const percentage = hasValidScore ? Number(((score / maxScore) * 100).toFixed(2)) : Number.NaN;
      const awardedPoints = normalizeNumericValue(pointLogEntry.awardedPoints, 0);

      return {
        activityTitle: String(activity.title || scoreEntry.title || 'Untitled Activity'),
        type: String(activity.componentType || activity.type || scoreEntry.componentType || scoreEntry.type || '--'),
        scoreDisplay: formatScoreValue(score, maxScore),
        percentageDisplay: Number.isFinite(percentage) ? `${formatPercentage(percentage)}%` : '--',
        academicPoints: awardedPoints,
        academicPointsDisplay: formatSignedNumber(awardedPoints),
        percentageValue: percentage,
      };
    });

    const rowsWithScores = rows.filter((row) => row.scoreDisplay !== '--');

    const percentages = rows
      .map((row) => row.percentageValue)
      .filter((value) => Number.isFinite(value));
    const averagePercentage = percentages.length
      ? Number((percentages.reduce((sum, value) => sum + value, 0) / percentages.length).toFixed(2))
      : 0;

    const totalAcademicPoints = rows.reduce((sum, row) => sum + normalizeNumericValue(row.academicPoints, 0), 0);

    renderClassRecordsDetail({
      metadata,
      rows: rowsWithScores,
      summary: {
        totalActivities: activities.length,
        totalAcademicPoints,
        averagePercentageDisplay: `${formatPercentage(averagePercentage)}%`,
      },
    });
  } catch (error) {
    console.error('Failed to load class-specific records:', error);
    classRecordsDetailElement.innerHTML = '<p>Unable to load class records. Please try again later.</p>';
  }
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

  myEnrollmentsListElement.innerHTML = '<p>Loading approved classes...</p>';
  if (classRecordsDetailElement) {
    classRecordsDetailElement.innerHTML = '<p>Select an approved class and click <strong>View Records</strong>.</p>';
  }

  try {
    let enrollmentsSnapshot;
    try {
      const enrollmentsQuery = query(
        collection(db, 'classEnrollments'),
        where('studentId', '==', currentStudentUser.uid),
        where('status', '==', 'approved'),
        orderBy('requestedAt', 'desc')
      );
      enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    } catch (error) {
      const fallbackSnapshot = await getDocs(
        query(
          collection(db, 'classEnrollments'),
          where('studentId', '==', currentStudentUser.uid),
          where('status', '==', 'approved')
        )
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
    await loadStudentResources();
  } catch (error) {
    console.error('Failed to load enrollments:', error);
    myEnrollmentsListElement.innerHTML = '<p>Unable to load approved classes. Please try again later.</p>';
    if (studentResourcesListElement) {
      studentResourcesListElement.innerHTML = '<p>Unable to load resources because approved classes failed to load.</p>';
    }
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

    if (profileStudentRankElement) {
      profileStudentRankElement.textContent = 'Not yet assigned';
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


function formatAchievementDate(value) {
  if (!value?.toDate) return 'Recently unlocked';
  return value.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAchievementStatusDetails(achievement, unlockedIds) {
  const isUnlocked = unlockedIds.has(achievement.id);
  const requirement = getAchievementRequirementText(achievement);
  return {
    isUnlocked,
    statusLabel: isUnlocked ? 'Unlocked' : 'Locked • visible',
    requirement
  };
}

function renderAchievementCard(achievement, unlockedIds) {
  const status = getAchievementStatusDetails(achievement, unlockedIds);
  const achievedAt = achievement.achievedAt ? `<p><strong>Achieved:</strong> ${escapeHtml(formatAchievementDate(achievement.achievedAt))}</p>` : '';

  return `
    <li class="achievement-card ${status.isUnlocked ? 'unlocked' : 'locked'}">
      <div class="achievement-card-header">
        <h4>${escapeHtml(achievement.title || 'Untitled Achievement')}</h4>
        <span class="achievement-status-pill ${status.isUnlocked ? 'unlocked' : 'locked'}">${escapeHtml(status.statusLabel)}</span>
      </div>
      <p>${escapeHtml(achievement.description || 'No description available.')}</p>
      <p><strong>Category:</strong> ${escapeHtml(achievement.category || 'General')}</p>
      <p><strong>Reward:</strong> +${escapeHtml(String(achievement.rewardPoints || 0))} points</p>
      ${status.isUnlocked ? achievedAt : `<p><strong>Requirement:</strong> ${escapeHtml(status.requirement)}</p>`}
    </li>
  `;
}

async function loadAchievementsDashboard(studentId) {
  if (!achievementsPageElement) return;

  if (achievementsSummaryElement) {
    achievementsSummaryElement.innerHTML = '<p>Loading achievements...</p>';
  }
  if (unlockedAchievementsListElement) {
    unlockedAchievementsListElement.innerHTML = '<li>Loading unlocked achievements...</li>';
  }
  if (nextAchievementsListElement) {
    nextAchievementsListElement.innerHTML = '<li>Loading next achievements...</li>';
  }

  try {
    const [visibleAchievements, unlockedIds] = await Promise.all([
      getVisibleAchievementsForStudent(studentId),
      getStudentUnlockedAchievementIds(studentId)
    ]);

    const unlockedAchievements = visibleAchievements.filter((achievement) => unlockedIds.has(achievement.id));
    const lockedVisibleAchievements = visibleAchievements.filter((achievement) => !unlockedIds.has(achievement.id));

    const latestAchievement = unlockedAchievements
      .slice()
      .sort((a, b) => (b.achievedAt?.toMillis?.() || 0) - (a.achievedAt?.toMillis?.() || 0))[0];

    const nextAchievement = lockedVisibleAchievements[0] || null;

    if (achievementsSummaryElement) {
      achievementsSummaryElement.innerHTML = `
        <p><strong>Total achievements unlocked:</strong> ${unlockedAchievements.length}</p>
        <p><strong>Latest achievement:</strong> ${escapeHtml(latestAchievement?.title || 'No unlocked achievement yet')}</p>
        <p><strong>Next achievement:</strong> ${escapeHtml(nextAchievement?.title || 'No visible next achievement')}</p>
      `;
    }

    if (unlockedAchievementsListElement) {
      unlockedAchievementsListElement.innerHTML = unlockedAchievements.length
        ? unlockedAchievements.map((achievement) => renderAchievementCard(achievement, unlockedIds)).join('')
        : '<li>No achievements unlocked yet.</li>';
    }

    if (nextAchievementsListElement) {
      nextAchievementsListElement.innerHTML = lockedVisibleAchievements.length
        ? lockedVisibleAchievements.map((achievement) => renderAchievementCard(achievement, unlockedIds)).join('')
        : '<li>No visible locked achievements right now.</li>';
    }
  } catch (error) {
    console.error('Failed to load achievements dashboard:', error);
    if (achievementsSummaryElement) achievementsSummaryElement.innerHTML = '<p>Unable to load achievements summary right now.</p>';
    if (unlockedAchievementsListElement) unlockedAchievementsListElement.innerHTML = '<li>Unable to load unlocked achievements.</li>';
    if (nextAchievementsListElement) nextAchievementsListElement.innerHTML = '<li>Unable to load next achievements.</li>';
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

  if (profileStudentRankElement) {
    const studentRank = Number(data.studentRank);
    const sectionRankTotal = Number(data.sectionRankTotal);
    const hasRank = Number.isFinite(studentRank) && studentRank > 0;
    const hasTotal = Number.isFinite(sectionRankTotal) && sectionRankTotal > 0;

    profileStudentRankElement.textContent = hasRank && hasTotal ? `#${studentRank} of ${sectionRankTotal}` : 'Not yet assigned';
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

function setSectionStanding(data = {}) {
  const sectionName = safe(data.sectionName || data.name || currentStudentProfile?.sectionName || currentStudentProfile?.section);
  const tier = String(data.tier || '').trim() || 'Not yet ranked';
  const rankValue = Number(data.rank);
  const rank = Number.isFinite(rankValue) && rankValue > 0 ? rankValue : null;
  const points = normalizePoints(data.totalPoints);
  const rankLabel = rank ? `#${rank}` : 'Not yet ranked';

  if (homeSectionNameElement) {
    homeSectionNameElement.textContent = sectionName;
  }
  if (homeSectionTierElement) {
    homeSectionTierElement.innerHTML = `<span class="tier-pill ${String(tier).toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(
      tier
    )}</span>`;
  }
  if (homeSectionRankElement) {
    homeSectionRankElement.textContent = rankLabel;
  }
  if (homeSectionPointsElement) {
    homeSectionPointsElement.textContent = `${points.toLocaleString()} pts`;
  }
  if (profileSectionTierElement) {
    profileSectionTierElement.textContent = tier;
  }
  if (profileSectionRankElement) {
    profileSectionRankElement.textContent = rankLabel;
  }
}

async function loadStudentSectionStanding(studentData = {}) {
  const sectionId = String(studentData.sectionId || '').trim();
  const sectionName = String(studentData.sectionName || studentData.section || '').trim();
  const studentSchoolYearId = String(studentData.schoolYearId || '').trim();

  if (!sectionId) {
    setSectionStanding({
      sectionName: sectionName || 'No section assigned',
      tier: 'No section assigned',
      rank: null,
      totalPoints: 0,
    });
    return;
  }

  try {
    let sectionData = null;
    let resolvedSectionName = sectionName;
    const sectionSnap = await getDoc(doc(db, 'sections', sectionId));
    if (!sectionSnap.exists()) {
      setSectionStanding({
        sectionName: sectionName || 'Section record not found',
        tier: 'Section record not found',
        rank: null,
        totalPoints: 0,
      });
      return;
    }

    sectionData = sectionSnap.data() || {};
    resolvedSectionName = sectionData.name || sectionData.sectionName || sectionName;
    console.log('Student section data loaded:', {
      sectionId,
      sectionData
    });

    let tier = sectionData.tier || sectionData.sectionTier || 'Not yet ranked';
    let rank = sectionData.rank || sectionData.sectionRank || null;
    let totalPoints = sectionData.totalPoints || 0;

    const hasRank = Number.isFinite(Number(rank)) && Number(rank) > 0;
    const hasTier = String(tier || '').trim() && String(tier || '').trim() !== 'Not yet ranked';
    const shouldTryFallback = (!hasRank || !hasTier) && Boolean(resolvedSectionName) && Boolean(studentSchoolYearId);

    if ((!hasRank || !hasTier) && totalPoints > 0) {
      console.warn('Section has totalPoints but missing rank/tier. Recompute ranking in Super Admin.', sectionData);
    }

    if (shouldTryFallback) {
      let matchedSection = null;

      const byNameSnapshot = await getDocs(
        query(
          collection(db, 'sections'),
          where('name', '==', resolvedSectionName),
          where('schoolYearId', '==', studentSchoolYearId)
        )
      );
      matchedSection = byNameSnapshot.docs
        .map((item) => item.data())
        .find((item) => item && (item.rank || item.sectionRank) && (item.tier || item.sectionTier));

      if (!matchedSection) {
        const bySectionNameSnapshot = await getDocs(
          query(
            collection(db, 'sections'),
            where('sectionName', '==', resolvedSectionName),
            where('schoolYearId', '==', studentSchoolYearId)
          )
        );
        matchedSection = bySectionNameSnapshot.docs
          .map((item) => item.data())
          .find((item) => item && (item.rank || item.sectionRank) && (item.tier || item.sectionTier));
      }

      if (matchedSection) {
        sectionData = matchedSection;
        tier = sectionData.tier || sectionData.sectionTier || tier;
        rank = sectionData.rank || sectionData.sectionRank || rank;
        totalPoints = sectionData.totalPoints || totalPoints;
      }
    }

    setSectionStanding({
      sectionName: sectionData.name || sectionData.sectionName || resolvedSectionName,
      tier,
      rank,
      totalPoints,
    });
  } catch (error) {
    console.error('Failed to load section standing:', error);
    setSectionStanding({
      sectionName: sectionName || 'Section record not found',
      tier: 'Section record not found',
      rank: null,
      totalPoints: 0,
    });
  }
}

function renderStudentProfileNotFound(email = '', uid = '') {
  console.error('Student document not found:', uid);

  const fallback = safe(email);
  const supportMessage = 'Student profile not found. Please contact admin.';

  if (sidebarStudentNameElement) {
    sidebarStudentNameElement.textContent = 'Profile not found';
  }

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = fallback;
  }

  if (profileFullNameElement) {
    profileFullNameElement.textContent = 'Profile not found';
  }

  if (profileEmailElement) {
    profileEmailElement.textContent = fallback;
  }

  if (profileGradeSectionElement) {
    profileGradeSectionElement.textContent = supportMessage;
  }

  if (profileAvatarElement) {
    profileAvatarElement.textContent = '👤';
  }

  if (pointsTotalElement) {
    pointsTotalElement.textContent = '0';
  }

  if (homeStudentNameElement) {
    homeStudentNameElement.textContent = 'Profile not found';
  }

  if (homeStudentSectionElement) {
    homeStudentSectionElement.textContent = supportMessage;
  }

  if (homeStudentPointsElement) {
    homeStudentPointsElement.textContent = '0';
  }

  if (profileRankElement) {
    profileRankElement.textContent = 'Not ranked';
  }

  if (profileStudentRankElement) {
    profileStudentRankElement.textContent = 'Not yet assigned';
  }
  setSectionStanding({});

  if (profileDataElement) {
    profileDataElement.innerHTML = `
      <p><strong>Error:</strong> ${supportMessage}</p>
      <p><strong>UID:</strong> ${safe(uid)}</p>
      <p><strong>Email:</strong> ${fallback}</p>
      <p><strong>Total Points:</strong> 0</p>
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

  if (profileStudentRankElement) {
    profileStudentRankElement.textContent = 'Not yet assigned';
  }
  setSectionStanding({});

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
    if (target === 'resources') {
      loadStudentResources();
    }
    if (target === 'achievements' && currentStudentUser?.uid) {
      loadAchievementsDashboard(currentStudentUser.uid);
    }
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

onAuthStateChanged(auth, async () => {
  const user = auth.currentUser;

  if (!user) {
    window.location.replace('index.html');
    return;
  }

  const uid = user.uid;
  currentStudentUser = user;

  console.log('Auth UID:', uid);

  loadLeaderboard();

  if (sidebarStudentEmailElement) {
    sidebarStudentEmailElement.textContent = user.email || 'No email available';
  }

  try {
    const studentRef = doc(db, 'students', uid);
    const studentSnap = await getDoc(studentRef);

    console.log('Student doc:', studentSnap.exists());

    if (!studentSnap.exists()) {
      renderStudentProfileNotFound(user.email, uid);
      return;
    }

    const studentData = studentSnap.data();
    console.log('Student data:', studentData);

    currentStudentProfile = studentData;
    const points = normalizePoints(studentData.points);

    if (studentData.points === undefined) {
      await updateDoc(studentRef, { points: 0 });
      studentData.points = 0;
    } else {
      studentData.points = points;
    }

    setStudentData(studentData, user.email);
    await loadStudentSectionStanding(studentData);
    await seedAchievementsIfEmpty();
    loadPointLogs(uid);
    loadAchievementsDashboard(uid);
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

    if (profileStudentRankElement) {
      profileStudentRankElement.textContent = 'Not yet assigned';
    }
    setSectionStanding({});
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
