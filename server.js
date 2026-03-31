const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const { initDB, getDB } = require('./db');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ===== AUTH =====

// Signup
app.post('/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

  const db   = getDB();
  const hash = await bcrypt.hash(password, 10);

  try {
    const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    const info = stmt.run(name, email, hash);
    res.json({ id: info.lastInsertRowid, name, email });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });

  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ id: user.id, name: user.name, email: user.email });
});

// ===== VOTES =====

// Get all vote counts
app.get('/votes', (req, res) => {
  const db   = getDB();
  const rows = db.prepare(
    'SELECT creator_id, category, COUNT(*) as count FROM votes GROUP BY creator_id'
  ).all();
  res.json(rows);
});

// Cast a vote
app.post('/votes', (req, res) => {
  const { user_id, creator_id, category } = req.body;
  if (!user_id || !creator_id || !category) return res.status(400).json({ error: 'Missing fields' });

  const db = getDB();

  // One vote per category per user
  const existing = db.prepare(
    'SELECT id FROM votes WHERE user_id = ? AND category = ?'
  ).get(user_id, category);

  if (existing) return res.status(409).json({ error: 'Already voted in this category' });

  db.prepare('INSERT INTO votes (user_id, creator_id, category) VALUES (?, ?, ?)').run(user_id, creator_id, category);
  res.json({ success: true });
});

// ===== START =====
initDB();
app.listen(PORT, () => console.log(`NexVote server running at http://localhost:${PORT}`));
