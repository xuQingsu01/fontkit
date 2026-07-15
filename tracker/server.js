require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const app         = express();
const PORT        = process.env.PORT        || 37891;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const MONGO_URI   = process.env.MONGO_URI   || 'mongodb://localhost:27017/fontkit_tracker';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://fontkit.qingsu.link';

// ── 中间件 ────────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: [CORS_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080'],
  methods: ['GET', 'POST'],
}));

// ── MongoDB Schema ────────────────────────────────────────────────────────────
const eventSchema = new mongoose.Schema({
  event:     { type: String, required: true, index: true },
  source:    { type: String, default: null },
  channel:   { type: String, default: null },
  device:    { type: String, default: null },
  ua:        { type: String, default: null },
  createdAt: { type: Date,   default: Date.now, index: true },
});

const Event = mongoose.model('Event', eventSchema);

// ── 连接 MongoDB ──────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log(`[fontkit-tracker] MongoDB connected → ${MONGO_URI}`))
  .catch(err => {
    console.error('[fontkit-tracker] MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── 鉴权中间件 ────────────────────────────────────────────────────────────────
function requireToken(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).send('401 Unauthorized');
  }
  next();
}

// ── POST /api/track ───────────────────────────────────────────────────────────
// 接收埋点事件，写入 MongoDB
// Body: { event, source?, channel? }
// event 枚举: modal_open | channel_click | modal_close
app.post('/api/track', async (req, res) => {
  try {
    const { event, source, channel } = req.body;

    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'event field is required' });
    }

    const ua       = (req.headers['user-agent'] || '').slice(0, 300);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

    await Event.create({
      event:   event.slice(0, 50),
      source:  source  ? String(source).slice(0, 50)  : null,
      channel: channel ? String(channel).slice(0, 50) : null,
      device:  isMobile ? 'mobile' : 'desktop',
      ua,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[track]', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
// 返回聚合统计数据（需要 Token）
app.get('/api/stats', requireToken, async (req, res) => {
  try {
    // 时间范围（默认全部）
    const days  = parseInt(req.query.days) || 0;
    const match = days > 0
      ? { createdAt: { $gte: new Date(Date.now() - days * 86400000) } }
      : {};

    const [modalOpen, channelClick, modalClose] = await Promise.all([
      Event.countDocuments({ ...match, event: 'modal_open' }),
      Event.countDocuments({ ...match, event: 'channel_click' }),
      Event.countDocuments({ ...match, event: 'modal_close' }),
    ]);

    const [channelAgg, sourceAgg, deviceAgg, recent] = await Promise.all([
      Event.aggregate([
        { $match: { ...match, event: 'channel_click', channel: { $ne: null } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      Event.aggregate([
        { $match: { ...match, event: 'modal_open', source: { $ne: null } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Event.aggregate([
        { $match: match },
        { $group: { _id: '$device', count: { $sum: 1 } } },
      ]),
      Event.find(match).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    const toMap = arr => arr.reduce((m, o) => { m[o._id] = o.count; return m; }, {});

    res.json({
      total: {
        modal_open:    modalOpen,
        channel_click: channelClick,
        modal_close:   modalClose,
      },
      channels: toMap(channelAgg),
      sources:  toMap(sourceAgg),
      devices:  toMap(deviceAgg),
      recent,
    });
  } catch (err) {
    console.error('[stats]', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

// ── GET /admin ────────────────────────────────────────────────────────────────
// 管理后台页面（需要 Token）
app.get('/admin', requireToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ── 启动 ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[fontkit-tracker] Server running → http://localhost:${PORT}`);
  console.log(`[fontkit-tracker] Admin dashboard → http://localhost:${PORT}/admin?token=***`);
});
