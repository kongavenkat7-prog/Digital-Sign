const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { connectDB } = require('./db');
const { requireAuth } = require('./middleware/auth');
const documentsRouter = require('./routes/documents');
const usersRouter = require('./routes/users');
const rolesRouter = require('./routes/roles');
const auditLogsRouter = require('./routes/auditLogs');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

connectDB();

// ==================== ROUTES ====================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// /api/auth mounts its own auth (login is public, /me requires a token)
app.use('/api/auth', authRouter);

// Every other /api route requires a valid session
app.use('/api', requireAuth, documentsRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/roles', requireAuth, rolesRouter);
app.use('/api/audit-logs', requireAuth, auditLogsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🔐 SignVault Backend Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
