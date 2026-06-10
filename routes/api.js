/**
 * routes/api.js — REST API Routes
 * 
 * Defines all HTTP endpoints for the application.
 * This is the Routing Layer that maps URLs to controllers.
 */

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// ── Room Routes ──────────────────────────────────────────────
router.post('/rooms', roomController.createRoom);        // Create a room
router.get('/rooms', roomController.listRooms);           // List all rooms
router.get('/rooms/:id', roomController.getRoom);         // Get room info
router.get('/rooms/:id/strokes', roomController.getStrokes);   // Drawing history
router.get('/rooms/:id/messages', roomController.getMessages); // Chat history
router.delete('/rooms/:id', roomController.deleteRoom);        // Delete a room

module.exports = router;
