import express from 'express';
import { query } from './db.js';
import { isValidMove } from './rules.js';

const router = express.Router();

// 1. Create a new match session inside Neon DB
router.post('/match/start', async (req, res) => {
  const { playerWhite, playerBlack } = req.body;
  
  // Starting setup layout for Chaturanga on an Ashtapada board
  const initialBoardState = {
    "0-0": { name: "Ratha", isWhite: false }, "0-1": { name: "Ashva", isWhite: false },
    "0-2": { name: "Gaja", isWhite: false },  "0-3": { name: "Mantri", isWhite: false },
    "0-4": { name: "Raja", isWhite: false },   "0-5": { name: "Gaja", isWhite: false },
    "0-6": { name: "Ashva", isWhite: false }, "0-7": { name: "Ratha", isWhite: false },
    "1-0": { name: "Padati", isWhite: false }, "1-1": { name: "Padati", isWhite: false },
    // (Rest of the pawns and white pieces will be processed via AI / JSON mapping)
  };

  try {
    const result = await query(
      'INSERT INTO game_sessions (board_state, status) VALUES ($1, $2) RETURNING id',
      [JSON.stringify(initialBoardState), 'ongoing']
    );
    res.json({ success: true, matchId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Submit a move, validate it using rules.js, and update Neon DB
router.post('/match/move', async (req, res) => {
  const { matchId, piece, fromRow, fromCol, toRow, toCol } = req.body;

  try {
    const matchRes = await query('SELECT board_state FROM game_sessions WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) return res.status(404).json({ error: "Match not found" });

    const currentBoard = matchRes.rows[0].board_state;

    // Check movement rule validity
    const valid = isValidMove(piece, fromRow, fromCol, toRow, toCol, currentBoard);
    if (!valid) return res.status(400).json({ error: "Illegal Chaturanga move executed" });

    // Update internal board configuration matrix
    delete currentBoard[`${fromRow}-${fromCol}`];
    currentBoard[`${toRow}-${toCol}`] = { name: piece };

    await query(
      'UPDATE game_sessions SET board_state = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(currentBoard), matchId]
    );

    res.json({ success: true, updatedBoard: currentBoard });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
       
