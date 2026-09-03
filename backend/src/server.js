// dotenv must load before anything else is required — utils/s3.js reads
// process.env at module-load time (to build the S3 client and bucket name),
// so requiring it before dotenv.config() runs leaves those values undefined
// for the lifetime of the process, no matter what .env contains.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { connectDB } = require('./db');
const { verifyS3Config } = require('./utils/s3');
const { requireAuth } = require('./middleware/auth');
const documentsRouter = require('./routes/documents');
const usersRouter = require('./routes/users');
const rolesRouter = require('./routes/roles');
const auditLogsRouter = require('./routes/auditLogs');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');
const signingRouter = require('./routes/signing');
const integrationsRouter = require('./routes/integrations');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

// Behind a reverse proxy/load balancer, req.ip otherwise resolves to the
// proxy's own address rather than the real client IP recorded on audit logs.
app.set('trust proxy', 1);

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
verifyS3Config();

// ==================== ROUTES ====================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// /api/auth mounts its own auth (login is public, /me requires a token)
app.use('/api/auth', authRouter);

// /api/signing is public and token-gated (magic-link recipient signing) —
// recipients never hold an admin JWT, so this must sit outside requireAuth.
app.use('/api', signingRouter);

// Every other /api route requires a valid session
app.use('/api', requireAuth, documentsRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/roles', requireAuth, rolesRouter);
app.use('/api/audit-logs', requireAuth, auditLogsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/integrations', requireAuth, integrationsRouter);
app.use('/api/settings', requireAuth, settingsRouter);

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
