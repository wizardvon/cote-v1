import {
  getMessagingIdentity,
  getMessageContacts,
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
let conversations = [];
let activeConversation = null;
let refreshTimer = 0;

const elements = {
  contactSelect: null,
  startButton: null,
  threadList: null,
  messageList: null,
  messageForm: null,
  messageInput: null,
  status: null,
  heading: null
};

function collectElements() {
  elements.contactSelect = document.getElementById('message-contact-select');
  elements.startButton = document.getElementById('message-start-button');
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

function renderContacts() {
  if (!elements.contactSelect) return;

  elements.contactSelect.innerHTML = '<option value="">Select contact</option>';
  contacts.forEach((contact) => {
    const option = document.createElement('option');
    option.value = contact.id;
    option.textContent = `${contact.displayName || contact.email || 'Contact'} (${roleLabel(contact.role)})`;
    elements.contactSelect.append(option);
  });
}

function renderThreads() {
  if (!elements.threadList) return;

  if (!conversations.length) {
    elements.threadList.innerHTML = '<p class="empty-cell">No messages yet.</p>';
    return;
  }

  elements.threadList.innerHTML = conversations
    .map((thread) => {
      const isActive = activeConversation?.id === thread.id;
      return `
        <button type="button" class="message-thread-item ${isActive ? 'active' : ''}" data-conversation-id="${escapeHtml(
          thread.id
        )}">
          <span class="message-avatar" aria-hidden="true">${escapeHtml(getInitials(thread.contactName))}</span>
          <span class="message-thread-copy">
            <strong>${escapeHtml(thread.contactName || 'Contact')}</strong>
            <span>${escapeHtml(thread.lastMessage || 'No messages yet.')}</span>
          </span>
        </button>
      `;
    })
    .join('');
}

async function renderMessages() {
  if (!elements.messageList) return;

  if (!activeConversation?.id) {
    elements.messageList.innerHTML = '<p class="empty-cell">Select or start a conversation.</p>';
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
    contacts = await getMessageContacts(identity);
    renderContacts();
    await refreshConversations();
    setStatus('Messaging ready.', 'success');
  } catch (error) {
    console.error('Failed to initialize messaging:', error);
    setStatus(error?.message || 'Unable to load messaging.', 'error');
  }

  elements.startButton?.addEventListener('click', startSelectedConversation);
  elements.threadList?.addEventListener('click', selectThreadFromClick);
  elements.messageForm?.addEventListener('submit', submitMessage);
}

export async function refreshConversations() {
  if (!identity?.uid) return;
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

async function startSelectedConversation() {
  const contactId = elements.contactSelect?.value || '';
  const contact = contacts.find((item) => item.id === contactId);
  if (!contact) {
    setStatus('Select a contact first.', 'error');
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

  const button = target.closest('button[data-conversation-id]');
  if (!(button instanceof HTMLButtonElement)) return;

  activeConversation = conversations.find((thread) => thread.id === button.dataset.conversationId) || null;
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
