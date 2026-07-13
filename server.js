const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit'); 
const { Pool } = require('pg'); // 🐘 PostgreSQL মডিউল যোগ করা হলো

const app = express();
const PORT = process.env.PORT || 5000;

// 🛡️ স্প্যামিং এবং DDOS প্রোটেকশন
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// মিডলওয়্যার কনফিগারেশন
app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter);

// 🐘 নিয়ন ডাটাবেজ কানেকশন (রেন্ডারের Environment Variable থেকে সরাসরি লিংক নেবে)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // নিয়ন ডাটাবেজের সিকিউর কানেকশনের জন্য এটি জরুরি
});

// 🛠️ ডাটাবেজে টেবিল তৈরি করার অটোমেটেড লজিক (টেবিল না থাকলে নিজে তৈরি হবে)
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS strategy_traps (
                id SERIAL PRIMARY KEY,
                move TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Neon Database Tables Synced Successfully!");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
}
initializeDatabase();

// 📊 ইন-মেমোরি লাইভ ভিজিটর ট্র্যাকিং (এটি রিয়েল-টাইম হওয়ায় ডাটাবেজে সেভ করার দরকার নেই)
let activeVisitors = new Map(); 
let activeMatches = new Map();

setInterval(() => {
    const now = Date.now();
    for (let [vid, lastSeen] of activeVisitors.entries()) {
        if (now - lastSeen > 12000) activeVisitors.delete(vid);
    }
}, 4000);

// 📡 রুট ১: লাইভ কাউন্টার এপিআই
app.get('/api/live-counters', (req, res) => {
    const visitorId = req.query.visitorId;
    if (visitorId) activeVisitors.set(visitorId, Date.now());

    let activeMatchesCount = 0;
    const now = Date.now();
    for (let [vid, statusObj] of activeMatches.entries()) {
        if (now - statusObj.timestamp > 12000) {
            activeMatches.delete(vid);
        } else if (statusObj.status === "playing") {
            activeMatchesCount++;
        }
    }

    res.json({ onlineNow: activeVisitors.size, inBattles: activeMatchesCount });
});

// 📡 রুট ২: রিয়েল-টাইম অ্যাক্টিভিটি রিপোর্টার
app.post('/api/report-activity', (req, res) => {
    const { status, mode, visitorId, lastAction } = req.body;
    if (visitorId) {
        activeVisitors.set(visitorId, Date.now());
        if (status === "ended") {
            activeMatches.delete(visitorId);
        } else {
            activeMatches.set(visitorId, {
                status: status,
                mode: mode,
                lastAction: lastAction || "",
                timestamp: Date.now()
            });
        }
    }
    res.json({ success: true });
});

// 📡 রুট ৩: স্ট্র্যাটেজি সেভ এপিআই (নিয়ন ডাটাবেজে সেভ হবে)
app.post('/api/save-strategy', async (req, res) => {
    const { move } = req.body;
    if (move) {
        try {
            await pool.query('INSERT INTO strategy_traps (move) VALUES ($1)', [move]);
            res.json({ success: true, message: "Strategy trained into Neon DB!" });
            return;
        } catch (err) {
            console.error(err);
        }
    }
    res.json({ success: false });
});

// 📡 রুট ৪: স্ট্র্যাটেজি গেট এপিআই (নিয়ন ডাটাবেজ থেকে এআই চালগুলো রিড করবে)
app.get('/api/get-strategies', async (req, res) => {
    try {
        const result = await pool.query('SELECT move FROM strategy_traps ORDER BY id DESC LIMIT 50');
        const traps = result.rows.map(row => row.move);
        res.json({ traps: traps });
    } catch (err) {
        res.json({ traps: [] });
    }
});

// 🛠️ রুট পাথ ফিক্স
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});
app.use(express.static(path.join(__dirname, 'public')));

// সার্ভার স্টার্ট
app.listen(PORT, () => {
    console.log(`Chaturanga Adaptive Engine connected to Neon & active on port ${PORT}`);
});
