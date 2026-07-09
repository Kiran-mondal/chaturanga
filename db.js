import pg from 'pg';

const { Pool } = pg;

// রেন্ডার (Render) থেকে স্বয়ংক্রিয়ভাবে DATABASE_URL বা নিয়ন ডিবির লিঙ্কটি এখানে কানেক্ট হবে
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true, // Neon DB-র সিকিউরিটির জন্য এটি মাস্ট
  }
});

export const query = (text, params) => pool.query(text, params);
