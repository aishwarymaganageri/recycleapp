const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./models/User');
const Recycling = require('./models/Recycling');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in environment variables.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected (backend-new)'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true, service: 'recycle-backend-new' });
});

app.post('/api/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.json({ success: false, message: 'All fields required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.json({ success: false, message: 'Email already exists' });

    const password_hash = await bcrypt.hash(password, 10);
    await User.create({ name, email, password_hash });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Registration error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.json({ success: false, message: 'Wrong password' });

    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '2d' });
    return res.json({ success: true, token, name: user.name });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login error' });
  }
});

app.post('/api/add-waste', auth, async (req, res) => {
  try {
    const item = String(req.body.item || '').trim();
    if (!item) return res.json({ success: false, message: 'Item is required' });

    const recyclableItems = ['plastic', 'glass', 'metal', 'paper', 'cardboard', 'can', 'aluminum', 'tin', 'carton', 'box', 'newspaper'];
    const isRecyclable = recyclableItems.some((kw) => item.toLowerCase().includes(kw));
    const points = isRecyclable ? 10 : 0;

    await Recycling.create({ user: req.user.id, item, points });
    if (isRecyclable) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { total_points: points } });
    }

    return res.json({ success: true, isRecyclable, points });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'DB error' });
  }
});

app.get('/api/points', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.json({ success: false, message: 'User not found' });
    return res.json({ success: true, points: user.total_points });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Points fetch error' });
  }
});

app.get('/api/history', auth, async (req, res) => {
  try {
    const history = await Recycling.find({ user: req.user.id }).sort({ date: -1 }).select('item points date -_id');
    return res.json({ success: true, history });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'History fetch error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend-new running on port ${PORT}`);
});
