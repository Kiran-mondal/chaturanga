const express = require('express');
const cors = require('cors');
const path = require('path'); // 🛠️ পাথ মডিউল যোগ করা হলো পেজ লোড করার জন্য
const rateLimit = require('express-rate-limit'); 

const app = express();
const PORT = process.env.PORT || 5000;

// 🛡️ ১. স্প্যামিং এবং DDOS প্রোটেকশন
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

// গ্লোবাল এপিআই রাউটে রেট লিমিটার অ্যাপ্লাই করা হলো
app.use('/api/', apiLimiter);

// 📊 ইন-মে-মোরি ট্রাফিক এবং ম্যাচ ডেটা স্টোরেজ
let activeVisitors = new Map(); 
let activeMatches = new Map();
let strategyTraps = [];

// ⏱️ নিষ্ক্রিয় ইউজারদের ট্র্যাকার থেকে সরানোর মেকানিজম (cleanup)
setInterval(() => {
    const now = Date.now();
    for (let [vid, lastSeen] of activeVisitors.entries()) {
        if (now - lastSeen > 12000) { 
            activeVisitors.delete(vid);
        }
    }
}, 4000);

// 📡 রুট ১: লাইভ কাউন্টার এপিআই
app.get('/api/live-counters', (req, res) => {
    const visitorId = req.query.visitorId;
    if (visitorId) {
        activeVisitors.set(visitorId, Date.now());
    }

    let activeMatchesCount = 0;
    const now = Date.now();
    for (let [vid, statusObj] of activeMatches.entries()) {
        if (now - statusObj.timestamp > 12000) {
            activeMatches.delete(vid);
        } else if (statusObj.status === "playing") {
            activeMatchesCount++;
        }
    }

    res.json({
        onlineNow: activeVisitors.size,
        inBattles: activeMatchesCount
    });
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

// 📡 রুট ③: স্ট্র্যাটেজি সেভ এপিআই
app.post('/api/save-strategy', (req, res) => {
    const { move, timestamp } = req.body;
    if (move) {
        strategyTraps.push({ move, timestamp: timestamp || new Date() });
        if (strategyTraps.length > 50) strategyTraps.shift(); 
    }
    res.json({ success: true });
});

// 📡 রুট ৪: স্ট্র্যাটেজি গেট এপিআই
app.get('/api/get-strategies', (req, res) => {
    res.json({ traps: strategyTraps.map(t => t.move) });
});

// 🛠️ 🛡️ [CRITICAL FIX]: 'Cannot GET /' এরর সমাধান
// আপনার ফ্রন্টএন্ড ফাইলটি (যেমন index.html) যদি গিটহাবের মেইন ডিরেক্টরিতে থাকে, তবে এটি সরাসরি সেটিকে লোড করবে।
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// যদি আপনার কোনো ইমেজ বা এক্সট্রা সিএসএস ফাইল মেইন ডিরেক্টরিতে থাকে, সেগুলোকে এক্সেস দেওয়ার জন্য:
app.use(express.static(__dirname));

// সার্ভার স্টার্ট
app.listen(PORT, () => {
    console.log(`Chaturanga Ancient Engine active on port ${PORT}`);
});
