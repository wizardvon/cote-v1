# Firestore rules for `scores` collection

Use these snippets in your Firestore Rules file (`Firestore Database` → `Rules`).

## 1) Recommended rule for your current app (teachers + super admin can create/read)

```rules
match /scores/{scoreId} {
  allow read: if request.auth != null
    && (
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['teacher', 'superAdmin']
      || request.auth.uid == resource.data.studentId
    );

  allow create: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['teacher', 'superAdmin']
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == 'active'
    && request.resource.data.studentId is string
    && request.resource.data.section is string
    && request.resource.data.type is string
    && request.resource.data.title is string
    && request.resource.data.score is number
    && request.resource.data.maxScore is number
    && request.resource.data.score >= 0
    && request.resource.data.maxScore > 0
    && request.resource.data.score <= request.resource.data.maxScore
    && request.resource.data.teacherId == request.auth.uid;

  // lock edits/deletes for now (your UI only creates records)
  allow update, delete: if false;
}
```

## 2) Temporary testing rule (short-term only)

```rules
match /scores/{scoreId} {
  allow read, write: if request.auth != null;
}
```

## 3) Safer strict version for later (authorized writers only + schema checks)

```rules
function signedIn() {
  return request.auth != null;
}

function myUser() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function isActiveTeacherOrSuperAdmin() {
  return signedIn()
    && myUser().status == 'active'
    && (myUser().role == 'teacher' || myUser().role == 'superAdmin');
}

match /scores/{scoreId} {
  // Student can read own records; teachers/super admin can read all
  allow read: if isActiveTeacherOrSuperAdmin()
    || (signedIn() && request.auth.uid == resource.data.studentId);

  // Only active teacher/super admin can create
  allow create: if isActiveTeacherOrSuperAdmin()
    // required fields
    && request.resource.data.keys().hasAll([
      'studentId', 'studentName', 'section', 'type', 'title',
      'score', 'maxScore', 'teacherId', 'teacherName', 'teacherEmail', 'createdAt'
    ])
    // no unexpected fields (optional: include 'lrn', 'gradeLevel' if you store them)
    && request.resource.data.keys().hasOnly([
      'studentId', 'studentName', 'lrn', 'section', 'gradeLevel',
      'type', 'title', 'score', 'maxScore', 'teacherId',
      'teacherName', 'teacherEmail', 'createdAt'
    ])
    // types and bounds
    && request.resource.data.studentId is string
    && request.resource.data.score is number
    && request.resource.data.maxScore is number
    && request.resource.data.score >= 0
    && request.resource.data.maxScore > 0
    && request.resource.data.score <= request.resource.data.maxScore
    // prevent impersonation
    && request.resource.data.teacherId == request.auth.uid;

  allow update, delete: if false;
}
```

## 4) Where to paste in Firebase Console

1. Open Firebase Console → your project (`cote-v1`) → **Firestore Database**.
2. Go to the **Rules** tab.
3. Paste one `match /scores/{scoreId}` block **inside**:
   - `rules_version = '2';`
   - `service cloud.firestore {`
   - `match /databases/{database}/documents { ... }`
4. Click **Publish**.

### Minimal full-file example shape

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // existing collection rules...

    match /scores/{scoreId} {
      // your chosen scores rules here
    }
  }
}
```

