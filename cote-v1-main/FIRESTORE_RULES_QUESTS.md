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
      && request.resource.data.completedBy == request.auth.uid
      && request.resource.data.completedByRole == 'teacher'
      && request.resource.data.completedAt is timestamp
      && request.resource.data.pointsAwarded is number
      && request.resource.data.keys().hasOnly([
        'questId',
        'studentId',
        'status',
        'assignedAt',
        'completedAt',
        'pointsAwarded',
        'completedBy',
        'completedByRole'
      ])
    )
    || (
      isStudent()
      && resource.data.studentId == request.auth.uid
      && resource.data.status == 'assigned'
      && request.resource.data.status == 'completed'
      && request.resource.data.studentId == resource.data.studentId
      && request.resource.data.questId == resource.data.questId
      && request.resource.data.completedBy == request.auth.uid
      && request.resource.data.completedByRole == 'student'
      && request.resource.data.completedAt is timestamp
      && request.resource.data.pointsAwarded is number
      && request.resource.data.keys().hasOnly([
        'questId',
        'studentId',
        'status',
        'assignedAt',
        'completedAt',
        'pointsAwarded',
        'completedBy',
        'completedByRole'
      ])
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
      && request.resource.data.studentName is string
      && request.resource.data.questId is string
      && request.resource.data.questTitle is string
      && request.resource.data.awardedPoints is number
      && request.resource.data.pointDifference is number
      && request.resource.data.previousAwardedPoints is number
      && request.resource.data.reason is string
      && request.resource.data.teacherId is string
      && request.resource.data.teacherName is string
      && request.resource.data.sectionId is string
      && request.resource.data.sectionName is string
      && request.resource.data.createdAt is timestamp
      && request.resource.data.updatedAt is timestamp
      && request.resource.data.keys().hasOnly([
        'studentId',
        'studentName',
        'questId',
        'questTitle',
        'source',
        'awardedPoints',
        'pointDifference',
        'previousAwardedPoints',
        'reason',
        'teacherId',
        'teacherName',
        'sectionId',
        'sectionName',
        'createdAt',
        'updatedAt'
      ])
    );
  allow update, delete: if isActiveAdmin();
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
      && request.resource.data.badgeId is string
      && request.resource.data.studentName is string
      && request.resource.data.name is string
      && request.resource.data.description is string
      && request.resource.data.status == 'active'
      && request.resource.data.questId is string
      && request.resource.data.awardedBy is string
      && request.resource.data.awardedAt is timestamp
      && request.resource.data.keys().hasOnly([
        'badgeId',
        'studentId',
        'studentName',
        'name',
        'description',
        'type',
        'status',
        'questId',
        'awardedBy',
        'awardedAt'
      ])
    );
  allow update: if isActiveAdmin()
    || (
      isStudent()
      && resource.data.studentId == request.auth.uid
      && request.resource.data.type == 'quest'
      && request.resource.data.studentId == request.auth.uid
      && request.resource.data.badgeId == resource.data.badgeId
      && request.resource.data.questId == resource.data.questId
      && request.resource.data.awardedBy == resource.data.awardedBy
      && request.resource.data.status == 'active'
      && request.resource.data.awardedAt is timestamp
      && request.resource.data.keys().hasOnly([
        'badgeId',
        'studentId',
        'studentName',
        'name',
        'description',
        'type',
        'status',
        'questId',
        'awardedBy',
        'awardedAt'
      ])
    );
  allow delete: if isActiveAdmin();
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
      && request.resource.data.badgeId is string
      && request.resource.data.studentName is string
      && request.resource.data.name is string
      && request.resource.data.description is string
      && request.resource.data.status == 'active'
      && request.resource.data.questId is string
      && request.resource.data.awardedBy is string
      && request.resource.data.awardedAt is timestamp
      && request.resource.data.keys().hasOnly([
        'badgeId',
        'studentId',
        'studentName',
        'name',
        'description',
        'type',
        'status',
        'questId',
        'awardedBy',
        'awardedAt'
      ])
    );
  allow update: if isActiveAdmin()
    || (
      isStudent()
      && resource.data.studentId == request.auth.uid
      && request.resource.data.type == 'quest'
      && request.resource.data.studentId == request.auth.uid
      && request.resource.data.badgeId == resource.data.badgeId
      && request.resource.data.questId == resource.data.questId
      && request.resource.data.awardedBy == resource.data.awardedBy
      && request.resource.data.status == 'active'
      && request.resource.data.awardedAt is timestamp
      && request.resource.data.keys().hasOnly([
        'badgeId',
        'studentId',
        'studentName',
        'name',
        'description',
        'type',
        'status',
        'questId',
        'awardedBy',
        'awardedAt'
      ])
    );
  allow delete: if isActiveAdmin();
}
```

These snippets assume your existing rules already define `isLoggedIn()`, `isActiveAdmin()`, `isActiveTeacher()`, and `isStudent()`.
