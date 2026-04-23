let currentClassRecordClassId = '';
let currentClassRecordClassName = '';
let currentClassRecordActivities = [];
let currentClassRecordRows = [];

function getActivityLabel(type) {
  if (type === 'WW') return 'Written Works';
  if (type === 'PT') return 'Performance Task';
  if (type === 'Exam') return 'Exam';
  return type || 'Activity';
}

function sortActivities(activities = []) {
  const order = { WW: 1, PT: 2, Exam: 3 };
  return [...activities].sort((a, b) => {
    const typeDiff = (order[a.type] || 99) - (order[b.type] || 99);
    if (typeDiff !== 0) return typeDiff;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function buildActivityGroups(activities = []) {
  const groups = [];
  const grouped = {
    WW: [],
    PT: [],
    Exam: []
  };

  activities.forEach((activity) => {
    if (!grouped[activity.type]) grouped[activity.type] = [];
    grouped[activity.type].push(activity);
  });

  ['WW', 'PT', 'Exam'].forEach((type) => {
    if (grouped[type]?.length) {
      groups.push({
        type,
        label: getActivityLabel(type),
        activities: grouped[type]
      });
    }
  });

  return groups;
}

function normalizeActivity(activityDoc) {
  const data = activityDoc.data();

  return {
    id: activityDoc.id,
    classId: String(data.classId || '').trim(),
    title: String(data.title || '').trim(),
    type: String(data.type || '').trim(),
    maxScore: Number(data.maxScore || 0),
    teacherId: String(data.teacherId || '').trim()
  };
}

async function loadActivitiesByClass(classId) {
  const snapshot = await getDocs(
    query(collection(db, 'activities'), where('classId', '==', classId))
  );

  return sortActivities(
    snapshot.docs
      .map(normalizeActivity)
      .filter((activity) => activity.classId === classId && activity.title && activity.type)
  );
}

function renderClassRecordTable(rows = [], activities = [], emptyMessage = 'No approved students found.') {
  const tableContainer = document.getElementById('class-record-table');
  if (!tableContainer) return;

  const sortedActivities = sortActivities(activities);
  const groups = buildActivityGroups(sortedActivities);
  const colCount = 1 + sortedActivities.length;

  if (!sortedActivities.length) {
    tableContainer.innerHTML = `
      <table class="student-table">
        <thead>
          <tr>
            <th>Name / Highest Possible Score</th>
            <th>No activity columns yet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="2" class="empty-cell">Add Quiz 1, Quiz 2, Activity 1, PT 1, or Exam 1.</td>
          </tr>
        </tbody>
      </table>
    `;
    return;
  }

  tableContainer.innerHTML = `
    <table class="student-table class-record-gradebook">
      <thead>
        <tr>
          <th>Name / Highest Possible Score</th>
          ${groups.map(group => `
            <th colspan="${group.activities.length}">${safeText(group.label)}</th>
          `).join('')}
        </tr>
        <tr>
          <th>Activity</th>
          ${sortedActivities.map(activity => `
            <th>${safeText(activity.title)}</th>
          `).join('')}
        </tr>
        <tr>
          <th>Highest Possible Score</th>
          ${sortedActivities.map(activity => `
            <th>${Number(activity.maxScore)}</th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows.map(row => `
              <tr>
                <td>${safeText(row.name)}</td>
                ${sortedActivities.map(activity => {
                  const value = row.scores?.[activity.id] ?? '';
                  return `
                    <td
                      class="class-record-score-cell"
                      data-student-id="${row.studentId}"
                      data-activity-id="${activity.id}"
                      style="cursor:pointer;"
                    >
                      ${value === '' ? '' : Number(value)}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')
            : `<tr><td colspan="${colCount}" class="empty-cell">${safeText(emptyMessage)}</td></tr>`
        }
      </tbody>
    </table>
  `;
}

async function addClassRecordActivity() {
  const classId = String(document.getElementById('class-record-filter')?.value || '').trim();
  const title = String(document.getElementById('activity-title')?.value || '').trim();
  const type = String(document.getElementById('activity-type')?.value || '').trim();
  const maxScore = Number(document.getElementById('activity-max-score')?.value || 0);

  if (!classId) {
    setClassRecordMessage('Select a class first.', 'error');
    return;
  }

  if (!title || !type || !maxScore || maxScore <= 0) {
    setClassRecordMessage('Complete activity title, type, and highest possible score.', 'error');
    return;
  }

  await addDoc(collection(db, 'activities'), {
    classId,
    title,
    type,
    maxScore,
    teacherId: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  document.getElementById('activity-title').value = '';
  document.getElementById('activity-max-score').value = '';

  setClassRecordMessage('Activity added.', 'success');
  await loadClassRecord(classId);
}

async function computeStudentScores(classId) {
  const students = await loadStudentsFromApprovedEnrollments(classId);
  const activities = await loadActivitiesByClass(classId);

  currentClassRecordActivities = activities;

  const scoreSnapshot = await getDocs(
    query(collection(db, 'scores'), where('classId', '==', classId))
  );

  const rows = students.map(student => ({
    studentId: student.id,
    name: formatFullName(student),
    scores: {},
    scoreDocIds: {}
  }));

  scoreSnapshot.docs.forEach(scoreDoc => {
    const scoreData = scoreDoc.data();
    const row = rows.find(item => item.studentId === scoreData.studentId);

    if (!row || !scoreData.activityId) return;

    row.scores[scoreData.activityId] = scoreData.score;
    row.scoreDocIds[scoreData.activityId] = scoreDoc.id;
  });

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadClassRecord(classId) {
  currentClassRecordClassId = classId;

  if (!classId) {
    renderClassRecordTable([], [], 'Select a class first.');
    setClassRecordMessage('Select a class first.');
    return;
  }

  setClassRecordMessage('Loading class record...');

  const selectedClass = teacherClasses.find(item => item.id === classId);
  currentClassRecordClassName = selectedClass ? formatClassLabel(selectedClass) : 'Class';

  try {
    currentClassRecordRows = await computeStudentScores(classId);

    renderClassRecordTable(currentClassRecordRows, currentClassRecordActivities);
    setClassRecordMessage(
      `Loaded ${currentClassRecordRows.length} students and ${currentClassRecordActivities.length} activities.`,
      'success'
    );
  } catch (error) {
    console.error(error);
    renderClassRecordTable([], [], 'Unable to load class record.');
    setClassRecordMessage('Unable to load class record.', 'error');
  }
}

async function editClassRecordScore(studentId, activityId) {
  const classId = currentClassRecordClassId;
  const row = currentClassRecordRows.find(item => item.studentId === studentId);
  const activity = currentClassRecordActivities.find(item => item.id === activityId);

  if (!classId || !row || !activity) return;

  const oldValue = row.scores?.[activityId] ?? '';
  const input = prompt(`Enter score for ${row.name}\n${activity.title} / ${activity.maxScore}`, oldValue);

  if (input === null) return;

  const score = Number(input);

  if (Number.isNaN(score) || score < 0 || score > activity.maxScore) {
    setClassRecordMessage(`Score must be from 0 to ${activity.maxScore}.`, 'error');
    return;
  }

  const existing = await getDocs(
    query(
      collection(db, 'scores'),
      where('classId', '==', classId),
      where('studentId', '==', studentId),
      where('activityId', '==', activityId)
    )
  );

  const payload = {
    classId,
    studentId,
    studentName: row.name,
    activityId,
    type: activity.type,
    componentType: activity.type,
    title: activity.title,
    score,
    maxScore: activity.maxScore,
    teacherId: auth.currentUser.uid,
    updatedAt: serverTimestamp()
  };

  if (existing.empty) {
    await addDoc(collection(db, 'scores'), {
      ...payload,
      createdAt: serverTimestamp()
    });
  } else {
    await updateDoc(doc(db, 'scores', existing.docs[0].id), payload);
  }

  setClassRecordMessage('Score updated.', 'success');
  await loadClassRecord(classId);
}

function downloadClassRecordCSV() {
  const activities = sortActivities(currentClassRecordActivities);

  const rows = [
    ['', ...activities.map(activity => getActivityLabel(activity.type))],
    ['Name / Highest Possible Score', ...activities.map(activity => activity.title)],
    ['Highest Possible Score', ...activities.map(activity => activity.maxScore)],
    ...currentClassRecordRows.map(row => [
      row.name,
      ...activities.map(activity => row.scores?.[activity.id] ?? '')
    ])
  ];

  const csv = rows
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `class-record-${currentClassRecordClassName || 'class'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function printClassRecord() {
  const tableHtml = document.getElementById('class-record-table')?.innerHTML || '';

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Class Record</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 6px; text-align: center; }
          th:first-child, td:first-child { text-align: left; }
        </style>
      </head>
      <body>
        <h2>Class Record</h2>
        <p>${currentClassRecordClassName || ''}</p>
        ${tableHtml}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

document.getElementById('add-activity-button')?.addEventListener('click', addClassRecordActivity);

document.getElementById('class-record-filter')?.addEventListener('change', event => {
  loadClassRecord(event.target.value);
});

document.getElementById('class-record-table')?.addEventListener('click', event => {
  const cell = event.target.closest('.class-record-score-cell');
  if (!cell) return;

  editClassRecordScore(cell.dataset.studentId, cell.dataset.activityId);
});

document.getElementById('class-record-download-button')?.addEventListener('click', downloadClassRecordCSV);
document.getElementById('class-record-print-button')?.addEventListener('click', printClassRecord);
