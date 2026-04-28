# Firestore rules snippets for the Achievement System

Add these blocks **inside** `match /databases/{database}/documents` in your Firestore rules file.

```rules
function signedIn() {
  return request.auth != null;
}

function myUser() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function isSuperAdmin() {
  return signedIn() && myUser().role == 'superAdmin';
}

function isTeacher() {
  return signedIn() && myUser().role == 'teacher';
}

function isStudentOwner(studentId) {
  return signedIn() && request.auth.uid == studentId;
}

match /achievements/{achievementId} {
  allow read: if signedIn() && resource.data.status == 'active';
  allow create, update, delete: if isSuperAdmin();
}

match /studentAchievements/{studentAchievementId} {
  allow read: if isSuperAdmin()
    || isStudentOwner(resource.data.studentId)
    || isTeacher();

  allow create: if signedIn()
    && request.resource.data.studentId is string
    && request.resource.data.achievementId is string
    && request.resource.data.title is string
    && request.resource.data.category is string
    && request.resource.data.chainKey is string
    && request.resource.data.rewardPoints is number
    && request.resource.data.rewardPoints >= 100
    && request.resource.data.sourceType is string
    && request.resource.data.sourceId is string
    && isStudentOwner(request.resource.data.studentId);

  allow update, delete: if isSuperAdmin();
}

match /pointLogs/{logId} {
  allow read: if signedIn() && (
    isSuperAdmin()
    || isTeacher()
    || isStudentOwner(resource.data.studentId)
  );

  allow create: if signedIn()
    && request.resource.data.source == 'achievement'
    && request.resource.data.studentId is string
    && request.resource.data.achievementId is string
    && request.resource.data.achievementTitle is string
    && request.resource.data.awardedPoints is number
    && request.resource.data.awardedPoints >= 100
    && request.resource.data.pointDifference is number
    && request.resource.data.previousAwardedPoints is number
    && request.resource.data.reason is string
    && isStudentOwner(request.resource.data.studentId);
}

match /notifications/{notificationId} {
  allow read: if signedIn() && request.auth.uid == resource.data.recipientId;

  allow create: if signedIn()
    && request.resource.data.type == 'achievement'
    && request.resource.data.sourceType == 'achievement'
    && request.resource.data.recipientRole == 'student'
    && request.resource.data.recipientId is string
    && request.resource.data.sourceId is string
    && request.resource.data.title is string
    && request.resource.data.message is string
    && request.resource.data.isRead == false
    && request.auth.uid == request.resource.data.recipientId;

  allow update: if signedIn() && request.auth.uid == resource.data.recipientId;
  allow delete: if isSuperAdmin();
}
```

> Note: teacher access for `studentAchievements` above is broad (`isTeacher()`). If you already have helper rules for class-enrollment-based checks, replace that condition with your existing enrollment-safe helper.
