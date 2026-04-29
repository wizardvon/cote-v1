# Firestore rules snippets for the Quest System

Add these blocks inside `match /databases/{database}/documents` in your Firestore rules file.

```rules
match /quests/{questId} {
  allow read: if isLoggedIn();
  allow create: if isActiveAdmin() || isActiveTeacher();
  allow update, delete: if isActiveAdmin()
    || (isActiveTeacher() && resource.data.createdBy == request.auth.uid);
}

match /studentQuests/{id} {
  allow read: if isLoggedIn()
    && (isActiveAdmin() || isActiveTeacher() || resource.data.studentId == request.auth.uid);
  allow create: if isActiveAdmin() || isActiveTeacher();
  allow update: if isActiveAdmin()
    || (
      isActiveTeacher()
      && resource.data.status == 'assigned'
      && request.resource.data.status == 'completed'
      && request.resource.data.studentId == resource.data.studentId
      && request.resource.data.questId == resource.data.questId
      && get(/databases/$(database)/documents/quests/$(resource.data.questId)).data.createdBy == request.auth.uid
    )
    || (
      isStudent()
      && resource.data.studentId == request.auth.uid
      && resource.data.status == 'assigned'
      && request.resource.data.status == 'completed'
      && request.resource.data.studentId == resource.data.studentId
      && request.resource.data.questId == resource.data.questId
    );
  allow delete: if isActiveAdmin();
}

match /pointLogs/{logId} {
  allow read: if isLoggedIn()
    && (isActiveAdmin() || isActiveTeacher() || resource.data.studentId == request.auth.uid);
  allow create: if isActiveAdmin()
    || isActiveTeacher()
    || (
      isStudent()
      && request.resource.data.source == 'quest'
      && request.resource.data.studentId == request.auth.uid
    );
}

match /studentSpecialBadges/{badgeAwardId} {
  allow read: if isLoggedIn()
    && (isActiveAdmin() || isActiveTeacher() || resource.data.studentId == request.auth.uid);
  allow create: if isActiveAdmin()
    || isActiveTeacher()
    || (
      isStudent()
      && request.resource.data.type == 'quest'
      && request.resource.data.studentId == request.auth.uid
    );
  allow update, delete: if isActiveAdmin();
}

match /studentBadges/{badgeAwardId} {
  allow read: if isLoggedIn()
    && (isActiveAdmin() || isActiveTeacher() || resource.data.studentId == request.auth.uid);
  allow create: if isActiveAdmin()
    || isActiveTeacher()
    || (
      isStudent()
      && request.resource.data.type == 'quest'
      && request.resource.data.studentId == request.auth.uid
    );
  allow update, delete: if isActiveAdmin();
}
```

These snippets assume your existing rules already define `isLoggedIn()`, `isActiveAdmin()`, `isActiveTeacher()`, and `isStudent()`.
