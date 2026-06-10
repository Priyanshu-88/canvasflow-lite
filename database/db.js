/**
 * database/db.js — SQLite Database Setup
 * 
 * Initializes the SQLite database using better-sqlite3.
 * Creates all tables on first run.
 * This is the Data Layer in our layered architecture.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'canvasflow.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      color TEXT NOT NULL,
      room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
      socket_id TEXT,
      is_online INTEGER DEFAULT 1,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strokes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      stroke_data TEXT NOT NULL,
      stroke_order INTEGER NOT NULL,
      is_undone INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sticky_notes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      content TEXT DEFAULT '',
      x REAL DEFAULT 100,
      y REAL DEFAULT 100,
      color TEXT DEFAULT '#FFEAA7',
      width REAL DEFAULT 200,
      height REAL DEFAULT 150,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[DB] SQLite database initialized successfully');
}

initializeDatabase();
module.exports = db;
