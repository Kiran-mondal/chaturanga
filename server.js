import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import pg from 'pg';
const { Pool } = pg;

const app = new Hono().basePath('/api');

app.use('*', cors({ origin: '*' }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Sync strategy table
(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS strategy_traps (id SERIAL PRIMARY KEY, move TEXT NOT NULL);`);
})();

app.post('/save-strategy', async (c) => {
    const { move } = await c.req.json();
    await pool.query('INSERT INTO strategy_traps (move) VALUES ($1)', [move]);
    return c.json({ success: true });
});

app.get('/get-strategies', async (c) => {
    const result = await pool.query('SELECT move FROM strategy_traps ORDER BY id DESC LIMIT 50');
    return c.json({ traps: result.rows.map(r => r.move) });
});

export default handle(app);
