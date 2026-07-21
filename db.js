const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[postgres] Errore sul pool:', err);
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      token_balance INTEGER NOT NULL DEFAULT 0,
      bio TEXT,
      avatar_url TEXT,
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      ban_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS streams (
      id SERIAL PRIMARY KEY,
      broadcaster_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category TEXT,
      is_live BOOLEAN NOT NULL DEFAULT FALSE,
      viewers INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      stream_id INTEGER NOT NULL REFERENCES streams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      is_tip BOOLEAN NOT NULL DEFAULT FALSE,
      tip_amount INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS token_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      related_user_id INTEGER REFERENCES users(id),
      stream_id INTEGER REFERENCES streams(id),
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payout_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      tokens_requested INTEGER NOT NULL,
      amount_eur NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payout_method TEXT,
      payout_details TEXT,
      admin_note TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_user_id INTEGER REFERENCES users(id),
      details TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_streams_broadcaster ON streams(broadcaster_id);
    CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_stream ON chat_messages(stream_id);
    CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_id);
  `);
}

module.exports = { pool, initSchema };
