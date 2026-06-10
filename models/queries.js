/**
 * models/queries.js — Prepared SQL Statements
 * All database operations encapsulated as prepared statements.
 */

const db = require('../database/db');

const roomQueries = {
  create: db.prepare(`INSERT INTO rooms (id, name) VALUES (?, ?)`),
  findById: db.prepare(`SELECT * FROM rooms WHERE id = ?`),
  findAll: db.prepare(`
    SELECT r.*, COUNT(DISTINCT u.id) as user_count
    FROM rooms r LEFT JOIN users u ON u.room_id = r.id AND u.is_online = 1
    GROUP BY r.id ORDER BY r.created_at DESC
  `),
  delete: db.prepare(`DELETE FROM rooms WHERE id = ?`),
};

const userQueries = {
  create: db.prepare(`INSERT INTO users (id, username, color, room_id, socket_id) VALUES (?, ?, ?, ?, ?)`),
  findById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  findBySocketId: db.prepare(`SELECT * FROM users WHERE socket_id = ?`),
  findByRoom: db.prepare(`SELECT id, username, color, joined_at FROM users WHERE room_id = ? AND is_online = 1 ORDER BY joined_at ASC`),
  updateSocketId: db.prepare(`UPDATE users SET socket_id = ?, is_online = 1 WHERE id = ?`),
  setOffline: db.prepare(`UPDATE users SET is_online = 0, socket_id = NULL WHERE socket_id = ?`),
  delete: db.prepare(`DELETE FROM users WHERE id = ?`),
};

const strokeQueries = {
  create: db.prepare(`INSERT INTO strokes (room_id, user_id, stroke_data, stroke_order) VALUES (?, ?, ?, ?)`),
  findByRoom: db.prepare(`SELECT * FROM strokes WHERE room_id = ? AND is_undone = 0 ORDER BY stroke_order ASC`),
  getNextOrder: db.prepare(`SELECT COALESCE(MAX(stroke_order), 0) + 1 as next_order FROM strokes WHERE room_id = ?`),
  undoLast: db.prepare(`
    UPDATE strokes SET is_undone = 1 WHERE id = (
      SELECT id FROM strokes WHERE room_id = ? AND user_id = ? AND is_undone = 0 ORDER BY stroke_order DESC LIMIT 1
    )
  `),
  redoLast: db.prepare(`
    UPDATE strokes SET is_undone = 0 WHERE id = (
      SELECT id FROM strokes WHERE room_id = ? AND user_id = ? AND is_undone = 1 ORDER BY stroke_order DESC LIMIT 1
    )
  `),
  clearRoom: db.prepare(`DELETE FROM strokes WHERE room_id = ?`),
  countUserStrokes: db.prepare(`SELECT COUNT(*) as count FROM strokes WHERE room_id = ? AND user_id = ? AND is_undone = 0`),
  countUserUndone: db.prepare(`SELECT COUNT(*) as count FROM strokes WHERE room_id = ? AND user_id = ? AND is_undone = 1`),
};

const messageQueries = {
  create: db.prepare(`INSERT INTO messages (room_id, user_id, username, content) VALUES (?, ?, ?, ?)`),
  findByRoom: db.prepare(`SELECT * FROM messages WHERE room_id = ? ORDER BY sent_at ASC LIMIT 100`),
  clearRoom: db.prepare(`DELETE FROM messages WHERE room_id = ?`),
};

const stickyNoteQueries = {
  create: db.prepare(`INSERT INTO sticky_notes (id, room_id, user_id, username, content, x, y, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  findByRoom: db.prepare(`SELECT * FROM sticky_notes WHERE room_id = ? ORDER BY created_at ASC`),
  update: db.prepare(`UPDATE sticky_notes SET content = ?, x = ?, y = ?, color = ?, width = ?, height = ? WHERE id = ?`),
  updatePosition: db.prepare(`UPDATE sticky_notes SET x = ?, y = ? WHERE id = ?`),
  updateContent: db.prepare(`UPDATE sticky_notes SET content = ? WHERE id = ?`),
  delete: db.prepare(`DELETE FROM sticky_notes WHERE id = ?`),
  clearRoom: db.prepare(`DELETE FROM sticky_notes WHERE room_id = ?`),
};

module.exports = { roomQueries, userQueries, strokeQueries, messageQueries, stickyNoteQueries };
