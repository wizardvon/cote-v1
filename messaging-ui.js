import {
  getMessagingIdentity,
  getMessageContacts,
  getMessageContactFilters,
  getOrCreateConversation,
  getConversations,
  getConversationMessages,
  sendMessage
} from './messaging.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMessageTime(value) {
  const date = value?.toDate?.() || null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getInitials(value) {
  return String(value || 'User')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
}

let identity = null;
let contacts = [];
let contactFilters = [];
let activeFilter = '';
let conversations = [];
let activeConversation = null;
let refreshTimer = 0;

const elements = {
  contactFilter: null,
  threadList: null,
  messageList: null,
  messageForm: null,
  messageInput: null,
  status: null,
  heading: null
};

function collectElements() {
  elements.contactFilter = document.getElementById('message-contact-filter');
  elements.threadList = document.getElementById('message-thread-list');
  elements.messageList = document.getElementById('message-list');
  elements.messageForm = document.getElementById('message-form');
  elements.messageInput = document.getElementById('message-input');
  elements.status = document.getElementById('message-status');
  elements.heading = document.getElementById('message-thread-heading');
}

function setStatus(message, type = '') {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.classList.remove('success', 'error');
  if (type) elements.status.classList.add(type);
}

function roleLabel(role) {
  if (role === 'superAdmin') return 'Super Admin';
  if (role === 'teacher') return 'Teacher';
  if (role === 'student') return 'Student';
  return 'User';
}

function renderContactFilter() {
  if (!elements.contactFilter) return;

  if (identity?.role !== 'teacher') {
    elements.contactFilter.closest('.field')?.setAttribute('hidden', '');
    return;
  }

  elements.contactFilter.innerHTML = '';
  contactFilters.forEach((filter) => {
    const option = document.createElement('option');
    option.value = filter.id;
    option.textContent = filter.label;
    elements.contactFilter.append(option);
  });

  if (contactFilters.length) {
    activeFilter = activeFilter || contactFilters[0].id;
    elements.contactFilter.value = activeFilter;
  }
}

function getVisibleContacts() {
  if (!activeFilter) return contacts;
  if (activeFilter === 'teachers') return contacts.filter((contact) => contact.role === 'teacher');
  return contacts.filter((contact) => Array.isArray(contact.filterKeys) && contact.filterKeys.includes(activeFilter));
}

function renderThreads() {
  if (!elements.threadList) return;

  const visibleContacts = getVisibleContacts();
  if (!visibleContacts.length) {
    const message =
      identity?.role === 'superAdmin'
        ? 'Messaging is available for students and teachers.'
        : identity?.role === 'teacher'
          ? 'No contacts found for this filter.'
          : 'No teachers available yet.';
    elements.threadList.innerHTML = `<p class="empty-cell">${escapeHtml(message)}</p>`;
    return;
  }

  elements.threadList.innerHTML = visibleContacts
    .map((contact) => {
      const thread = conversations.find((item) => item.contactId === contact.id);
      const isActive = activeConversation?.contactId === contact.id;
      const detail =
        thread?.lastMessage ||
        (contact.role === 'student' && Array.isArray(contact.classLabels) && contact.classLabels.length
          ? contact.classLabels.join(', ')
          : roleLabel(contact.role));
      return `
        <button type="button" class="message-thread-item ${isActive ? 'active' : ''}" data-contact-id="${escapeHtml(
          contact.id
        )}" data-conversation-id="${escapeHtml(thread?.id || '')}">
          <span class="message-avatar" aria-hidden="true">${escapeHtml(getInitials(contact.displayName))}</span>
          <span class="message-thread-copy">
            <strong>${escapeHtml(contact.displayName || contact.email || 'Contact')}</strong>
            <span>${escapeHtml(detail || 'No messages yet.')}</span>
          </span>
        </button>
      `;
    })
    .join('');
}

async function renderMessages() {
  if (!elements.messageList) return;

  if (!activeConversation?.id) {
    elements.messageList.innerHTML = '<p class="empty-cell">Select a name to open a conversation.</p>';
    if (elements.heading) elements.heading.textContent = 'Conversation';
    return;
  }

  if (elements.heading) {
    elements.heading.innerHTML = `
      <span class="message-avatar" aria-hidden="true">${escapeHtml(getInitials(activeConversation.contactName))}</span>
      <span>
        <strong>${escapeHtml(activeConversation.contactName || 'Conversation')}</strong>
        <small>${escapeHtml(roleLabel(activeConversation.contactRole))}</small>
      </span>
    `;
  }

  elements.messageList.innerHTML = '<p class="empty-cell">Loading messages...</p>';
  const messages = await getConversationMessages(activeConversation.id);

  if (!messages.length) {
    elements.messageList.innerHTML = '<p class="empty-cell">No messages in this thread yet.</p>';
    return;
  }

  elements.messageList.innerHTML = messages
    .map((message) => {
      const isMine = message.senderId === identity.uid;
      return `
        <article class="message-bubble ${isMine ? 'mine' : ''}">
          <p>${escapeHtml(message.body || '')}</p>
          <small>${escapeHtml(isMine ? 'You' : message.senderName || 'User')} - ${escapeHtml(
            formatMessageTime(message.createdAt)
          )}</small>
        </article>
      `;
    })
    .join('');
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

export async function initMessagingUI() {
  collectElements();
  if (!elements.threadList || !elements.messageList) return;

  try {
    identity = await getMessagingIdentity();
    if (identity.role === 'superAdmin') {
      contacts = [];
      contactFilters = [];
      renderThreads();
      await renderMessages();
      setStatus('Messaging is available for students and teachers.', '');
      return;
    }

    contactFilters = await getMessageContactFilters(identity);
    activeFilter = contactFilters[0]?.id || '';
    contacts = await getMessageContacts(identity);
    renderContactFilter();
    await refreshConversations();
    setStatus('Messaging ready.', 'success');
  } catch (error) {
    console.error('Failed to initialize messaging:', error);
    setStatus(error?.message || 'Unable to load messaging.', 'error');
  }

  elements.contactFilter?.addEventListener('change', changeContactFilter);
  elements.threadList?.addEventListener('click', selectThreadFromClick);
  elements.messageForm?.addEventListener('submit', submitMessage);
}

export async function refreshConversations() {
  if (!identity?.uid || identity.role === 'superAdmin') return;
  conversations = await getConversations(identity);
  renderThreads();
  if (activeConversation?.id) {
    const updated = conversations.find((thread) => thread.id === activeConversation.id);
    if (updated) activeConversation = updated;
    await renderMessages();
  }
}

export function startMessagingAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = window.setInterval(() => {
    refreshConversations().catch((error) => console.warn('Message refresh failed:', error));
  }, 15000);
}

function changeContactFilter() {
  activeFilter = elements.contactFilter?.value || '';
  renderThreads();
}

async function openContactConversation(contactId) {
  const contact = contacts.find((item) => item.id === contactId);
  if (!contact) {
    setStatus('Select a contact from the list.', 'error');
    return;
  }

  try {
    activeConversation = await getOrCreateConversation(identity, contact);
    await refreshConversations();
    await renderMessages();
    setStatus(`Conversation opened with ${activeConversation.contactName}.`, 'success');
  } catch (error) {
    console.error('Failed to start conversation:', error);
    setStatus(error?.message || 'Unable to start conversation.', 'error');
  }
}

async function selectThreadFromClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest('button[data-contact-id], button[data-conversation-id]');
  if (!(button instanceof HTMLButtonElement)) return;

  const conversationId = button.dataset.conversationId || '';
  const contactId = button.dataset.contactId || '';
  activeConversation = conversations.find((thread) => thread.id === conversationId) || null;

  if (!activeConversation && contactId) {
    await openContactConversation(contactId);
    return;
  }

  renderThreads();
  await renderMessages();
}

async function submitMessage(event) {
  event.preventDefault();
  const body = elements.messageInput?.value || '';

  try {
    await sendMessage(identity, activeConversation, body);
    if (elements.messageInput) elements.messageInput.value = '';
    await refreshConversations();
    await renderMessages();
    setStatus('Message sent.', 'success');
  } catch (error) {
    console.error('Failed to send message:', error);
    setStatus(error?.message || 'Unable to send message.', 'error');
  }
}
