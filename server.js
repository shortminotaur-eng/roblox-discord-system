// server.js
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(path.join(__dirname, 'data.db'));
db.prepare(`CREATE TABLE IF NOT EXISTS links (token TEXT PRIMARY KEY, discord TEXT, roblox TEXT, created_at INTEGER)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS balances (discord TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)`).run();

// env vars (set these when deploying)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change_this_secret';
const SERVER_URL = process.env.SERVER_URL || 'https://example.com';

// helper to verify a simple signature header
function verifySecretHeader(secretHeader) {
  try {
    return secretHeader === WEBHOOK_SECRET;
  } catch (e) {
    return false;
  }
}

// Register from frontend: create a token linking discord -> roblox
app.post('/api/register', (req, res) => {
  const { discord, roblox } = req.body || {};
  if (!discord || !roblox) return res.status(400).json({ error: 'missing discord or roblox' });
  const token = crypto.randomBytes(12).toString('hex');
  db.prepare('INSERT INTO links(token, discord, roblox, created_at) VALUES(?,?,?,?)').run(token, discord, roblox, Date.now());
  res.json({ token, link: `${SERVER_URL}/?token=${token}` });
});

// Webhook from Roblox server when a purchase is confirmed
app.post('/webhook/purchase', (req, res) => {
  const signature = req.headers['x-signature'] || '';
  if (!verifySecretHeader(signature)) return res.status(403).json({ error: 'invalid signature' });

  const { token, robloxUserId, gamepassId, priceRobux, creditedAmount } = req.body || {};
  if (!token) return res.status(400).json({ error: 'missing token' });

  const link = db.prepare('SELECT discord, roblox FROM links WHERE token = ?').get(token);
  if (!link) return res.status(400).json({ error: 'token not found' });

  const discord = link.discord;
  const credit = Number(creditedAmount ?? priceRobux ?? 0);
  if (isNaN(credit)) return res.status(400).json({ error: 'invalid amount' });

  const cur = db.prepare('SELECT balance FROM balances WHERE discord = ?').get(discord);
  if (cur) {
    db.prepare('UPDATE balances SET balance = balance + ? WHERE discord = ?').run(credit, discord);
  } else {
    db.prepare('INSERT INTO balances(discord, balance) VALUES(?,?)').run(discord, credit);
  }

  return res.json({ ok: true, discord, credited: credit });
});

// Bot (or anyone) can get a user's balance
app.get('/api/balance/:discord', (req, res) => {
  const d = req.params.discord;
  const row = db.prepare('SELECT balance FROM balances WHERE discord = ?').get(d);
  res.json({ discord: d, balance: row ? row.balance : 0 });
});

// quick homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port));
