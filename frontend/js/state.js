/**
 * state.js — Application State Manager
 * 
 * Central state store using a simple observer pattern (pub/sub).
 * All modules read/write state through this module, ensuring
 * a single source of truth for the application.
 * 
 * Part of the Frontend Layer in our layered architecture.
 */

const AppState = (() => {
  // ── Private State ──────────────────────────────────────
  const state = {
    // User info
    userId: null,
    username: sessionStorage.getItem('cf_username') || 'Anonymous',
    userColor: '#00d4ff',

    // Room info
    roomId: new URLSearchParams(window.location.search).get('room'),
    roomName: sessionStorage.getItem('cf_room_name') || '',

    // Drawing state
    currentTool: 'pen',      // pen, line, rect, circle, eraser
    currentColor: '#00d4ff',
    brushSize: 3,
    isDrawing: false,

    // Canvas state
    zoom: 1,
    panX: 0,
    panY: 0,

    // Users in room
    users: [],

    // Theme
    isDarkMode: true,

    // Chat
    isChatOpen: false,
    unreadMessages: 0,

    // Connection
    isConnected: false,
  };

  // ── Observer Pattern ───────────────────────────────────
  const listeners = {};

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch
   * @param {Function} callback - Called with (newValue, oldValue)
   */
  function on(key, callback) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(callback);
  }

  /**
   * Notify all listeners for a key
   */
  function notify(key, newVal, oldVal) {
    if (listeners[key]) {
      listeners[key].forEach(cb => cb(newVal, oldVal));
    }
  }

  /**
   * Get a state value
   */
  function get(key) {
    return state[key];
  }

  /**
   * Set a state value and notify listeners
   */
  function set(key, value) {
    const old = state[key];
    if (old === value) return;
    state[key] = value;
    notify(key, value, old);
  }

  /**
   * Update multiple state values at once
   */
  function update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      const old = state[key];
      state[key] = value;
      if (old !== value) notify(key, value, old);
    });
  }

  /**
   * Get all state (read-only copy)
   */
  function getAll() {
    return { ...state };
  }

  // ── Redirect if no room ────────────────────────────────
  if (!state.roomId) {
    window.location.href = '/';
  }

  return { on, get, set, update, getAll };
})();
