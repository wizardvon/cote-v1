import { db, auth } from './firebase.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkAchievements, claimAchievement } from './achievements.js';

auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const uid = user.uid;

  // LOAD PROFILE
  const studentRef = doc(db, "students", uid);
  const studentSnap = await getDoc(studentRef);

  if (studentSnap.exists()) {
    const data = studentSnap.data();
    document.getElementById("studentName").textContent =
      `${data.lastName}, ${data.firstName}`;
  }

  // LOAD ACHIEVEMENTS
  await loadAchievements(uid);

  // CHECK NEW ACHIEVEMENTS
  await checkAchievements(uid);
});

// =========================
// LOAD ACHIEVEMENTS
// =========================
async function loadAchievements(uid) {
  const list = document.getElementById("achievementList");
  list.innerHTML = "";

  const snap = await getDocs(
    query(collection(db, "studentAchievements"),
      where("studentId", "==", uid)
    )
  );

  snap.forEach(docSnap => {
    const data = docSnap.data();

    const div = document.createElement("div");
    div.className = "achievement-card";

    div.innerHTML = `
      <h4>${data.title}</h4>
      <p>${data.category}</p>
      <p>Reward: ${data.rewardPoints}</p>
      ${
        data.isClaimed
          ? "<span>Completed</span>"
          : `<button data-id="${docSnap.id}">Claim</button>`
      }
    `;

    if (!data.isClaimed) {
      div.querySelector("button").onclick = async () => {
        await claimAchievement(docSnap.id, uid);
        loadAchievements(uid);
      };
    }

    list.appendChild(div);
  });
}
