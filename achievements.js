import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  writeBatch,
  increment
} from './firebase.js';

const ACHIEVEMENT_STATUS_ACTIVE = 'active';

const ACHIEVEMENT_MASTER_DATA = [
  {
    id: 'first_perfect_score',
    title: 'First Perfect Score',
    description: 'Earn your first perfect score in class records.',
    category: 'Academic',
    chainKey: 'academic_perfection',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'double_perfection',
    triggerType: 'score_update',
    condition: { type: 'perfect_score_count', count: 1 },
    rewardPoints: 100
  },
  {
    id: 'double_perfection',
    title: 'Double Perfection',
    description: 'Earn 2 perfect scores.',
    category: 'Academic',
    chainKey: 'academic_perfection',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'first_perfect_score',
    nextAchievementId: 'triple_perfection',
    triggerType: 'score_update',
    condition: { type: 'perfect_score_count', count: 2 },
    rewardPoints: 150
  },
  {
    id: 'triple_perfection',
    title: 'Triple Perfection',
    description: 'Earn 3 perfect scores.',
    category: 'Academic',
    chainKey: 'academic_perfection',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'double_perfection',
    nextAchievementId: 'perfectionist',
    triggerType: 'score_update',
    condition: { type: 'perfect_score_count', count: 3 },
    rewardPoints: 200
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Earn 5 perfect scores.',
    category: 'Academic',
    chainKey: 'academic_perfection',
    chainOrder: 4,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'triple_perfection',
    nextAchievementId: 'flawless_mind',
    triggerType: 'score_update',
    condition: { type: 'perfect_score_count', count: 5 },
    rewardPoints: 300
  },
  {
    id: 'flawless_mind',
    title: 'Flawless Mind',
    description: 'Earn 10 perfect scores.',
    category: 'Academic',
    chainKey: 'academic_perfection',
    chainOrder: 5,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'perfectionist',
    nextAchievementId: null,
    triggerType: 'score_update',
    condition: { type: 'perfect_score_count', count: 10 },
    rewardPoints: 500
  },
  {
    id: 'sharp_mind',
    title: 'Sharp Mind',
    description: 'Get one score at 90% or higher.',
    category: 'Academic',
    chainKey: 'high_performance',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'consistent_performer',
    triggerType: 'score_update',
    condition: { type: 'high_score_count', threshold: 90, count: 1 },
    rewardPoints: 100
  },
  {
    id: 'consistent_performer',
    title: 'Consistent Performer',
    description: 'Get 3 scores at 90% or higher.',
    category: 'Academic',
    chainKey: 'high_performance',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'sharp_mind',
    nextAchievementId: 'academic_elite',
    triggerType: 'score_update',
    condition: { type: 'high_score_count', threshold: 90, count: 3 },
    rewardPoints: 200
  },
  {
    id: 'academic_elite',
    title: 'Academic Elite',
    description: 'Get 5 scores at 90% or higher.',
    category: 'Academic',
    chainKey: 'high_performance',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'consistent_performer',
    nextAchievementId: 'mastery_level',
    triggerType: 'score_update',
    condition: { type: 'high_score_count', threshold: 90, count: 5 },
    rewardPoints: 350
  },
  {
    id: 'mastery_level',
    title: 'Mastery Level',
    description: 'Get 10 scores at 90% or higher.',
    category: 'Academic',
    chainKey: 'high_performance',
    chainOrder: 4,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'academic_elite',
    nextAchievementId: null,
    triggerType: 'score_update',
    condition: { type: 'high_score_count', threshold: 90, count: 10 },
    rewardPoints: 700
  },
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first activity score.',
    category: 'Consistency',
    chainKey: 'activity_completion',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'getting_started',
    triggerType: 'score_update',
    condition: { type: 'activity_count', count: 1 },
    rewardPoints: 100
  },
  {
    id: 'getting_started',
    title: 'Getting Started',
    description: 'Complete 3 activities.',
    category: 'Consistency',
    chainKey: 'activity_completion',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'first_step',
    nextAchievementId: 'on_a_roll',
    triggerType: 'score_update',
    condition: { type: 'activity_count', count: 3 },
    rewardPoints: 150
  },
  {
    id: 'on_a_roll',
    title: 'On a Roll',
    description: 'Complete 5 activities.',
    category: 'Consistency',
    chainKey: 'activity_completion',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'getting_started',
    nextAchievementId: 'dedicated_learner',
    triggerType: 'score_update',
    condition: { type: 'activity_count', count: 5 },
    rewardPoints: 250
  },
  {
    id: 'dedicated_learner',
    title: 'Dedicated Learner',
    description: 'Complete 10 activities.',
    category: 'Consistency',
    chainKey: 'activity_completion',
    chainOrder: 4,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'on_a_roll',
    nextAchievementId: 'relentless',
    triggerType: 'score_update',
    condition: { type: 'activity_count', count: 10 },
    rewardPoints: 400
  },
  {
    id: 'relentless',
    title: 'Relentless',
    description: 'Complete 20 activities.',
    category: 'Consistency',
    chainKey: 'activity_completion',
    chainOrder: 5,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'dedicated_learner',
    nextAchievementId: null,
    triggerType: 'score_update',
    condition: { type: 'activity_count', count: 20 },
    rewardPoints: 700
  },
  {
    id: 'starter_boost',
    title: 'Starter Boost',
    description: 'Reach 50 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'club_100',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 50 },
    rewardPoints: 100
  },
  {
    id: 'club_100',
    title: '100 Club',
    description: 'Reach 100 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'starter_boost',
    nextAchievementId: 'milestone_250',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 100 },
    rewardPoints: 150
  },
  {
    id: 'milestone_250',
    title: '250 Milestone',
    description: 'Reach 250 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'club_100',
    nextAchievementId: 'club_500',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 250 },
    rewardPoints: 200
  },
  {
    id: 'club_500',
    title: '500 Club',
    description: 'Reach 500 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 4,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'milestone_250',
    nextAchievementId: 'milestone_750',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 500 },
    rewardPoints: 350
  },
  {
    id: 'milestone_750',
    title: '750 Milestone',
    description: 'Reach 750 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 5,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'club_500',
    nextAchievementId: 'elite_1000',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 750 },
    rewardPoints: 450
  },
  {
    id: 'elite_1000',
    title: '1000 Elite',
    description: 'Reach 1000 total points.',
    category: 'Points',
    chainKey: 'points_milestone',
    chainOrder: 6,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'milestone_750',
    nextAchievementId: 'milestone_1500',
    triggerType: 'points_update',
    condition: { type: 'total_points', points: 1000 },
    rewardPoints: 700
  },
  {
    id: 'first_attendance',
    title: 'First Attendance',
    description: 'Record your first attendance entry.',
    category: 'Attendance',
    chainKey: 'attendance_count',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'showing_up',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_count', count: 1 },
    rewardPoints: 100
  },
  {
    id: 'showing_up',
    title: 'Showing Up',
    description: 'Record 3 attendance entries.',
    category: 'Attendance',
    chainKey: 'attendance_count',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'first_attendance',
    nextAchievementId: 'consistent_attendee',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_count', count: 3 },
    rewardPoints: 150
  },
  {
    id: 'consistent_attendee',
    title: 'Consistent Attendee',
    description: 'Record 5 attendance entries.',
    category: 'Attendance',
    chainKey: 'attendance_count',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'showing_up',
    nextAchievementId: 'reliable',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_count', count: 5 },
    rewardPoints: 250
  },
  {
    id: 'reliable',
    title: 'Reliable',
    description: 'Record 10 attendance entries.',
    category: 'Attendance',
    chainKey: 'attendance_count',
    chainOrder: 4,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'consistent_attendee',
    nextAchievementId: 'ever_present',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_count', count: 10 },
    rewardPoints: 400
  },
  {
    id: 'ever_present',
    title: 'Ever Present',
    description: 'Record 20 attendance entries.',
    category: 'Attendance',
    chainKey: 'attendance_count',
    chainOrder: 5,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'reliable',
    nextAchievementId: null,
    triggerType: 'attendance_update',
    condition: { type: 'attendance_count', count: 20 },
    rewardPoints: 700
  },
  {
    id: 'attendance_3_day_streak',
    title: '3-Day Streak',
    description: 'Reach a 3-day attendance streak.',
    category: 'Attendance',
    chainKey: 'attendance_streak',
    chainOrder: 1,
    isVisibleByDefault: true,
    unlocksAfterAchievementId: null,
    nextAchievementId: 'attendance_5_day_streak',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_streak', days: 3 },
    rewardPoints: 200
  },
  {
    id: 'attendance_5_day_streak',
    title: '5-Day Streak',
    description: 'Reach a 5-day attendance streak.',
    category: 'Attendance',
    chainKey: 'attendance_streak',
    chainOrder: 2,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'attendance_3_day_streak',
    nextAchievementId: 'attendance_10_day_streak',
    triggerType: 'attendance_update',
    condition: { type: 'attendance_streak', days: 5 },
    rewardPoints: 350
  },
  {
    id: 'attendance_10_day_streak',
    title: '10-Day Streak',
    description: 'Reach a 10-day attendance streak.',
    category: 'Attendance',
    chainKey: 'attendance_streak',
    chainOrder: 3,
    isVisibleByDefault: false,
    unlocksAfterAchievementId: 'attendance_5_day_streak',
    nextAchievementId: null,
    triggerType: 'attendance_update',
    condition: { type: 'attendance_streak', days: 10 },
    rewardPoints: 700
  }
];

function normalizeAchievement(item = {}) {
  return {
    ...item,
    id: String(item.id || '').trim(),
    status: String(item.status || ACHIEVEMENT_STATUS_ACTIVE).trim() || ACHIEVEMENT_STATUS_ACTIVE,
    isHidden: Boolean(item.isHidden),
    isVisibleByDefault: Boolean(item.isVisibleByDefault),
    chainKey: String(item.chainKey || '').trim() || 'default_chain',
    chainOrder: Number(item.chainOrder) || 0,
    unlocksAfterAchievementId: item.unlocksAfterAchievementId ? String(item.unlocksAfterAchievementId).trim() : null,
    triggerType: String(item.triggerType || '').trim(),
    rewardPoints: Math.max(100, Number(item.rewardPoints) || 100)
  };
}

function sortByChain(a, b) {
  const categoryCompare = String(a.category || '').localeCompare(String(b.category || ''));
  if (categoryCompare !== 0) return categoryCompare;
  const chainCompare = String(a.chainKey || '').localeCompare(String(b.chainKey || ''));
  if (chainCompare !== 0) return chainCompare;
  return Number(a.chainOrder || 0) - Number(b.chainOrder || 0);
}

function buildStudentAchievementDocId(studentId, achievementId) {
  return `${studentId}_${achievementId}`;
}

function buildAchievementPointLogDocId(studentId, achievementId) {
  return `achievement_${achievementId}_${studentId}`;
}

function safeText(value, fallback = '') {
  const output = String(value || '').trim();
  return output || fallback;
}

function formatStudentName(studentData = {}) {
  return [studentData.firstName, studentData.middleName, studentData.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function queryAllStudentScores(studentId) {
  const normalizedStudentId = safeText(studentId);
  if (!normalizedStudentId) return [];

  try {
    const snap = await getDocs(query(collection(db, 'scores'), where('studentId', '==', normalizedStudentId)));
    return snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  } catch (error) {
    console.warn('Failed to query scores for achievement checks:', error);
    return [];
  }
}

export async function seedAchievementsIfEmpty() {
  try {
    const existingSnapshot = await getDocs(query(collection(db, 'achievements'), limit(1)));
    if (!existingSnapshot.empty) return false;

    const batch = writeBatch(db);
    const now = serverTimestamp();

    ACHIEVEMENT_MASTER_DATA.forEach((rawAchievement) => {
      const achievement = normalizeAchievement(rawAchievement);
      const achievementRef = doc(db, 'achievements', achievement.id);
      batch.set(achievementRef, {
        ...achievement,
        badgeRewardId: null,
        unlockItemIds: [],
        isHidden: false,
        status: ACHIEVEMENT_STATUS_ACTIVE,
        createdAt: now,
        updatedAt: now
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.warn('Achievement seeding skipped:', error);
    return false;
  }
}

async function getStudentAchievementRecords(studentId) {
  const normalizedStudentId = safeText(studentId);
  if (!normalizedStudentId) return [];

  try {
    const snapshot = await getDocs(query(collection(db, 'studentAchievements'), where('studentId', '==', normalizedStudentId)));
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() || {}) }));
  } catch (error) {
    console.warn('Failed loading student achievements:', error);
    return [];
  }
}

export async function getStudentUnlockedAchievementIds(studentId) {
  const achievementRecords = await getStudentAchievementRecords(studentId);
  return new Set(achievementRecords.map((item) => safeText(item.achievementId)).filter(Boolean));
}

async function getActiveAchievements(triggerType = '') {
  const normalizedTriggerType = safeText(triggerType);
  const source = [];

  try {
    const achievementsSnap = normalizedTriggerType
      ? await getDocs(
          query(
            collection(db, 'achievements'),
            where('status', '==', ACHIEVEMENT_STATUS_ACTIVE),
            where('triggerType', '==', normalizedTriggerType)
          )
        )
      : await getDocs(query(collection(db, 'achievements'), where('status', '==', ACHIEVEMENT_STATUS_ACTIVE)));

    achievementsSnap.docs.forEach((item) => source.push(normalizeAchievement(item.data() || {})));
  } catch (error) {
    console.warn('Failed loading active achievements with filter. Using fallback:', error);
    try {
      const allAchievementsSnapshot = await getDocs(collection(db, 'achievements'));
      allAchievementsSnapshot.docs.forEach((item) => {
        const normalized = normalizeAchievement(item.data() || {});
        if (normalized.status !== ACHIEVEMENT_STATUS_ACTIVE) return;
        if (normalizedTriggerType && normalized.triggerType !== normalizedTriggerType) return;
        source.push(normalized);
      });
    } catch (fallbackError) {
      console.warn('Failed loading achievements fallback:', fallbackError);
    }
  }

  return source.filter((item) => item.id && !item.isHidden).sort(sortByChain);
}

export async function getVisibleAchievementsForStudent(studentId) {
  await seedAchievementsIfEmpty();
  const [achievements, achievementRecords] = await Promise.all([
    getActiveAchievements(''),
    getStudentAchievementRecords(studentId)
  ]);
  const unlockedIds = new Set(achievementRecords.map((item) => safeText(item.achievementId)).filter(Boolean));
  const achievedAtByAchievementId = new Map(
    achievementRecords.map((item) => [safeText(item.achievementId), item.achievedAt]).filter(([id]) => Boolean(id))
  );

  return achievements
    .filter((achievement) => {
      if (achievement.isVisibleByDefault) return true;
      if (unlockedIds.has(achievement.id)) return true;
      return achievement.unlocksAfterAchievementId && unlockedIds.has(achievement.unlocksAfterAchievementId);
    })
    .map((achievement) => ({
      ...achievement,
      achievedAt: achievedAtByAchievementId.get(achievement.id) || null
    }))
    .sort(sortByChain);
}

export async function evaluateAchievementCondition(studentId, achievement) {
  const condition = achievement?.condition || {};
  const conditionType = safeText(condition.type);

  if (!conditionType) return false;

  if (conditionType === 'total_points') {
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) return false;
    const studentData = studentSnap.data() || {};
    return Number(studentData.points || 0) >= Number(condition.points || 0);
  }

  if (conditionType === 'attendance_streak') {
    try {
      const attendanceSnap = await getDocs(query(collection(db, 'attendanceLogs'), where('studentId', '==', studentId), limit(1)));
      if (attendanceSnap.empty) return false;
    } catch (error) {
      console.warn('Attendance logs not available for streak condition:', error);
      return false;
    }

    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (!studentSnap.exists()) return false;
    const attendanceStreak = Number(studentSnap.data()?.attendanceStreak || 0);
    return attendanceStreak >= Number(condition.days || 0);
  }

  if (conditionType === 'attendance_count') {
    try {
      const attendanceSnap = await getDocs(query(collection(db, 'attendanceLogs'), where('studentId', '==', studentId)));
      return attendanceSnap.size >= Number(condition.count || 0);
    } catch (error) {
      console.warn('Attendance logs not available for count condition:', error);
      return false;
    }
  }

  const scores = await queryAllStudentScores(studentId);

  if (conditionType === 'perfect_score_count') {
    const perfectScores = scores.filter((score) => {
      const scoreValue = Number(score.score);
      const maxScore = Number(score.maxScore);
      return Number.isFinite(scoreValue) && Number.isFinite(maxScore) && maxScore > 0 && scoreValue === maxScore;
    });

    return perfectScores.length >= Number(condition.count || 0);
  }

  if (conditionType === 'high_score_count') {
    const threshold = Number(condition.threshold || 0);
    const highScores = scores.filter((score) => {
      const percentageRaw = Number(score.percentage);
      const maxScore = Number(score.maxScore);
      const scoreValue = Number(score.score);
      const computedPercentage =
        Number.isFinite(percentageRaw) && percentageRaw >= 0
          ? percentageRaw
          : Number.isFinite(maxScore) && maxScore > 0 && Number.isFinite(scoreValue)
          ? (scoreValue / maxScore) * 100
          : Number.NaN;

      return Number.isFinite(computedPercentage) && computedPercentage >= threshold;
    });

    return highScores.length >= Number(condition.count || 0);
  }

  if (conditionType === 'activity_count') {
    const uniqueActivityIds = new Set();
    scores.forEach((score) => {
      const hasScore = score.score !== null && score.score !== undefined;
      const activityId = safeText(score.activityId);
      if (hasScore && activityId) {
        uniqueActivityIds.add(activityId);
      }
    });

    return uniqueActivityIds.size >= Number(condition.count || 0);
  }

  return false;
}

export async function createAchievementNotification(studentId, achievement) {
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId: studentId,
      recipientRole: 'student',
      title: 'Achievement Unlocked!',
      message: `${achievement.title} unlocked! +${achievement.rewardPoints} points`,
      type: 'achievement',
      sourceType: 'achievement',
      sourceId: achievement.id,
      isRead: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('Achievement notification skipped:', error);
  }
}

export async function unlockAchievement(studentId, achievement, context = {}) {
  const normalizedStudentId = safeText(studentId);
  if (!normalizedStudentId || !achievement?.id) return { unlocked: false };

  const studentAchievementId = buildStudentAchievementDocId(normalizedStudentId, achievement.id);
  const pointLogId = buildAchievementPointLogDocId(normalizedStudentId, achievement.id);
  const studentAchievementRef = doc(db, 'studentAchievements', studentAchievementId);
  const pointLogRef = doc(db, 'pointLogs', pointLogId);
  const studentRef = doc(db, 'students', normalizedStudentId);

  try {
    const transactionResult = await runTransaction(db, async (transaction) => {
      const studentAchievementSnap = await transaction.get(studentAchievementRef);
      if (studentAchievementSnap.exists()) {
        return { unlocked: false, reason: 'already_unlocked' };
      }

      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists()) {
        return { unlocked: false, reason: 'student_not_found' };
      }

      const studentData = studentSnap.data() || {};
      const studentName = formatStudentName(studentData);
      const sectionId = safeText(studentData.sectionId);
      const sectionRef = sectionId ? doc(db, 'sections', sectionId) : null;
      const sectionSnap = sectionRef ? await transaction.get(sectionRef) : null;

      transaction.set(studentAchievementRef, {
        studentId: normalizedStudentId,
        achievementId: achievement.id,
        title: achievement.title,
        category: achievement.category,
        chainKey: achievement.chainKey,
        rewardPoints: achievement.rewardPoints,
        achievedAt: serverTimestamp(),
        sourceType: safeText(context.triggerType, 'achievement_engine'),
        sourceId: safeText(context.sourceId)
      });

      transaction.update(studentRef, {
        points: increment(Number(achievement.rewardPoints || 100))
      });

      if (sectionRef && sectionSnap?.exists()) {
        transaction.update(sectionRef, {
          totalPoints: increment(Number(achievement.rewardPoints || 100))
        });
      }

      transaction.set(pointLogRef, {
        studentId: normalizedStudentId,
        studentName: studentName || safeText(studentData.displayName, 'Student'),
        achievementId: achievement.id,
        achievementTitle: achievement.title,
        source: 'achievement',
        awardedPoints: Number(achievement.rewardPoints || 100),
        pointDifference: Number(achievement.rewardPoints || 100),
        previousAwardedPoints: 0,
        reason: `${achievement.title} unlocked`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { unlocked: true };
    });

    if (transactionResult.unlocked) {
      await createAchievementNotification(normalizedStudentId, achievement);
    }

    return transactionResult;
  } catch (error) {
    console.warn('Achievement unlock failed:', error);
    return { unlocked: false, reason: 'unlock_error' };
  }
}

export async function checkAchievements(studentId, context = {}) {
  const normalizedStudentId = safeText(studentId);
  const triggerType = safeText(context.triggerType);
  if (!normalizedStudentId || !triggerType) return [];

  try {
    await seedAchievementsIfEmpty();
    const achievements = await getActiveAchievements(triggerType);
    if (!achievements.length) return [];

    const unlockedIds = await getStudentUnlockedAchievementIds(normalizedStudentId);
    const unlockedNow = [];
    const achievementsByChain = new Map();

    achievements.forEach((achievement) => {
      const chainKey = achievement.chainKey || achievement.id;
      if (!achievementsByChain.has(chainKey)) {
        achievementsByChain.set(chainKey, []);
      }
      achievementsByChain.get(chainKey).push(achievement);
    });

    for (const chainAchievements of achievementsByChain.values()) {
      const orderedChain = [...chainAchievements].sort((a, b) => Number(a.chainOrder || 0) - Number(b.chainOrder || 0));
      const nextAchievement = orderedChain.find((achievement) => !unlockedIds.has(achievement.id));

      if (!nextAchievement) continue;

      const isVisible =
        nextAchievement.isVisibleByDefault ||
        (nextAchievement.unlocksAfterAchievementId && unlockedIds.has(nextAchievement.unlocksAfterAchievementId));

      if (!isVisible) continue;

      const passed = await evaluateAchievementCondition(normalizedStudentId, nextAchievement, context);
      if (!passed) continue;

      const result = await unlockAchievement(normalizedStudentId, nextAchievement, context);
      if (!result.unlocked) continue;

      unlockedIds.add(nextAchievement.id);
      unlockedNow.push(nextAchievement);
    }

    return unlockedNow;
  } catch (error) {
    console.warn('Achievement check failed:', error);
    return [];
  }
}

export function getAchievementRequirementText(achievement = {}) {
  const condition = achievement.condition || {};
  const type = safeText(condition.type);

  if (type === 'perfect_score_count') {
    return `Get ${Number(condition.count || 0)} perfect score${Number(condition.count || 0) === 1 ? '' : 's'}`;
  }
  if (type === 'high_score_count') {
    return `Get ${Number(condition.count || 0)} score${Number(condition.count || 0) === 1 ? '' : 's'} at ${Number(
      condition.threshold || 0
    )}% or higher`;
  }
  if (type === 'activity_count') {
    return `Complete ${Number(condition.count || 0)} activit${Number(condition.count || 0) === 1 ? 'y' : 'ies'}`;
  }
  if (type === 'total_points') {
    return `Reach ${Number(condition.points || 0)} total points`;
  }
  if (type === 'attendance_count') {
    return `Attend ${Number(condition.count || 0)} class day${Number(condition.count || 0) === 1 ? '' : 's'}`;
  }
  if (type === 'attendance_streak') {
    return `Maintain a ${Number(condition.days || 0)}-day attendance streak`;
  }

  return 'Complete the requirement to unlock this achievement';
}
