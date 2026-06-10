/**
 * socket/socketHandler.js — Socket.io Event Handler
 * 
 * Central hub for all real-time WebSocket events.
 * Implements the Event-Driven Layer of our architecture.
 */

const { v4: uuidv4 } = require('uuid');
const { roomQueries, userQueries, strokeQueries, messageQueries, stickyNoteQueries } = require('../models/queries');

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

function getUserColor(roomId) {
  const users = userQueries.findByRoom.all(roomId);
  return USER_COLORS[users.length % USER_COLORS.length];
}

function initializeSocketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── JOIN ROOM ──────────────────────────────────────
    socket.on('join-room', (data, callback) => {
      try {
        const { roomId, username, userId: existingUserId } = data;
        const room = roomQueries.findById.get(roomId);
        if (!room) return callback?.({ error: 'Room not found' });

        let user;
        if (existingUserId) {
          user = userQueries.findById.get(existingUserId);
          if (user && user.room_id === roomId) {
            userQueries.updateSocketId.run(socket.id, user.id);
            user = userQueries.findById.get(existingUserId);
          } else {
            user = null;
          }
        }

        if (!user) {
          const userId = uuidv4().slice(0, 12);
          const color = getUserColor(roomId);
          userQueries.create.run(userId, username, color, roomId, socket.id);
          user = userQueries.findById.get(userId);
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = user.id;
        socket.username = user.username;
        socket.userColor = user.color;

        const users = userQueries.findByRoom.all(roomId);
        const strokes = strokeQueries.findByRoom.all(roomId);
        const messages = messageQueries.findByRoom.all(roomId);
        const stickyNotes = stickyNoteQueries.findByRoom.all(roomId);

        const parsedStrokes = strokes.map(s => ({
          ...s,
          stroke_data: JSON.parse(s.stroke_data),
        }));

        socket.to(roomId).emit('user-joined', {
          user: { id: user.id, username: user.username, color: user.color },
          users,
        });

        callback?.({
          success: true,
          user: { id: user.id, username: user.username, color: user.color },
          room,
          users,
          strokes: parsedStrokes,
          messages,
          stickyNotes,
        });

        console.log(`[Socket] ${user.username} joined room ${roomId} (${users.length} users)`);
      } catch (err) {
        console.error('[Socket] join-room error:', err.message);
        callback?.({ error: 'Failed to join room' });
      }
    });

    // ── DRAW ───────────────────────────────────────────
    socket.on('draw', (data) => {
      try {
        const { roomId, userId } = socket;
        if (!roomId) return;
        const { strokeData } = data;
        const { next_order } = strokeQueries.getNextOrder.get(roomId);
        strokeQueries.create.run(roomId, userId, JSON.stringify(strokeData), next_order);
        socket.to(roomId).emit('draw', {
          userId, username: socket.username, strokeData, strokeOrder: next_order,
        });
      } catch (err) {
        console.error('[Socket] draw error:', err.message);
      }
    });

    // ── DRAW LIVE ──────────────────────────────────────
    socket.on('draw-live', (data) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit('draw-live', { userId: socket.userId, ...data });
    });

    // ── CURSOR MOVE ────────────────────────────────────
    socket.on('cursor-move', (data) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit('cursor-move', {
        userId: socket.userId, username: socket.username,
        color: socket.userColor, x: data.x, y: data.y,
      });
    });

    // ── CHAT MESSAGE ───────────────────────────────────
    socket.on('chat-message', (data) => {
      try {
        const { roomId, userId } = socket;
        if (!roomId) return;
        const { content } = data;
        if (!content || content.trim().length === 0) return;
        messageQueries.create.run(roomId, userId, socket.username, content.trim());
        io.to(roomId).emit('chat-message', {
          userId, username: socket.username, color: socket.userColor,
          content: content.trim(), sent_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket] chat error:', err.message);
      }
    });

    // ── USER TYPING ────────────────────────────────────
    socket.on('user-typing', (data) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit('user-typing', {
        userId: socket.userId, username: socket.username, isTyping: data.isTyping,
      });
    });

    // ── UNDO ───────────────────────────────────────────
    socket.on('undo', (data, callback) => {
      try {
        const { roomId, userId } = socket;
        if (!roomId) return;
        const { count } = strokeQueries.countUserStrokes.get(roomId, userId);
        if (count === 0) return callback?.({ error: 'Nothing to undo' });
        strokeQueries.undoLast.run(roomId, userId);
        const strokes = strokeQueries.findByRoom.all(roomId);
        const parsed = strokes.map(s => ({ ...s, stroke_data: JSON.parse(s.stroke_data) }));
        io.to(roomId).emit('canvas-update', { strokes: parsed, action: 'undo', userId, username: socket.username });
        callback?.({ success: true });
      } catch (err) {
        console.error('[Socket] undo error:', err.message);
        callback?.({ error: 'Undo failed' });
      }
    });

    // ── REDO ───────────────────────────────────────────
    socket.on('redo', (data, callback) => {
      try {
        const { roomId, userId } = socket;
        if (!roomId) return;
        const { count } = strokeQueries.countUserUndone.get(roomId, userId);
        if (count === 0) return callback?.({ error: 'Nothing to redo' });
        strokeQueries.redoLast.run(roomId, userId);
        const strokes = strokeQueries.findByRoom.all(roomId);
        const parsed = strokes.map(s => ({ ...s, stroke_data: JSON.parse(s.stroke_data) }));
        io.to(roomId).emit('canvas-update', { strokes: parsed, action: 'redo', userId, username: socket.username });
        callback?.({ success: true });
      } catch (err) {
        console.error('[Socket] redo error:', err.message);
        callback?.({ error: 'Redo failed' });
      }
    });

    // ── CLEAR CANVAS ───────────────────────────────────
    socket.on('clear-canvas', (data, callback) => {
      try {
        const { roomId } = socket;
        if (!roomId) return;
        strokeQueries.clearRoom.run(roomId);
        stickyNoteQueries.clearRoom.run(roomId);
        io.to(roomId).emit('canvas-update', { strokes: [], stickyNotes: [], action: 'clear', userId: socket.userId, username: socket.username });
        callback?.({ success: true });
        console.log(`[Socket] Canvas cleared in room ${roomId} by ${socket.username}`);
      } catch (err) {
        console.error('[Socket] clear error:', err.message);
        callback?.({ error: 'Clear failed' });
      }
    });

    // ── STICKY NOTES ───────────────────────────────────
    socket.on('sticky-note-add', (data, callback) => {
      try {
        const { roomId, userId } = socket;
        if (!roomId) return;
        const noteId = uuidv4().slice(0, 10);
        const { x, y, color, content } = data;
        stickyNoteQueries.create.run(noteId, roomId, userId, socket.username, content || '', x || 100, y || 100, color || '#FFEAA7');
        const note = { id: noteId, room_id: roomId, user_id: userId, username: socket.username, content: content || '', x: x || 100, y: y || 100, color: color || '#FFEAA7', width: 200, height: 150 };
        io.to(roomId).emit('sticky-note-added', note);
        callback?.({ success: true, note });
      } catch (err) {
        console.error('[Socket] sticky-note-add error:', err.message);
      }
    });

    socket.on('sticky-note-move', (data) => {
      try {
        if (!socket.roomId) return;
        stickyNoteQueries.updatePosition.run(data.x, data.y, data.id);
        socket.to(socket.roomId).emit('sticky-note-moved', data);
      } catch (err) {
        console.error('[Socket] sticky-note-move error:', err.message);
      }
    });

    socket.on('sticky-note-edit', (data) => {
      try {
        if (!socket.roomId) return;
        stickyNoteQueries.updateContent.run(data.content, data.id);
        socket.to(socket.roomId).emit('sticky-note-edited', data);
      } catch (err) {
        console.error('[Socket] sticky-note-edit error:', err.message);
      }
    });

    socket.on('sticky-note-delete', (data) => {
      try {
        if (!socket.roomId) return;
        stickyNoteQueries.delete.run(data.id);
        io.to(socket.roomId).emit('sticky-note-deleted', { id: data.id });
      } catch (err) {
        console.error('[Socket] sticky-note-delete error:', err.message);
      }
    });

    // ── DISCONNECT ─────────────────────────────────────
    socket.on('disconnect', () => {
      try {
        const { roomId, userId, username } = socket;
        if (roomId && userId) {
          userQueries.setOffline.run(socket.id);
          const users = userQueries.findByRoom.all(roomId);
          socket.to(roomId).emit('user-left', { userId, username, users });
          console.log(`[Socket] ${username} left room ${roomId} (${users.length} users remaining)`);
        }
      } catch (err) {
        console.error('[Socket] disconnect error:', err.message);
      }
    });
  });

  console.log('[Socket] Event handlers initialized');
}

module.exports = { initializeSocketHandler };
