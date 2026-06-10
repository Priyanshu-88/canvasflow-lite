/**
 * controllers/roomController.js — Room Controller
 * 
 * Handles HTTP request/response logic for room operations.
 * This is the Controller Layer in our layered architecture.
 */

const { v4: uuidv4 } = require('uuid');
const { roomQueries, strokeQueries, messageQueries, userQueries } = require('../models/queries');
/**
 * POST /api/rooms — Create a new room
 */
function createRoom(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomId = uuidv4().slice(0, 8); // Short readable ID
    roomQueries.create.run(roomId, name.trim());

    const room = roomQueries.findById.get(roomId);
    console.log(`[Room] Created room "${name}" with ID: ${roomId}`);

    res.status(201).json({ success: true, room });
  } catch (err) {
    console.error('[Room] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
}
/**
 * GET /api/rooms — List all rooms
 */
function listRooms(req, res) {
  try {
    const rooms = roomQueries.findAll.all();
    res.json({ success: true, rooms });
  } catch (err) {
    console.error('[Room] List error:', err.message);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
}
/**
 * GET /api/rooms/:id — Get room info
 */
function getRoom(req, res) {
  try {
    const room = roomQueries.findById.get(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const users = userQueries.findByRoom.all(req.params.id);
    res.json({ success: true, room, users });
  } catch (err) {
    console.error('[Room] Get error:', err.message);
    res.status(500).json({ error: 'Failed to get room' });
  }
}
/**
 * GET /api/rooms/:id/strokes — Get drawing history
 */
function getStrokes(req, res) {
  try {
    const strokes = strokeQueries.findByRoom.all(req.params.id);

    // Parse stroke_data JSON for each stroke
    const parsed = strokes.map(s => ({
      ...s,
      stroke_data: JSON.parse(s.stroke_data),
    }));

    res.json({ success: true, strokes: parsed });
  } catch (err) {
    console.error('[Room] Get strokes error:', err.message);
    res.status(500).json({ error: 'Failed to get strokes' });
  }
}

/**
 * GET /api/rooms/:id/messages — Get chat history
 */
function getMessages(req, res) {
  try {
    const messages = messageQueries.findByRoom.all(req.params.id);
    res.json({ success: true, messages });
  } catch (err) {
    console.error('[Room] Get messages error:', err.message);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}
/**
 * DELETE /api/rooms/:id — Delete a room
 */
function deleteRoom(req, res) {
  try {
    const roomId = req.params.id;
    const room = roomQueries.findById.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    roomQueries.delete.run(roomId);
    console.log(`[Room] Deleted room "${room.name}" with ID: ${roomId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Room] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete room' });
  }
}

module.exports = {
  createRoom,
  listRooms,
  getRoom,
  getStrokes,
  getMessages,
  deleteRoom,
};
