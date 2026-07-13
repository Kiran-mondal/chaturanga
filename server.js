import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import pg from 'pg'
const { Pool } = pg

// 🚀 Hono অ্যাপ ইনিশিয়েশন (/api বেস পাথ সহ)
const app = new Hono().basePath('/api')

// 📝 লগার এবং 🛡️ CORS মিডলওয়্যার যুক্ত করা
app.use('*', logger())
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'visitorId']
}))

// 🐘 নিয়ন ডাটাবেজ কানেকশন (Environment Variable থেকে সরাসরি লিংক নেবে)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

// 🛠️ ডাটাবেজে টেবিল তৈরি করার অটোমেটেড লজিক
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS strategy_traps (
                id SERIAL PRIMARY KEY,
                move TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Neon Database Tables Synced Successfully via Hono!");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
}
initializeDatabase()

// 📊 ইন-মেমোরি লাইভ ভিজিটর ও ম্যাচ ট্র্যাকিং
let activeVisitors = new Map()
let activeMatches = new Map()

// অলস ভিজিটরদের পরিষ্কার করার ইন্টারভাল
setInterval(() => {
    const now = Date.now()
    for (let [vid, lastSeen] of activeVisitors.entries()) {
        if (now - lastSeen > 12000) activeVisitors.delete(vid)
    }
}, 4000)

// 📡 রুট ১: লাইভ কাউন্টার এপিআই
app.get('/live-counters', (c) => {
    const visitorId = c.req.query('visitorId')
    if (visitorId) activeVisitors.set(visitorId, Date.now())

    let activeMatchesCount = 0;
    const now = Date.now()
    for (let [vid, statusObj] of activeMatches.entries()) {
        if (now - statusObj.timestamp > 12000) {
            activeMatches.delete(vid)
        } else if (statusObj.status === "playing") {
            activeMatchesCount++
        }
    }

    return c.json({ onlineNow: activeVisitors.size, inBattles: activeMatchesCount })
})

// 📡 রুট ২: রিয়েল-টাইম অ্যাক্টিভিটি রিপোর্টার
app.post('/report-activity', async (c) => {
    try {
        const body = await c.req.json()
        const { status, mode, visitorId, lastAction } = body

        if (visitorId) {
            activeVisitors.set(visitorId, Date.now())
            if (status === "ended") {
                activeMatches.delete(visitorId)
            } else {
                activeMatches.set(visitorId, {
                    status: status,
                    mode: mode,
                    lastAction: lastAction || "",
                    timestamp: Date.now()
                })
            }
        }
        return c.json({ success: true })
    } catch (err) {
        return c.json({ success: false, error: err.message }, 400)
    }
})

// 📡 রুট ৩: স্ট্র্যাটেজি সেভ এপিআই (নিয়ন ডাটাবেজে সেভ হবে)
app.post('/save-strategy', async (c) => {
    try {
        const body = await c.req.json()
        const { move } = body

        if (move) {
            await pool.query('INSERT INTO strategy_traps (move) VALUES ($1)', [move])
            return c.json({ success: true, message: "Strategy trained into Neon DB via Hono!" })
        }
        return c.json({ success: false, message: "No move provided" }, 400)
    } catch (err) {
        console.error(err)
        return c.json({ success: false, error: err.message }, 500)
    }
})

// 📡 রুট ৪: স্ট্র্যাটেজি গেট এপিআই (নিয়ন ডাটাবেজ থেকে এআই চালগুলো রিড করবে)
app.get('/get-strategies', async (c) => {
    try {
        const result = await pool.query('SELECT move FROM strategy_traps ORDER BY id DESC LIMIT 50')
        const traps = result.rows.map(row => row.move)
        return c.json({ traps: traps })
    } catch (err) {
        return c.json({ traps: [] })
    }
})

// 🚀 Vercel সার্ভারলেস এনভায়রনমেন্টের জন্য এক্সপোর্ট হ্যান্ডলার
export default handle(app)
