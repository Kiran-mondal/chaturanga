const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ১. স্ট্যাটিক ফাইল ও লোগো ডিরেক্টরি সার্ভ করার জন্য মিডলওয়্যার (লোগো ফিক্স)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Sync database tables on startup
pool.query(`CREATE TABLE IF NOT EXISTS strategy_traps (id SERIAL PRIMARY KEY, move TEXT NOT NULL);`)
    .then(() => console.log("Database tables synchronized successfully"))
    .catch(err => console.error("Database sync error:", err));

// API: Save new strategy
app.post('/api/save-strategy', async (req, res) => {
    try {
        const { move } = req.body;
        if (!move) return res.status(400).json({ success: false, message: "No move provided" });
        await pool.query('INSERT INTO strategy_traps (move) VALUES ($1)', [move]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Retrieve strategies
app.get('/api/get-strategies', async (req, res) => {
    try {
        const result = await pool.query('SELECT move FROM strategy_traps ORDER BY id DESC LIMIT 50');
        res.json({ traps: result.rows.map(r => r.move) });
    } catch (err) {
        res.json({ traps: [] });
    }
});

// ২. হোম রুট হিসেবে index.html ফাইলটি সরাসরি সার্ভ করার ব্যবস্থা করা হলো
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ৩. লোকাল এনভায়রনমেন্ট টেস্ট বা ভার্সেলের ব্যাকআপের জন্য পোর্ট লিসেনার
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
