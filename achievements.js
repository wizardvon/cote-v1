import { db } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================
// CHECK ACHIEVEMENTS
// ============================
export async function checkAchievements(studentId) {
  const achievementsSnap = await getDocs(collection(db, "achievements"));
  const studentAchSnap = await getDocs(
    query(collection(db, "studentAchievements"), where("studentId", "==", studentId))
  );

  const existing = studentAchSnap.docs.map(d => d.data().achievementId);

  for (const achDoc of achievementsSnap.docs) {
    const ach = achDoc.data();

    if (!existing.includes(achDoc.id)) {
      await addDoc(collection(db, "studentAchievements"), {
        studentId,
        achievementId: achDoc.id,
        title: ach.title,
        category: ach.category,
        rewardPoints: ach.rewardPoints,
        isClaimed: false,
        createdAt: serverTimestamp()
      });
    }
  }
}

// ============================
// CLAIM SINGLE
// ============================
export async function claimAchievement(docId, studentId) {
  const achRef = doc(db, "studentAchievements", docId);

  await updateDoc(achRef, {
    isClaimed: true,
    claimedAt: serverTimestamp()
  });

  // ADD POINT LOG
  await addDoc(collection(db, "pointLogs"), {
    studentId,
    source: "achievement",
    achievementId: docId,
    achievementTitle: "Achievement Reward",
    awardedPoints: 100,
    pointDifference: 100,
    teacherName: "System",
    createdAt: serverTimestamp()
  });
}

// ============================
// CLAIM ALL
// ============================
export async function claimAllAchievements(studentId) {
  const snap = await getDocs(
    query(collection(db, "studentAchievements"),
      where("studentId", "==", studentId),
      where("isClaimed", "==", false)
    )
  );

  for (const docSnap of snap.docs) {
    await claimAchievement(docSnap.id, studentId);
  }
}
