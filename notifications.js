import {
  db,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from './firebase.js';

function cleanText(value) {
  return String(value || '').trim();
}

function makeNotificationId(type, sourceId, recipientId, suffix = '') {
  return [type, sourceId, recipientId, suffix]
    .map((part) => cleanText(part).replace(/[^A-Za-z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('_');
}

export function buildStudentNotificationPayload({
  studentId,
  title,
  message,
  type = 'system',
  sourceType = type,
  sourceId = '',
  actionPage = '',
  metadata = {}
} = {}) {
  const recipientId = cleanText(studentId);
  if (!recipientId) return null;

  return {
    recipientId,
    recipientRole: 'student',
    title: cleanText(title) || 'New notification',
    message: cleanText(message),
    type: cleanText(type) || 'system',
    sourceType: cleanText(sourceType) || cleanText(type) || 'system',
    sourceId: cleanText(sourceId),
    actionPage: cleanText(actionPage),
    metadata,
    isRead: false,
    createdAt: serverTimestamp()
  };
}

export async function getApprovedClassStudentIds(classId) {
  const normalizedClassId = cleanText(classId);
  if (!normalizedClassId) return [];

  const snapshot = await getDocs(
    query(
      collection(db, 'classEnrollments'),
      where('classId', '==', normalizedClassId),
      where('status', '==', 'approved')
    )
  );

  return [...new Set(snapshot.docs.map((item) => cleanText(item.data()?.studentId)).filter(Boolean))];
}

export async function getAllStudentIds() {
  const snapshot = await getDocs(collection(db, 'students'));
  return snapshot.docs.map((item) => cleanText(item.id)).filter(Boolean);
}

export async function createStudentNotifications(studentIds = [], payloadFactory, options = {}) {
  const uniqueStudentIds = [...new Set(studentIds.map(cleanText).filter(Boolean))];
  if (!uniqueStudentIds.length || typeof payloadFactory !== 'function') return 0;

  const type = cleanText(options.type || 'notification');
  const sourceId = cleanText(options.sourceId || Date.now());
  const suffix = cleanText(options.suffix);
  const MAX_BATCH_SIZE = 450;
  let createdCount = 0;

  for (let index = 0; index < uniqueStudentIds.length; index += MAX_BATCH_SIZE) {
    const chunk = uniqueStudentIds.slice(index, index + MAX_BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((studentId) => {
      const payload = buildStudentNotificationPayload({
        studentId,
        ...payloadFactory(studentId)
      });
      if (!payload) return;

      const notificationId = makeNotificationId(payload.type || type, sourceId, studentId, suffix);
      batch.set(doc(db, 'notifications', notificationId), payload, { merge: true });
      createdCount += 1;
    });

    await batch.commit();
  }

  return createdCount;
}
