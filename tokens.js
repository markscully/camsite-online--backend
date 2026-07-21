const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Pacchetti token — commissione 0% per i creator
const TOKEN_PACKAGES = [
  { id: 'pkg_100', tokens: 100, price_eur: 4.99 },
  { id: 'pkg_250', tokens: 250, price_eur: 9.99 },
  { id: 'pkg_600', tokens: 600, price_eur: 19.99 },
  { id: 'pkg_1500', tokens: 1500, price_eur: 44.99 }
];

const TOKEN_TO_EUR = 0.03; // 1 token = €0.03
const MIN_PAYOUT = 500;    // minimo 500 token per richiedere payout

router.get('/packages', (req, res) => {
  res.json(TOKEN_PACKAGES);
});

router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    res.json({ balance: result.rows[0].token_balance });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' });
  }
});

router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.type, t.amount, t.description, t.created_at,
             u.username AS related_username
      FROM token_transactions t
      LEFT JOIN users u ON u.id = t.related_user_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC LIMIT 100
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Acquisto simulato (da sostituire con Stripe in produzione)
router.post('/purchase-mock', authMiddleware, async (req, res) => {
  const { packageId } = req.body;
  const pkg = TOKEN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return res.status(400).json({ error: 'Pacchetto non valido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET token_balance = token_balance + $1 WHERE id = $2', [pkg.tokens, req.user.id]);
    await client.query(
      `INSERT INTO token_transactions (user_id, type, amount, description) VALUES ($1, 'purchase', $2, $3)`,
      [req.user.id, pkg.tokens, `Acquisto ${pkg.tokens} token (simulato)`]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, balance: updated.rows[0].token_balance, added: pkg.tokens });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Errore interno' });
  } finally {
    client.release();
  }
});

// Info payout
router.get('/payout-info', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    res.json({
      balance: result.rows[0].token_balance,
      rate: TOKEN_TO_EUR,
      minTokens: MIN_PAYOUT,
      minEur: (MIN_PAYOUT * TOKEN_TO_EUR).toFixed(2),
      commission: '0%',
      note: 'Nessuna commissione — ricevi il 100% del valore dei token.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' });
  }
});

// Richiesta payout
router.post('/payout', authMiddleware, async (req, res) => {
  const { tokens, payoutMethod, payoutDetails } = req.body;
  const tokensRequested = Number(tokens);

  if (!Number.isInteger(tokensRequested) || tokensRequested < MIN_PAYOUT) {
    return res.status(400).json({ error: `Minimo ${MIN_PAYOUT} token per il payout` });
  }
  if (!payoutMethod || !payoutDetails) {
    return res.status(400).json({ error: 'Metodo e dati di pagamento obbligatori' });
  }

  const client = await pool.connect();
  try {
    const userResult = await client.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows[0].token_balance < tokensRequested) {
      return res.status(400).json({ error: 'Saldo insufficiente' });
    }

    const amountEur = (tokensRequested * TOKEN_TO_EUR).toFixed(2);

    await client.query('BEGIN');
    await client.query('UPDATE users SET token_balance = token_balance - $1 WHERE id = $2', [tokensRequested, req.user.id]);
    await client.query(
      `INSERT INTO token_transactions (user_id, type, amount, description) VALUES ($1, 'payout_requested', $2, $3)`,
      [req.user.id, -tokensRequested, `Richiesta payout ${tokensRequested} token (€${amountEur})`]
    );
    const payoutResult = await client.query(
      `INSERT INTO payout_requests (user_id, tokens_requested, amount_eur, payout_method, payout_details)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, tokensRequested, amountEur, payoutMethod, payoutDetails]
    );
    await client.query('COMMIT');

    const updated = await pool.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    res.status(201).json({ id: payoutResult.rows[0].id, amount_eur: amountEur, newBalance: updated.rows[0].token_balance });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Errore interno' });
  } finally {
    client.release();
  }
});

module.exports = router;
