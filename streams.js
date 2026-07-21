const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createLiveKitToken } = require('../lib/livekit');

const router = express.Router();

// Lista stream (con filtri opzionali ?category=xxx&q=titolo)
router.get('/', async (req, res) => {
  try {
    const { category, q } = req.query;
    const conditions = [];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`s.category = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`s.title ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT s.id, s.title, s.category, s.is_live, s.viewers, u.username AS broadcaster, u.avatar_url
      FROM streams s
      JOIN users u ON u.id = s.broadcaster_id
      ${where}
      ORDER BY s.is_live DESC, s.viewers DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('[streams/list]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Dettaglio stream
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.title, s.category, s.is_live, s.viewers, u.username AS broadcaster, u.avatar_url
      FROM streams s
      JOIN users u ON u.id = s.broadcaster_id
      WHERE s.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Stream non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[streams/detail]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Crea nuovo stream
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });

    const result = await pool.query(`
      INSERT INTO streams (broadcaster_id, title, category, is_live)
      VALUES ($1, $2, $3, FALSE) RETURNING id, title, category
    `, [req.user.id, title, category || null]);

    res.status(201).json({ ...result.rows[0], broadcaster: req.user.username });
  } catch (err) {
    console.error('[streams/create]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Termina stream
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT broadcaster_id FROM streams WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Stream non trovato' });
    if (result.rows[0].broadcaster_id !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    await pool.query('UPDATE streams SET is_live = FALSE, viewers = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[streams/end]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Genera token LiveKit per broadcaster (può pubblicare video)
router.post('/:id/broadcaster-token', authMiddleware, async (req, res) => {
  try {
    const streamResult = await pool.query('SELECT * FROM streams WHERE id = $1', [req.params.id]);
    const stream = streamResult.rows[0];

    if (!stream) return res.status(404).json({ error: 'Stream non trovato' });
    if (stream.broadcaster_id !== req.user.id) {
      return res.status(403).json({ error: 'Non sei il broadcaster di questo stream' });
    }

    const token = await createLiveKitToken({
      roomName: `stream_${stream.id}`,
      participantName: req.user.username,
      canPublish: true
    });

    // Segna lo stream come live
    await pool.query('UPDATE streams SET is_live = TRUE WHERE id = $1', [stream.id]);

    res.json({
      token,
      livekitUrl: process.env.LIVEKIT_URL,
      roomName: `stream_${stream.id}`
    });
  } catch (err) {
    console.error('[streams/broadcaster-token]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Genera token LiveKit per viewer (solo visualizzazione)
router.post('/:id/viewer-token', authMiddleware, async (req, res) => {
  try {
    const streamResult = await pool.query('SELECT id, is_live FROM streams WHERE id = $1', [req.params.id]);
    const stream = streamResult.rows[0];

    if (!stream) return res.status(404).json({ error: 'Stream non trovato' });

    const token = await createLiveKitToken({
      roomName: `stream_${stream.id}`,
      participantName: req.user.username,
      canPublish: false
    });

    res.json({
      token,
      livekitUrl: process.env.LIVEKIT_URL,
      roomName: `stream_${stream.id}`
    });
  } catch (err) {
    console.error('[streams/viewer-token]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Messaggi chat
router.get('/:id/messages', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.message, m.created_at, m.is_tip, m.tip_amount, u.username
      FROM chat_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.stream_id = $1
      ORDER BY m.created_at ASC LIMIT 100
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[streams/messages]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

module.exports = router;
