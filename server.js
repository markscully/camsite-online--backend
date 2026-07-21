require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const { pool, initSchema } = require('./db');
const authRoutes = require('./routes/auth');
const streamRoutes = require('./routes/streams');
const tokenRoutes = require('./routes/tokens');
const { authMiddleware, requireAdmin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Troppi tentativi. Riprova tra 15 minuti.' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Troppe richieste.' } });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/streams', apiLimiter, streamRoutes);
app.use('/api/tokens', apiLimiter, tokenRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'Cam2Me' }));

// --- Socket.io per chat ---
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token mancante'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Token non valido'));
  }
});

io.on('connection', (socket) => {
  let currentStreamId = null;

  socket.on('join_stream', async (streamId) => {
    try {
      currentStreamId = streamId;
      socket.join(`stream_${streamId}`);
      await pool.query('UPDATE streams SET viewers = viewers + 1 WHERE id = $1', [streamId]);
      const r = await pool.query('SELECT viewers FROM streams WHERE id = $1', [streamId]);
      io.to(`stream_${streamId}`).emit('viewer_count', r.rows[0]?.viewers || 0);
    } catch (err) { console.error('[socket join_stream]', err); }
  });

  socket.on('chat_message', async ({ streamId, message }) => {
    if (!message?.trim()) return;
    try {
      const trimmed = message.trim().slice(0, 500);
      const result = await pool.query(
        'INSERT INTO chat_messages (stream_id, user_id, message) VALUES ($1, $2, $3) RETURNING id, created_at',
        [streamId, socket.user.id, trimmed]
      );
      io.to(`stream_${streamId}`).emit('chat_message', {
        id: result.rows[0].id,
        username: socket.user.username,
        message: trimmed,
        created_at: result.rows[0].created_at
      });
    } catch (err) { console.error('[socket chat_message]', err); }
  });

  socket.on('send_tip', async ({ streamId, amount }) => {
    const tipAmount = Number(amount);
    if (!Number.isInteger(tipAmount) || tipAmount <= 0) {
      return socket.emit('tip_error', { error: 'Importo non valido' });
    }

    const client = await pool.connect();
    try {
      const streamResult = await client.query('SELECT * FROM streams WHERE id = $1', [streamId]);
      const stream = streamResult.rows[0];
      if (!stream) return socket.emit('tip_error', { error: 'Stream non trovato' });
      if (stream.broadcaster_id === socket.user.id) return socket.emit('tip_error', { error: 'Non puoi inviare tip a te stesso' });

      const senderResult = await client.query('SELECT token_balance FROM users WHERE id = $1', [socket.user.id]);
      if (senderResult.rows[0].token_balance < tipAmount) {
        return socket.emit('tip_error', { error: 'Saldo insufficiente' });
      }

      await client.query('BEGIN');
      await client.query('UPDATE users SET token_balance = token_balance - $1 WHERE id = $2', [tipAmount, socket.user.id]);
      await client.query('UPDATE users SET token_balance = token_balance + $1 WHERE id = $2', [tipAmount, stream.broadcaster_id]);
      await client.query(`INSERT INTO token_transactions (user_id, type, amount, related_user_id, stream_id, description) VALUES ($1,'tip_sent',$2,$3,$4,$5)`,
        [socket.user.id, -tipAmount, stream.broadcaster_id, streamId, `Tip a ${stream.title}`]);
      await client.query(`INSERT INTO token_transactions (user_id, type, amount, related_user_id, stream_id, description) VALUES ($1,'tip_received',$2,$3,$4,$5)`,
        [stream.broadcaster_id, tipAmount, socket.user.id, streamId, `Tip da ${socket.user.username}`]);
      const msgResult = await client.query(
        'INSERT INTO chat_messages (stream_id, user_id, message, is_tip, tip_amount) VALUES ($1,$2,$3,TRUE,$4) RETURNING id, created_at',
        [streamId, socket.user.id, `ha inviato ${tipAmount} token! 🪙`, tipAmount]
      );
      await client.query('COMMIT');

      const updated = await pool.query('SELECT token_balance FROM users WHERE id = $1', [socket.user.id]);
      socket.emit('balance_update', { balance: updated.rows[0].token_balance });
      io.to(`stream_${streamId}`).emit('chat_message', {
        id: msgResult.rows[0].id,
        username: socket.user.username,
        message: `ha inviato ${tipAmount} token! 🪙`,
        is_tip: true,
        tip_amount: tipAmount,
        created_at: msgResult.rows[0].created_at
      });
    } catch (err) {
      await client.query('ROLLBACK');
      socket.emit('tip_error', { error: 'Errore interno' });
    } finally {
      client.release();
    }
  });

  // Broadcaster segnala fine stream via socket
  socket.on('stream_ended', async (streamId) => {
    try {
      await pool.query('UPDATE streams SET is_live = FALSE, viewers = 0 WHERE id = $1', [streamId]);
      io.to(`stream_${streamId}`).emit('stream_offline');
    } catch (err) { console.error('[socket stream_ended]', err); }
  });

  socket.on('disconnect', async () => {
    if (currentStreamId) {
      try {
        await pool.query('UPDATE streams SET viewers = GREATEST(viewers - 1, 0) WHERE id = $1', [currentStreamId]);
        const r = await pool.query('SELECT viewers FROM streams WHERE id = $1', [currentStreamId]);
        io.to(`stream_${currentStreamId}`).emit('viewer_count', r.rows[0]?.viewers || 0);
      } catch (err) { console.error('[socket disconnect]', err); }
    }
  });
});

const PORT = process.env.PORT || 4000;
initSchema().then(() => {
  server.listen(PORT, () => console.log(`Cam2Me backend su http://localhost:${PORT}`));
}).catch((err) => {
  console.error('[postgres] Errore schema:', err);
  process.exit(1);
});
