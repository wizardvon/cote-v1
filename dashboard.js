import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

const emailElement = document.getElementById("student-email");
const profileDataElement = document.getElementById("profileData");
const logoutButton = document.getElementById("logout-button");

function safe(value) {
  if (value === undefined || value === null) return "Not provided";
  const text = String(value).trim();
  return text || "Not provided";
}

function fullName(data) {
  return [data.firstName, data.middleName, data.lastName]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(" ") || "Not provided";
}

function renderProfile(data, fallbackEmail) {
  profileDataElement.innerHTML = `
    <p><strong>Full Name:</strong> ${safe(fullName(data))}</p>
    <p><strong>Email:</strong> ${safe(data.email || fallbackEmail)}</p>
    <p><strong>Sex:</strong> ${safe(data.sex)}</p>
    <p><strong>Birthday:</strong> ${safe(data.birthday)}</p>
    <p><strong>LRN:</strong> ${safe(data.lrn)}</p>
    <p><strong>Phone Number:</strong> ${safe(data.phoneNumber)}</p>
    <p><strong>Address:</strong> ${safe(data.address)}</p>
  `;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  emailElement.textContent = user.email || "No email available";

  try {
    const studentRef = doc(db, "students", user.uid);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      profileDataElement.innerHTML = `
        <p><strong>Full Name:</strong> No profile found</p>
        <p><strong>Email:</strong> ${safe(user.email)}</p>
        <p><strong>Sex:</strong> Not provided</p>
        <p><strong>Birthday:</strong> Not provided</p>
        <p><strong>LRN:</strong> Not provided</p>
        <p><strong>Phone Number:</strong> Not provided</p>
        <p><strong>Address:</strong> Not provided</p>
      `;
      return;
    }

    const studentData = studentSnap.data();
    renderProfile(studentData, user.email);
  } catch (error) {
    console.error("Failed to load profile:", error);
    profileDataElement.innerHTML = `
      <p><strong>Error:</strong> Failed to load profile data.</p>
    `;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout failed:", error);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/cote-v1/sw.js", { scope: "/cote-v1/" })
      .catch((error) => console.error("SW registration failed:", error));
  });
}
