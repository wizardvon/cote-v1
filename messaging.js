import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from './firebase.js';

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  const role = cleanText(value);
  if (role === 'superAdmin') return 'superAdmin';
  if (role === 'teacher') return 'teacher';
  if (role === 'student') return 'student';
  return '';
}

function makeConversationId(uidA, uidB) {
  return [cleanText(uidA), cleanText(uidB)].sort().join('__');
}

function isAllowedPair(roleA, roleB) {
  const pair = [normalizeRole(roleA), normalizeRole(roleB)].sort().join(':');
  return pair === 'student:teacher' || pair === 'superAdmin:teacher';
}

function makeStudentName(data = {}) {
  return [data.firstName, data.middleName, data.lastName]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || cleanText(data.email) || 'Student';
}

function makeTeacherName(data = {}) {
  return [data.firstName, data.middleName, data.lastName]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || cleanText(data.email) || 'Teacher';
}

async function getUserRecord(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('User record not found.');
  return { id: userSnap.id, ...userSnap.data() };
}

async function getDisplayProfile(uid, role) {
  const collectionName = role === 'student' ? 'students' : role === 'teacher' ? 'teachers' : '';
  if (!collectionName) {
    const user = await getUserRecord(uid);
    return {
      id: uid,
      role,
      email: user.email || '',
      displayName: role === 'superAdmin' ? 'Super Admin' : user.email || 'User'
    };
  }

  const snap = await getDoc(doc(db, collectionName, uid));
  const data = snap.exists() ? snap.data() || {} : {};
  return {
    id: uid,
    role,
    email: data.email || '',
    displayName: role === 'student' ? makeStudentName(data) : makeTeacherName(data)
  };
}

export async function getMessagingIdentity(uid = auth.currentUser?.uid) {
  const user = await getUserRecord(uid);
  const role = normalizeRole(user.role);
  if (!role) throw new Error('Unsupported account role.');
  const profile = await getDisplayProfile(uid, role);
  return {
    uid,
    role,
    email: user.email || profile.email || '',
    displayName: profile.displayName || user.email || 'User'
  };
}

export async function getMessageContacts(identity) {
  if (!identity?.uid || !identity?.role) return [];

  if (identity.role === 'student') {
    const snapshot = await getDocs(query(collection(db, 'teachers'), where('status', '==', 'active')));
    return snapshot.docs
      .map((item) => ({ id: item.id, role: 'teacher', ...item.data(), displayName: makeTeacherName(item.data()) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  }

  if (identity.role === 'superAdmin') {
    const snapshot = await getDocs(query(collection(db, 'teachers'), where('status', '==', 'active')));
    return snapshot.docs
      .map((item) => ({ id: item.id, role: 'teacher', ...item.data(), displayName: makeTeacherName(item.data()) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  }

  if (identity.role === 'teacher') {
    const [students, admins] = await Promise.all([getApprovedTeacherStudents(identity.uid), getSuperAdminContacts()]);
    return [...admins, ...students];
  }

  return [];
}

async function getSuperAdminContacts() {
  const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'superAdmin')));
  return snapshot.docs
    .filter((item) => cleanText(item.data()?.status || 'active') === 'active')
    .map((item) => ({ id: item.id, role: 'superAdmin', email: item.data()?.email || '', displayName: 'Super Admin' }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

async function getApprovedTeacherStudents(teacherId) {
  const classSnapshot = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', teacherId)));
  const classIds = classSnapshot.docs.map((item) => item.id);
  if (!classIds.length) return [];

  const enrollmentSnapshots = await Promise.all(
    classIds.map((classId) =>
      getDocs(query(collection(db, 'classEnrollments'), where('classId', '==', classId), where('status', '==', 'approved')))
    )
  );
  const studentIds = [
    ...new Set(
      enrollmentSnapshots
        .flatMap((snapshot) => snapshot.docs.map((item) => cleanText(item.data()?.studentId)))
        .filter(Boolean)
    )
  ];

  const studentSnapshots = await Promise.all(studentIds.map((studentId) => getDoc(doc(db, 'students', studentId))));
  return studentSnapshots
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, role: 'student', ...snap.data(), displayName: makeStudentName(snap.data()) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

export async function getOrCreateConversation(identity, contact) {
  if (!identity?.uid || !contact?.id) throw new Error('Select a contact first.');
  const contactRole = normalizeRole(contact.role);
  if (!isAllowedPair(identity.role, contactRole)) {
    throw new Error('This messaging pair is not allowed.');
  }

  const conversationId = makeConversationId(identity.uid, contact.id);
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);
  const contactName = cleanText(contact.displayName || contact.email || 'Contact');

  const payload = {
    participantIds: [identity.uid, contact.id].sort(),
    participantRoles: {
      [identity.uid]: identity.role,
      [contact.id]: contactRole
    },
    participantNames: {
      [identity.uid]: identity.displayName || identity.email || 'User',
      [contact.id]: contactName
    },
    updatedAt: serverTimestamp()
  };

  if (conversationSnap.exists()) {
    await updateDoc(conversationRef, {
      participantNames: payload.participantNames,
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(conversationRef, {
      ...payload,
      lastMessage: '',
      lastSenderId: '',
      createdAt: serverTimestamp()
    });
  }

  return {
    id: conversationId,
    contactId: contact.id,
    contactName,
    contactRole,
    ...payload
  };
}

export async function getConversations(identity) {
  if (!identity?.uid) return [];
  const snapshot = await getDocs(
    query(collection(db, 'conversations'), where('participantIds', 'array-contains', identity.uid))
  );

  return snapshot.docs
    .map((item) => {
      const data = item.data() || {};
      const otherId = (Array.isArray(data.participantIds) ? data.participantIds : []).find((id) => id !== identity.uid) || '';
      return {
        id: item.id,
        ...data,
        contactId: otherId,
        contactName: data.participantNames?.[otherId] || 'Contact',
        contactRole: data.participantRoles?.[otherId] || ''
      };
    })
    .sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || 0;
      const bTime = b.updatedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
}

export async function getConversationMessages(conversationId) {
  const id = cleanText(conversationId);
  if (!id) return [];

  const snapshot = await getDocs(query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'asc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function sendMessage(identity, conversation, body) {
  const message = cleanText(body);
  if (!identity?.uid || !conversation?.id) throw new Error('Select a conversation first.');
  if (!message) throw new Error('Write a message first.');
  if (message.length > 1200) throw new Error('Message is too long.');

  await addDoc(collection(db, 'conversations', conversation.id, 'messages'), {
    senderId: identity.uid,
    senderRole: identity.role,
    senderName: identity.displayName || identity.email || 'User',
    body: message,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'conversations', conversation.id), {
    lastMessage: message,
    lastSenderId: identity.uid,
    updatedAt: serverTimestamp()
  });
}
