import express from 'express';
import { query } from './db.js';
import { isValidMove } from './rules.js';

const router = express.Router();

// ১. নতুন ম্যাচ সেশন শুরু করা এবং ডাটাবেজে টেবিল তৈরি নিশ্চিত করা
router.post('/match/start', async (req, res) => {
  try {
    // লার্নিং ডেটা রাখার জন্য ডাটাবেজে টেবিল না থাকলে তা স্বয়ংক্রিয়ভাবে তৈরি হবে
    await query(`
      CREATE TABLE IF NOT EXISTS ai_learning_memory (
        id SERIAL PRIMARY KEY,
        piece_name VARCHAR(50),
        target_coordinate VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        board_state JSONB,
        status VARCHAR(20),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const initialBoardState = {
      "0-0": { name: "Ratha", isWhite: false }, "0-1": { name: "Ashva", isWhite: false },
      "0-2": { name: "Gaja", isWhite: false },  "0-3": { name: "Raja", isWhite: false }
    };

    const result = await query(
      'INSERT INTO game_sessions (board_state, status) VALUES ($1, $2) RETURNING id',
      [JSON.stringify(initialBoardState), 'ongoing']
    );
    res.json({ success: true, matchId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ২. প্লেয়ারের নতুন নতুন চাল ও কৌশল ডাটাবেজে সেভ করার API Endpoint
router.post('/ai/learn', async (req, res) => {
  const { piece, coordinate } = req.body;
  try {
    await query(
      'INSERT INTO ai_learning_memory (piece_name, target_coordinate) VALUES ($1, $2)',
      [piece, coordinate]
    );
    // ডাটাবেজ থেকে এআই-এর এযাবৎকালের শেখা সব কৌশলের সংখ্যা আনা
    const memoryCount = await query('SELECT COUNT(*) FROM ai_learning_memory');
    res.json({ success: true, totalLearnedMoves: memoryCount.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ৩. এআই-এর চিন্তা করার জন্য ডাটাবেজ থেকে শেখা মেমোরি লোড করা
router.get('/ai/memory', async (req, res) => {
  try {
    const memoryRes = await query('SELECT piece_name, target_coordinate FROM ai_learning_memory ORDER BY id DESC LIMIT 50');
    res.json({ success: true, tactics: memoryRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
