import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  writeBatch,
  increment
} from './firebase.js';
import { buildStudentNotificationPayload } from './notifications.js';

const QUEST_STATUS_ACTIVE = 'active';
const QUEST_STATUS_INACTIVE = 'inactive';
const STUDENT_QUEST_STATUS_ASSIGNED = 'assigned';
const STUDENT_QUEST_STATUS_COMPLETED = 'completed';

function cleanText(value) {
  return String(value || '').trim();
}

function normalizePoints(value) {
  const points = Number(value);
  return Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
}

function normalizeTargetIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item)).filter(Boolean))];
}

function normalizeDeadline(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : raw;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPastDeadline(deadline) {
  const deadlineMillis = toMillis(deadline);
  return deadlineMillis > 0 && Date.now() > deadlineMillis;
}

function makeStudentQuestId(questId, studentId) {
  return `${questId}_${studentId}`;
}

function formatStudentName(student = {}) {
  const fullName = [student.firstName, student.middleName, student.lastName]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return fullName || cleanText(student.displayName) || cleanText(student.email) || 'Student';
}

async function getUserRole(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return '';
  return cleanText(userSnap.data()?.role);
}

async function getClassStudentIds(classId) {
  const snapshot = await getDocs(
    query(collection(db, 'classEnrollments'), where('classId', '==', classId), where('status', '==', 'approved'))
  );
  return snapshot.docs.map((item) => cleanText(item.data()?.studentId)).filter(Boolean);
}

async function getSectionStudentIds(sectionId) {
  const snapshot = await getDocs(query(collection(db, 'students'), where('sectionId', '==', sectionId)));
  return snapshot.docs.map((item) => item.id);
}

async function assertTeacherCanUseTargets(uid, payload = {}, existingQuest = {}) {
  const role = await getUserRole(uid);
  if (role !== 'teacher') return;

  const targetType = cleanText(payload.targetType || existingQuest.targetType || 'class');
  const targetIds = normalizeTargetIds(Object.hasOwn(payload, 'targetIds') ? payload.targetIds : existingQuest.targetIds);

  if (targetType !== 'class') {
    throw new Error('Teachers can only create quests for their own classes.');
  }

  if (!targetIds.length) {
    throw new Error('Select one of your classes.');
  }

  const classSnapshots = await Promise.all(targetIds.map((classId) => getDoc(doc(db, 'classes', classId))));
  const hasInvalidClass = classSnapshots.some(
    (classSnap) => !classSnap.exists() || cleanText(classSnap.data()?.teacherId) !== uid
  );

  if (hasInvalidClass) {
    throw new Error('Teachers can only assign quests to their own classes.');
  }
}

async function resolveTargetStudentIds(quest = {}) {
  const targetType = cleanText(quest.targetType || 'all');
  const targetIds = normalizeTargetIds(quest.targetIds);

  if (targetType === 'students') {
    return targetIds;
  }

  if (targetType === 'class') {
    const idsByTarget = await Promise.all(
      targetIds.map(async (targetId) => {
        const classSnap = await getDoc(doc(db, 'classes', targetId));
        if (classSnap.exists()) {
          return getClassStudentIds(targetId);
        }
        return getSectionStudentIds(targetId);
      })
    );
    return [...new Set(idsByTarget.flat().filter(Boolean))];
  }

  const snapshot = await getDocs(query(collection(db, 'students'), where('status', '==', 'active')));
  return snapshot.docs.map((item) => item.id);
}

function validateQuestPayload(input = {}, { partial = false } = {}) {
  const payload = {};

  if (!partial || Object.hasOwn(input, 'title')) {
    payload.title = cleanText(input.title);
    if (!payload.title) throw new Error('Quest title is required.');
  }

  if (!partial || Object.hasOwn(input, 'description')) {
    payload.description = cleanText(input.description);
    if (!payload.description) throw new Error('Quest description is required.');
  }

  if (!partial || Object.hasOwn(input, 'points')) {
    payload.points = normalizePoints(input.points);
    if (payload.points <= 0) throw new Error('Quest points must be greater than zero.');
  }

  if (!partial || Object.hasOwn(input, 'targetType')) {
    payload.targetType = cleanText(input.targetType || 'all');
    if (!['all', 'class', 'students'].includes(payload.targetType)) {
      throw new Error('Invalid quest target.');
    }
  }

  if (!partial || Object.hasOwn(input, 'targetIds')) {
    payload.targetIds = normalizeTargetIds(input.targetIds);
  }

  if (payload.targetType && payload.targetType !== 'all' && !payload.targetIds?.length) {
    throw new Error('Select at least one quest target.');
  }

  if (!partial || Object.hasOwn(input, 'badgeId')) {
    payload.badgeId = cleanText(input.badgeId);
  }

  if (!partial || Object.hasOwn(input, 'deadline')) {
    payload.deadline = normalizeDeadline(input.deadline);
  }

  if (!partial || Object.hasOwn(input, 'status')) {
    payload.status = cleanText(input.status || QUEST_STATUS_ACTIVE);
    if (![QUEST_STATUS_ACTIVE, QUEST_STATUS_INACTIVE].includes(payload.status)) {
      throw new Error('Invalid quest status.');
    }
  }

  return payload;
}

export async function createQuest(questData = {}) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error('You must be logged in to create quests.');

  const payload = validateQuestPayload(questData);
  await assertTeacherCanUseTargets(user.uid, payload);
  const questRef = doc(collection(db, 'quests'));
  const quest = {
    id: questRef.id,
    ...payload,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(questRef, quest);
  const assignedCount = await assignQuestToStudents(questRef.id);
  return { id: questRef.id, assignedCount };
}

export async function getQuestsForUser(uid) {
  const normalizedUid = cleanText(uid);
  if (!normalizedUid) return [];

  const role = await getUserRole(normalizedUid);

  if (role === 'superAdmin') {
    const snapshot = await getDocs(query(collection(db, 'quests'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  if (role === 'teacher') {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(collection(db, 'quests'), where('createdBy', '==', normalizedUid), orderBy('createdAt', 'desc'))
      );
    } catch (error) {
      const fallbackSnapshot = await getDocs(query(collection(db, 'quests'), where('createdBy', '==', normalizedUid)));
      const docs = fallbackSnapshot.docs.slice().sort((a, b) => toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt));
      snapshot = { docs };
      console.warn('Quest query used fallback sorting. Create an index for createdBy + createdAt for best performance.', error);
    }
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  const assignmentsSnapshot = await getDocs(
    query(collection(db, 'studentQuests'), where('studentId', '==', normalizedUid))
  );

  const quests = await Promise.all(
    assignmentsSnapshot.docs.map(async (assignmentDoc) => {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
      const questId = cleanText(assignment.questId);
      if (!questId) return null;
      const questSnap = await getDoc(doc(db, 'quests', questId));
      if (!questSnap.exists()) return null;
      return {
        ...questSnap.data(),
        id: questSnap.id,
        studentQuestId: assignment.id,
        studentQuestStatus: assignment.status || STUDENT_QUEST_STATUS_ASSIGNED,
        completedAt: assignment.completedAt || null,
        pointsAwarded: normalizePoints(assignment.pointsAwarded)
      };
    })
  );

  return quests
    .filter(Boolean)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

export async function assignQuestToStudents(questId) {
  const normalizedQuestId = cleanText(questId);
  if (!normalizedQuestId) throw new Error('Quest ID is required.');

  const questSnap = await getDoc(doc(db, 'quests', normalizedQuestId));
  if (!questSnap.exists()) throw new Error('Quest not found.');

  const quest = { id: questSnap.id, ...questSnap.data() };
  if (cleanText(quest.status || QUEST_STATUS_ACTIVE) !== QUEST_STATUS_ACTIVE) return 0;

  const studentIds = await resolveTargetStudentIds(quest);
  if (!studentIds.length) return 0;

  let assignedCount = 0;
  const MAX_BATCH_SIZE = 240;
  for (let index = 0; index < studentIds.length; index += MAX_BATCH_SIZE) {
    const chunk = studentIds.slice(index, index + MAX_BATCH_SIZE);
    const existingSnaps = await Promise.all(
      chunk.map((studentId) => getDoc(doc(db, 'studentQuests', makeStudentQuestId(normalizedQuestId, studentId))))
    );
    const batch = writeBatch(db);

    chunk.forEach((studentId, chunkIndex) => {
      if (existingSnaps[chunkIndex].exists()) return;
      const studentQuestRef = doc(db, 'studentQuests', makeStudentQuestId(normalizedQuestId, studentId));
      batch.set(studentQuestRef, {
        questId: normalizedQuestId,
        studentId,
        status: STUDENT_QUEST_STATUS_ASSIGNED,
        pointsAwarded: 0,
        assignedAt: serverTimestamp()
      });
      batch.set(doc(db, 'notifications', `quest_assigned_${normalizedQuestId}_${studentId}`), buildStudentNotificationPayload({
        studentId,
        title: 'New Quest Assigned',
        message: `${quest.title || 'A quest'} is now available.`,
        type: 'quest',
        sourceType: 'quest',
        sourceId: normalizedQuestId,
        actionPage: 'quest',
        metadata: {
          questId: normalizedQuestId,
          status: STUDENT_QUEST_STATUS_ASSIGNED
        }
      }), { merge: true });
      assignedCount += 1;
    });

    await batch.commit();
  }

  return assignedCount;
}

export async function completeQuest(studentQuestId) {
  const normalizedStudentQuestId = cleanText(studentQuestId);
  const user = auth.currentUser;
  if (!user?.uid || !normalizedStudentQuestId) throw new Error('Quest assignment is required.');

  return completeQuestAssignment(normalizedStudentQuestId, {
    actorId: user.uid,
    requireStudentSelf: true,
    completedByRole: 'student'
  });
}

async function completeQuestAssignment(studentQuestId, options = {}) {
  const normalizedStudentQuestId = cleanText(studentQuestId);
  const actorId = cleanText(options.actorId || auth.currentUser?.uid);
  if (!actorId || !normalizedStudentQuestId) throw new Error('Quest assignment is required.');

  const studentQuestRef = doc(db, 'studentQuests', normalizedStudentQuestId);

  return runTransaction(db, async (transaction) => {
    const studentQuestSnap = await transaction.get(studentQuestRef);
    if (!studentQuestSnap.exists()) throw new Error('Quest assignment not found.');

    const assignment = studentQuestSnap.data() || {};
    const studentId = cleanText(assignment.studentId);
    if (options.requireStudentSelf && studentId !== actorId) {
      throw new Error('This quest is assigned to another student.');
    }
    if (assignment.status === STUDENT_QUEST_STATUS_COMPLETED) {
      return { completed: false, reason: 'already_completed' };
    }

    const questRef = doc(db, 'quests', cleanText(assignment.questId));
    const questSnap = await transaction.get(questRef);
    if (!questSnap.exists()) throw new Error('Quest not found.');

    const quest = questSnap.data() || {};
    if (options.requireQuestCreator && cleanText(quest.createdBy) !== actorId) {
      throw new Error('Only the teacher who created this quest can complete it for students.');
    }
    if (cleanText(quest.status || QUEST_STATUS_ACTIVE) !== QUEST_STATUS_ACTIVE) {
      throw new Error('This quest is not active.');
    }
    if (isPastDeadline(quest.deadline)) {
      throw new Error('The quest deadline has passed.');
    }

    const pointsAwarded = normalizePoints(quest.points);
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await transaction.get(studentRef);
    if (!studentSnap.exists()) throw new Error('Student record not found.');

    const student = studentSnap.data() || {};
    const sectionId = cleanText(student.sectionId);
    const sectionRef = sectionId ? doc(db, 'sections', sectionId) : null;
    const sectionSnap = sectionRef ? await transaction.get(sectionRef) : null;
    const pointLogRef = doc(db, 'pointLogs', `quest_${cleanText(quest.id || questSnap.id)}_${studentId}`);

    transaction.update(studentQuestRef, {
      status: STUDENT_QUEST_STATUS_COMPLETED,
      completedAt: serverTimestamp(),
      pointsAwarded,
      completedBy: actorId,
      completedByRole: cleanText(options.completedByRole || 'student')
    });

    if (pointsAwarded > 0) {
      transaction.update(studentRef, { points: increment(pointsAwarded), updatedAt: serverTimestamp() });
      if (sectionRef && sectionSnap?.exists()) {
        transaction.update(sectionRef, { totalPoints: increment(pointsAwarded), updatedAt: serverTimestamp() });
      }
    }

    transaction.set(pointLogRef, {
      studentId,
      studentName: formatStudentName(student),
      questId: questSnap.id,
      questTitle: quest.title || 'Quest reward',
      source: 'quest',
      awardedPoints: pointsAwarded,
      pointDifference: pointsAwarded,
      previousAwardedPoints: 0,
      reason: `${quest.title || 'Quest'} completed`,
      teacherId: cleanText(quest.createdBy),
      teacherName: cleanText(options.completedByName || 'Quest System'),
      sectionId,
      sectionName: cleanText(student.sectionName || student.section),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.set(doc(db, 'notifications', `quest_completed_${questSnap.id}_${studentId}`), buildStudentNotificationPayload({
      studentId,
      title: 'Quest Completed',
      message: `${quest.title || 'Quest'} completed${pointsAwarded > 0 ? ` for +${pointsAwarded} points` : ''}.`,
      type: 'quest',
      sourceType: 'quest',
      sourceId: questSnap.id,
      actionPage: 'quest',
      metadata: {
        questId: questSnap.id,
        pointsAwarded,
        completedByRole: cleanText(options.completedByRole || 'student')
      }
    }), { merge: true });

    const badgeId = cleanText(quest.badgeId);
    if (badgeId) {
      const badgeAwardRef = doc(db, 'studentSpecialBadges', `quest_${questSnap.id}_${studentId}_${badgeId}`);
      const studentBadgeRef = doc(db, 'studentBadges', `quest_${questSnap.id}_${studentId}_${badgeId}`);
      const badgePayload = {
        badgeId,
        studentId,
        studentName: formatStudentName(student),
        name: quest.title || 'Quest Badge',
        description: `Awarded for completing ${quest.title || 'a quest'}.`,
        type: 'quest',
        status: 'active',
        questId: questSnap.id,
        awardedBy: cleanText(quest.createdBy),
        awardedAt: serverTimestamp()
      };
      transaction.set(
        badgeAwardRef,
        badgePayload,
        { merge: true }
      );
      transaction.set(
        studentBadgeRef,
        badgePayload,
        { merge: true }
      );
      transaction.set(doc(db, 'notifications', `quest_badge_${questSnap.id}_${studentId}_${badgeId}`), buildStudentNotificationPayload({
        studentId,
        title: 'New Badge Earned',
        message: `${quest.title || 'Quest Badge'} was added to your badges.`,
        type: 'badge',
        sourceType: 'quest',
        sourceId: questSnap.id,
        actionPage: 'profile',
        metadata: {
          badgeId,
          questId: questSnap.id
        }
      }), { merge: true });
    }

    return { completed: true, pointsAwarded };
  });
}

export async function completeQuestForStudent(questId, studentId, options = {}) {
  const user = auth.currentUser;
  const normalizedQuestId = cleanText(questId);
  const normalizedStudentId = cleanText(studentId);
  if (!user?.uid || !normalizedQuestId || !normalizedStudentId) {
    throw new Error('Quest and student are required.');
  }

  return completeQuestAssignment(makeStudentQuestId(normalizedQuestId, normalizedStudentId), {
    actorId: user.uid,
    completedByName: cleanText(options.completedByName || 'Teacher'),
    completedByRole: 'teacher',
    requireQuestCreator: true
  });
}

export async function completeQuestByQuestId(questId) {
  const user = auth.currentUser;
  const normalizedQuestId = cleanText(questId);
  if (!user?.uid || !normalizedQuestId) throw new Error('Quest ID is required.');
  return completeQuest(makeStudentQuestId(normalizedQuestId, user.uid));
}

export async function updateQuest(questId, updates = {}) {
  const normalizedQuestId = cleanText(questId);
  if (!normalizedQuestId) throw new Error('Quest ID is required.');

  const user = auth.currentUser;
  if (!user?.uid) throw new Error('You must be logged in to update quests.');

  const existingQuestSnap = await getDoc(doc(db, 'quests', normalizedQuestId));
  if (!existingQuestSnap.exists()) throw new Error('Quest not found.');
  const existingQuest = { id: existingQuestSnap.id, ...existingQuestSnap.data() };
  const payload = validateQuestPayload(updates, { partial: true });
  await assertTeacherCanUseTargets(user.uid, payload, existingQuest);
  await updateDoc(doc(db, 'quests', normalizedQuestId), {
    ...payload,
    updatedAt: serverTimestamp()
  });

  if (payload.status === QUEST_STATUS_ACTIVE || payload.targetType || payload.targetIds) {
    await assignQuestToStudents(normalizedQuestId);
  }
}

export async function deleteQuest(questId) {
  const normalizedQuestId = cleanText(questId);
  if (!normalizedQuestId) throw new Error('Quest ID is required.');

  const assignmentsSnapshot = await getDocs(
    query(collection(db, 'studentQuests'), where('questId', '==', normalizedQuestId))
  );

  const refs = assignmentsSnapshot.docs.map((item) => item.ref);
  refs.push(doc(db, 'quests', normalizedQuestId));

  const MAX_BATCH_SIZE = 450;
  for (let index = 0; index < refs.length; index += MAX_BATCH_SIZE) {
    const chunk = refs.slice(index, index + MAX_BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function getQuestAssignmentCounts(questIds = []) {
  const counts = new Map();
  await Promise.all(
    questIds.map(async (questId) => {
      const snapshot = await getDocs(query(collection(db, 'studentQuests'), where('questId', '==', questId)));
      const completed = snapshot.docs.filter((item) => item.data()?.status === STUDENT_QUEST_STATUS_COMPLETED).length;
      counts.set(questId, { assigned: snapshot.size, completed });
    })
  );
  return counts;
}

export async function getQuestAssignments(questId) {
  const normalizedQuestId = cleanText(questId);
  if (!normalizedQuestId) return [];

  const snapshot = await getDocs(query(collection(db, 'studentQuests'), where('questId', '==', normalizedQuestId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function isQuestPastDeadline(quest = {}) {
  return isPastDeadline(quest.deadline);
}
