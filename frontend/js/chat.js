/**
 * chat.js — Chat Panel Module
 * 
 * Handles the in-app chat functionality:
 *   - Sending and receiving messages
 *   - Loading chat history
 *   - Typing indicators
 *   - Auto-scroll on new messages
 *   - Unread message counter
 * 
 * Part of the Frontend Layer — communicates via SocketClient.
 */

const ChatModule = (() => {
  // ── DOM References ─────────────────────────────────────
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-chat-send');
  const typingEl = document.getElementById('typing-indicator');

  // ── Typing Indicator State ─────────────────────────────
  let typingTimeout = null;
  let isTyping = false;
  const typingUsers = {};

  // ── Send Message ───────────────────────────────────────
  function sendMessage() {
    const content = inputEl.value.trim();
    if (!content) return;

    SocketClient.emitChatMessage(content);
    inputEl.value = '';

    // Stop typing indicator
    if (isTyping) {
      isTyping = false;
      SocketClient.emitTyping(false);
    }
  }

  // ── Add Message to UI ──────────────────────────────────
  function addMessage(data) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';

    const time = new Date(data.sent_at || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isOwn = data.userId === AppState.get('userId');

    msgEl.innerHTML = `
      <div class="chat-msg-header">
        <span class="chat-msg-user" style="color: ${data.color || '#00d4ff'}">${isOwn ? 'You' : data.username}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      <div class="chat-msg-body">${escapeHtml(data.content)}</div>
    `;

    messagesEl.appendChild(msgEl);
    scrollToBottom();

    // Increment unread if chat is closed
    if (!AppState.get('isChatOpen')) {
      const unread = AppState.get('unreadMessages') + 1;
      AppState.set('unreadMessages', unread);
      updateBadge(unread);
    }
  }

  // ── Load Chat History ──────────────────────────────────
  function loadHistory(messages) {
    messagesEl.innerHTML = '';
    messages.forEach(msg => {
      addMessage({
        userId: msg.user_id,
        username: msg.username,
        content: msg.content,
        sent_at: msg.sent_at,
        color: '#94a3b8',
      });
    });
    // Reset unread after loading history
    AppState.set('unreadMessages', 0);
    updateBadge(0);
  }

  // ── Typing Indicators ─────────────────────────────────
  function showTyping(data) {
    if (data.isTyping) {
      typingUsers[data.userId] = data.username;
    } else {
      delete typingUsers[data.userId];
    }

    const names = Object.values(typingUsers);
    if (names.length === 0) {
      typingEl.textContent = '';
    } else if (names.length === 1) {
      typingEl.textContent = `${names[0]} is typing...`;
    } else {
      typingEl.textContent = `${names.length} people are typing...`;
    }
  }

  // ── Badge Update ───────────────────────────────────────
  function updateBadge(count) {
    const badge = document.getElementById('chat-badge');
    if (!badge) return;
    if (count > 0) {
      badge.style.display = 'flex';
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      badge.style.display = 'none';
    }
  }

  // ── Helpers ────────────────────────────────────────────
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Event Listeners ────────────────────────────────────
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Typing detection
  inputEl.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      SocketClient.emitTyping(true);
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      SocketClient.emitTyping(false);
    }, 2000);
  });

  // ── Public API ─────────────────────────────────────────
  return {
    addMessage,
    loadHistory,
    showTyping,
    updateBadge,
  };
})();
