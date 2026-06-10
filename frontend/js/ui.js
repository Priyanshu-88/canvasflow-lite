/**
 * ui.js — UI Controller + Sticky Notes
 * 
 * Manages toolbar, panels, keyboard shortcuts, share modal,
 * participants, sticky notes, and all user interactions.
 */

// ============================================================
// STICKY NOTES MODULE
// ============================================================
const StickyNotes = (() => {
  const layer = document.getElementById('sticky-notes-layer');
  const NOTE_COLORS = ['#FFEAA7', '#DFE6E9', '#FAB1A0', '#81ECEC', '#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E'];
  let colorIndex = 0;

  function addNote(data, isNew = true) {
    const el = document.createElement('div');
    el.className = 'sticky-note';
    el.id = `note-${data.id}`;
    el.style.left = data.x + 'px';
    el.style.top = data.y + 'px';
    el.style.background = data.color || NOTE_COLORS[0];
    el.style.width = (data.width || 200) + 'px';
    el.innerHTML = `
      <div class="sticky-note-header">
        <span>${data.username || 'You'}</span>
        <button class="sticky-note-delete" data-id="${data.id}" title="Delete">&times;</button>
      </div>
      <textarea class="sticky-note-content" data-id="${data.id}" placeholder="Type note...">${data.content || ''}</textarea>
    `;
    layer.appendChild(el);

    // Drag
    const header = el.querySelector('.sticky-note-header');
    let dragging = false, offsetX = 0, offsetY = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      el.style.zIndex = 70;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = 65;
      SocketClient.emitStickyNoteMove({ id: data.id, x: parseInt(el.style.left), y: parseInt(el.style.top) });
    });

    // Edit
    const textarea = el.querySelector('.sticky-note-content');
    let editTimeout;
    textarea.addEventListener('input', () => {
      clearTimeout(editTimeout);
      editTimeout = setTimeout(() => {
        SocketClient.emitStickyNoteEdit({ id: data.id, content: textarea.value });
      }, 500);
    });

    // Delete
    el.querySelector('.sticky-note-delete').addEventListener('click', () => {
      SocketClient.emitStickyNoteDelete({ id: data.id });
      el.remove();
    });
  }

  function moveNote(id, x, y) {
    const el = document.getElementById(`note-${id}`);
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
  }

  function editNote(id, content) {
    const el = document.getElementById(`note-${id}`);
    if (el) {
      const ta = el.querySelector('.sticky-note-content');
      if (ta && ta !== document.activeElement) ta.value = content;
    }
  }

  function removeNote(id) {
    const el = document.getElementById(`note-${id}`);
    if (el) el.remove();
  }

  function clearAll() {
    layer.innerHTML = '';
  }

  function createNew() {
    const color = NOTE_COLORS[colorIndex % NOTE_COLORS.length];
    colorIndex++;
    const area = document.getElementById('canvas-area').getBoundingClientRect();
    const x = 80 + Math.random() * (area.width - 300);
    const y = 80 + Math.random() * (area.height - 250);
    SocketClient.emitStickyNoteAdd({ x: Math.round(x), y: Math.round(y), color, content: '' }, (res) => {
      if (res && res.success) addNote(res.note, true);
    });
  }

  return { addNote, moveNote, editNote, removeNote, clearAll, createNew };
})();

// ============================================================
// UI CONTROLLER
// ============================================================
const UIController = (() => {
  const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
  const colorPicker = document.getElementById('color-picker');
  const colorDisplay = document.getElementById('color-display');
  const sizeSlider = document.getElementById('size-slider');
  const sizeLabel = document.getElementById('size-label');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnClear = document.getElementById('btn-clear');
  const btnChat = document.getElementById('btn-chat');
  const btnChatClose = document.getElementById('btn-chat-close');
  const chatPanel = document.getElementById('chat-panel');
  const btnExport = document.getElementById('btn-export');
  const btnTheme = document.getElementById('btn-theme');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const roomIdDisplay = document.getElementById('room-id-display');
  const roomNameDisplay = document.getElementById('room-name-display');
  const usersListEl = document.getElementById('users-list');
  const btnParticipants = document.getElementById('btn-participants');
  const participantsPanel = document.getElementById('participants-panel');
  const btnParticipantsClose = document.getElementById('btn-participants-close');
  const btnShare = document.getElementById('btn-share');
  const shareModal = document.getElementById('share-modal');
  const btnSticky = document.getElementById('btn-sticky');

  // ── Tool Selection ─────────────────────────────────────
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.set('currentTool', btn.dataset.tool);
      const canvas = document.getElementById('drawing-canvas');
      const cursors = { eraser: 'cell', text: 'text', laser: 'default' };
      canvas.style.cursor = cursors[btn.dataset.tool] || 'crosshair';
    });
  });

  // ── Quick Colors ───────────────────────────────────────
  document.querySelectorAll('.qcolor').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.qcolor').forEach(q => q.classList.remove('active'));
      el.classList.add('active');
      const color = el.dataset.color;
      AppState.set('currentColor', color);
      colorDisplay.style.background = color;
      colorPicker.value = color;
    });
  });

  // ── Color Picker ───────────────────────────────────────
  colorPicker.addEventListener('input', (e) => {
    AppState.set('currentColor', e.target.value);
    colorDisplay.style.background = e.target.value;
    document.querySelectorAll('.qcolor').forEach(q => q.classList.remove('active'));
  });
  colorDisplay.addEventListener('click', () => colorPicker.click());

  // ── Brush Size ─────────────────────────────────────────
  sizeSlider.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    AppState.set('brushSize', size);
    sizeLabel.textContent = size;
  });

  // ── Undo / Redo ────────────────────────────────────────
  btnUndo.addEventListener('click', () => {
    SocketClient.emitUndo((res) => { if (res?.error) SocketClient.showToast(res.error); });
  });
  btnRedo.addEventListener('click', () => {
    SocketClient.emitRedo((res) => { if (res?.error) SocketClient.showToast(res.error); });
  });

  // ── Clear Canvas ───────────────────────────────────────
  btnClear.addEventListener('click', () => {
    SocketClient.emitClear((res) => {
      if (res?.error) SocketClient.showToast(res.error);
    });
  });

  // ── Sticky Note ────────────────────────────────────────
  btnSticky.addEventListener('click', () => StickyNotes.createNew());

  // ── Chat Toggle ────────────────────────────────────────
  function toggleChat() {
    // Close participants if open
    participantsPanel.classList.remove('open');
    btnParticipants.classList.remove('active');

    const isOpen = !AppState.get('isChatOpen');
    AppState.set('isChatOpen', isOpen);
    chatPanel.classList.toggle('open', isOpen);
    btnChat.classList.toggle('active', isOpen);
    if (isOpen) {
      AppState.set('unreadMessages', 0);
      ChatModule.updateBadge(0);
      document.getElementById('chat-input').focus();
    }
  }
  btnChat.addEventListener('click', toggleChat);
  btnChatClose.addEventListener('click', toggleChat);

  // ── Participants Toggle ────────────────────────────────
  function toggleParticipants() {
    chatPanel.classList.remove('open');
    btnChat.classList.remove('active');
    AppState.set('isChatOpen', false);

    const isOpen = participantsPanel.classList.toggle('open');
    btnParticipants.classList.toggle('active', isOpen);
  }
  btnParticipants.addEventListener('click', toggleParticipants);
  btnParticipantsClose.addEventListener('click', toggleParticipants);

  // ── Share Modal ────────────────────────────────────────
  btnShare.addEventListener('click', () => {
    const link = `${window.location.origin}/whiteboard?room=${AppState.get('roomId')}`;
    document.getElementById('share-link').value = link;
    document.getElementById('share-room-id').textContent = AppState.get('roomId');
    shareModal.style.display = 'flex';
  });

  document.getElementById('btn-copy-link').addEventListener('click', () => {
    const linkInput = document.getElementById('share-link');
    navigator.clipboard.writeText(linkInput.value).then(() => {
      SocketClient.showToast('Link copied to clipboard!');
    });
  });

  document.getElementById('btn-close-share').addEventListener('click', () => {
    shareModal.style.display = 'none';
  });

  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) shareModal.style.display = 'none';
  });

  // ── Export PNG ──────────────────────────────────────────
  btnExport.addEventListener('click', () => {
    CanvasEngine.exportPNG();
    SocketClient.showToast('Canvas exported as PNG');
  });

  // ── Theme Toggle ───────────────────────────────────────
  btnTheme.addEventListener('click', () => {
    const isDark = !AppState.get('isDarkMode');
    AppState.set('isDarkMode', isDark);
    document.body.classList.toggle('light-mode', !isDark);
    btnTheme.innerHTML = isDark ? '&#127769;' : '&#9728;';
    CanvasEngine.render();
  });

  // ── Zoom ───────────────────────────────────────────────
  btnZoomIn.addEventListener('click', () => CanvasEngine.setZoom(AppState.get('zoom') + 0.1));
  btnZoomOut.addEventListener('click', () => CanvasEngine.setZoom(AppState.get('zoom') - 0.1));
  btnZoomReset.addEventListener('click', () => CanvasEngine.resetView());

  // ── Room ID Copy ───────────────────────────────────────
  roomIdDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(AppState.get('roomId')).then(() => {
      SocketClient.showToast('Room ID copied!');
    });
  });

  // ── Update Functions ───────────────────────────────────
  function updateRoomInfo() {
    roomIdDisplay.textContent = AppState.get('roomId');
    roomNameDisplay.textContent = AppState.get('roomName') || '';
    document.title = `${AppState.get('roomName') || 'Whiteboard'} — CanvasFlow Lite`;
  }

  function updateUsersList() {
    const users = AppState.get('users') || [];
    usersListEl.innerHTML = users.map(user => `
      <div class="user-avatar" style="background:${user.color}" title="${user.username}">
        ${user.username.charAt(0).toUpperCase()}
        <span class="tooltip">${user.username}</span>
      </div>
    `).join('');
  }

  function updateParticipants() {
    const users = AppState.get('users') || [];
    const list = document.getElementById('participants-list');
    list.innerHTML = users.map(user => `
      <div class="participant-item">
        <div class="participant-avatar" style="background:${user.color}">${user.username.charAt(0).toUpperCase()}</div>
        <div class="participant-info">
          <div class="participant-name">${user.username}${user.id === AppState.get('userId') ? ' (you)' : ''}</div>
          <div class="participant-status">Online</div>
        </div>
      </div>
    `).join('');

    if (users.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;font-size:0.85rem;">No participants</p>';
    }
  }

  // ── Keyboard Shortcuts ─────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); btnUndo.click(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); btnRedo.click(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); btnExport.click(); }

    switch (e.key.toLowerCase()) {
      case 'p': document.getElementById('tool-pen')?.click(); break;
      case 'h': document.getElementById('tool-highlighter')?.click(); break;
      case 'l': document.getElementById('tool-line')?.click(); break;
      case 'r': document.getElementById('tool-rect')?.click(); break;
      case 'o': document.getElementById('tool-circle')?.click(); break;
      case 'a': document.getElementById('tool-arrow')?.click(); break;
      case 't': document.getElementById('tool-text')?.click(); break;
      case 'e': document.getElementById('tool-eraser')?.click(); break;
      case 'w': document.getElementById('tool-laser')?.click(); break;
      case 'n': StickyNotes.createNew(); break;
      case 'c': if (!e.ctrlKey) toggleChat(); break;
    }

    if (e.key === '=' || e.key === '+') {
      const s = Math.min(30, AppState.get('brushSize') + 1);
      AppState.set('brushSize', s); sizeSlider.value = s; sizeLabel.textContent = s;
    }
    if (e.key === '-') {
      const s = Math.max(1, AppState.get('brushSize') - 1);
      AppState.set('brushSize', s); sizeSlider.value = s; sizeLabel.textContent = s;
    }
  });

  // ── Clipboard Paste (image paste support) ──────────────
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            // Draw pasted image as a stroke-like element
            SocketClient.showToast('Image pasted to canvas');
            // For simplicity, we render it directly but it won't persist in the stroke model
            const canvas = document.getElementById('drawing-canvas');
            const ctx2 = canvas.getContext('2d');
            const zoom = AppState.get('zoom');
            ctx2.drawImage(img, 100 * zoom, 100 * zoom, img.width * zoom * 0.5, img.height * zoom * 0.5);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  });

  // ── Initialize ─────────────────────────────────────────
  function init() {
    CanvasEngine.init();
    updateRoomInfo();
    console.log('[UI] Controller initialized');
  }

  init();

  return { updateRoomInfo, updateUsersList, updateParticipants, toggleChat };
})();
