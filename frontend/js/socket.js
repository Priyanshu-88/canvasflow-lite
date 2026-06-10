/**
 * socket.js — WebSocket Client Manager
 * 
 * Manages Socket.io connection and all real-time events.
 * Part of the WebSocket Layer in our event-driven architecture.
 */

const SocketClient = (() => {
  const socket = io({ reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
  let lastCursorEmit = 0;
  const CURSOR_THROTTLE_MS = 50;

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    AppState.set('isConnected', true);
    joinRoom();
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    AppState.set('isConnected', false);
  });

  function joinRoom() {
    const roomId = AppState.get('roomId');
    const username = AppState.get('username');
    const userId = sessionStorage.getItem('cf_user_id');
    if (!roomId || !username) return;

    socket.emit('join-room', { roomId, username, userId }, (response) => {
      if (response.error) {
        alert('Failed to join room: ' + response.error);
        window.location.href = '/';
        return;
      }

      AppState.update({
        userId: response.user.id,
        userColor: response.user.color,
        roomName: response.room.name,
        users: response.users,
      });
      sessionStorage.setItem('cf_user_id', response.user.id);

      if (response.strokes && response.strokes.length > 0) CanvasEngine.setStrokes(response.strokes);
      if (response.messages && response.messages.length > 0) ChatModule.loadHistory(response.messages);

      // Load sticky notes
      if (response.stickyNotes && response.stickyNotes.length > 0) {
        response.stickyNotes.forEach(note => {
          if (typeof StickyNotes !== 'undefined') StickyNotes.addNote(note, false);
        });
      }

      if (typeof UIController !== 'undefined') {
        UIController.updateRoomInfo();
        UIController.updateUsersList();
        UIController.updateParticipants();
      }

      console.log(`[Socket] Joined room ${roomId} as ${username}`);
      showToast(`Joined room "${response.room.name}"`);
      showActivity(`You joined the room`);
    });
  }

  // ── Incoming Events ────────────────────────────────────
  socket.on('user-joined', (data) => {
    AppState.set('users', data.users);
    if (typeof UIController !== 'undefined') { UIController.updateUsersList(); UIController.updateParticipants(); }
    showToast(`${data.user.username} joined`);
    showActivity(`${data.user.username} joined the room`);
  });

  socket.on('user-left', (data) => {
    AppState.set('users', data.users);
    CanvasEngine.removeRemoteCursor(data.userId);
    if (typeof UIController !== 'undefined') { UIController.updateUsersList(); UIController.updateParticipants(); }
    showToast(`${data.username} left`);
    showActivity(`${data.username} left`);
  });

  socket.on('draw', (data) => {
    CanvasEngine.addRemoteStroke(data.strokeData);
    showActivity(`${data.username} drew something`);
  });

  socket.on('draw-live', (data) => { /* Live preview handled by final stroke */ });

  socket.on('cursor-move', (data) => { CanvasEngine.updateRemoteCursor(data); });

  socket.on('chat-message', (data) => {
    if (typeof ChatModule !== 'undefined') ChatModule.addMessage(data);
  });

  socket.on('user-typing', (data) => {
    if (typeof ChatModule !== 'undefined') ChatModule.showTyping(data);
  });

  socket.on('canvas-update', (data) => {
    CanvasEngine.setStrokes(data.strokes);
    if (data.action === 'clear') {
      // Also clear sticky notes
      if (typeof StickyNotes !== 'undefined') StickyNotes.clearAll();
      showToast(`${data.username} cleared the canvas`);
      showActivity(`${data.username} cleared everything`);
    } else if (data.action === 'undo') {
      showActivity(`${data.username} undid an action`);
    } else if (data.action === 'redo') {
      showActivity(`${data.username} redid an action`);
    }
  });

  // Sticky note events
  socket.on('sticky-note-added', (note) => {
    if (typeof StickyNotes !== 'undefined') StickyNotes.addNote(note, false);
    showActivity(`${note.username} added a sticky note`);
  });

  socket.on('sticky-note-moved', (data) => {
    if (typeof StickyNotes !== 'undefined') StickyNotes.moveNote(data.id, data.x, data.y);
  });

  socket.on('sticky-note-edited', (data) => {
    if (typeof StickyNotes !== 'undefined') StickyNotes.editNote(data.id, data.content);
  });

  socket.on('sticky-note-deleted', (data) => {
    if (typeof StickyNotes !== 'undefined') StickyNotes.removeNote(data.id);
  });

  // ── Emit Functions ─────────────────────────────────────
  function emitDraw(strokeData) { socket.emit('draw', { strokeData }); }
  function emitDrawLive(data) { socket.emit('draw-live', data); }

  function emitCursor(x, y) {
    const now = Date.now();
    if (now - lastCursorEmit < CURSOR_THROTTLE_MS) return;
    lastCursorEmit = now;
    socket.emit('cursor-move', { x, y });
  }

  function emitChatMessage(content) { socket.emit('chat-message', { content }); }
  function emitTyping(isTyping) { socket.emit('user-typing', { isTyping }); }

  function emitUndo(callback) { socket.emit('undo', {}, callback); }
  function emitRedo(callback) { socket.emit('redo', {}, callback); }
  function emitClear(callback) { socket.emit('clear-canvas', {}, callback); }

  function emitStickyNoteAdd(data, callback) { socket.emit('sticky-note-add', data, callback); }
  function emitStickyNoteMove(data) { socket.emit('sticky-note-move', data); }
  function emitStickyNoteEdit(data) { socket.emit('sticky-note-edit', data); }
  function emitStickyNoteDelete(data) { socket.emit('sticky-note-delete', data); }

  // ── Helpers ────────────────────────────────────────────
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function showActivity(message) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `<span>${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span> ${message}`;
    feed.appendChild(item);
    setTimeout(() => item.remove(), 4000);
    // Keep max 5 items
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
  }

  return {
    emitDraw, emitDrawLive, emitCursor, emitChatMessage, emitTyping,
    emitUndo, emitRedo, emitClear,
    emitStickyNoteAdd, emitStickyNoteMove, emitStickyNoteEdit, emitStickyNoteDelete,
    showToast, showActivity,
  };
})();
