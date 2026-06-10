/**
 * server.js — Application Entry Point
 * 
 * Wires together all layers of the architecture:
 *   1. Express (HTTP server + static files + REST API)
 *   2. Socket.io (WebSocket real-time events)
 *   3. SQLite (Database — initialized on import)
 * 
 * Architecture: Layered + Event-Driven
 *   [Frontend] ↔ [WebSocket Layer] ↔ [Backend API] ↔ [Database]
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import layers
const apiRoutes = require('./routes/api');
const { initializeSocketHandler } = require('./socket/socketHandler');

// ── Express Setup ──────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Mount REST API routes
app.use('/api', apiRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Serve whiteboard page
app.get('/whiteboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'whiteboard.html'));
});

// ── Socket.io Setup ────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Performance tuning
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6, // 1MB max message size
});

// Initialize WebSocket event handlers
initializeSocketHandler(io);

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('');
  console.log('  CanvasFlow Lite');
  console.log('  ──────────────────────────────────');
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  API endpoint:    http://localhost:${PORT}/api`);
  console.log(`  WebSocket:       ws://localhost:${PORT}`);
  console.log('  ──────────────────────────────────');
  console.log('');
});
