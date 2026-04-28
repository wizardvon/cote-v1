import {
  db,
  auth
} from "./firebase.js";

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// =========================
// CLAIM SINGLE ACHIEVEMENT
// =========================
export async function claimAchievement(achievementId) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const studentId = user.uid;

  try {
    const saRef = doc(db, "studentAchievements", `${studentId}_${achievementId}`);
    const saSnap = await getDoc(saRef);

    if (!saSnap.exists()) {
      alert("Achievement not found");
      return;
    }

    const saData = saSnap.data();

    if (saData.isClaimed) {
      alert("Already claimed");
      return;
    }

    const achievementRef = doc(db, "achievements", achievementId);
    const achievementSnap = await getDoc(achievementRef);

    if (!achievementSnap.exists()) {
      alert("Achievement config missing");
      return;
    }

    const achievement = achievementSnap.data();
    const rewardPoints = achievement.rewardPoints || 0;

    // =========================
    // UPDATE STUDENT POINTS
    // =========================
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);

    const currentPoints = studentSnap.data().points || 0;
    const newPoints = currentPoints + rewardPoints;

    await updateDoc(studentRef, {
      points: newPoints
    });

    // =========================
    // UPDATE SECTION POINTS
    // =========================
    const sectionId = studentSnap.data().sectionId;

    if (sectionId) {
      const sectionRef = doc(db, "sections", sectionId);
      const sectionSnap = await getDoc(sectionRef);

      const sectionPoints = sectionSnap.data().totalPoints || 0;

      await updateDoc(sectionRef, {
        totalPoints: sectionPoints + rewardPoints
      });
    }

    // =========================
    // CREATE POINT LOG
    // =========================
    const logId = `achievement_${studentId}_${achievementId}`;

    await setDoc(doc(db, "pointLogs", logId), {
      studentId,
      achievementId,
      achievementTitle: achievement.title,
      awardedPoints: rewardPoints,
      pointDifference: rewardPoints,
      source: "achievement",
      teacherName: "System",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // =========================
    // MARK AS CLAIMED
    // =========================
    await updateDoc(saRef, {
      isClaimed: true,
      claimedAt: serverTimestamp()
    });

    // =========================
    // UI FEEDBACK
    // =========================
    showPointsPopup(rewardPoints);

    alert(`+${rewardPoints} pts claimed!`);

  } catch (err) {
    console.error(err);
    alert("Claim failed. Check rules.");
  }
}


// =========================
// CLAIM ALL
// =========================
export async function claimAllAchievements(studentAchievements) {
  for (let a of studentAchievements) {
    if (!a.isClaimed) {
      await claimAchievement(a.achievementId);
    }
  }
}


// =========================
// POPUP
// =========================
function showPointsPopup(points) {
  const popup = document.createElement("div");
  popup.innerText = `+${points} pts`;
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.fontSize = "24px";
  popup.style.background = "#111";
  popup.style.color = "#0ff";
  popup.style.padding = "15px 25px";
  popup.style.borderRadius = "10px";
  popup.style.zIndex = "9999";

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1500);
}
