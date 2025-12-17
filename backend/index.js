// ============================================================================
// EYES PERFUME BACKEND — Modular Structure
// ============================================================================

import express from 'express';
import cors from 'cors';
import passport from 'passport';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import configuration
import connectDatabase from './src/config/database.js';
import corsOptions from './src/config/cors.js';

// Import middleware
import { requestLogger } from './src/middleware/logging.js';

// Import routes
import routes from './src/routes/index.js';

// Import admin setup
import { setupAdminJS } from './src/admin/setup.js';

// -------------------- APP CONFIG --------------------
const app = express();
const PORT = process.env.PORT || 4000;

// -------------------- CORS (before everything) --------------------
app.use(cors(corsOptions));
app.options('*', cors());

// -------------------- DATABASE --------------------
await connectDatabase();

// -------------------- ADMIN JS (before body parser!) --------------------
// AdminJS requires its router to be set up BEFORE express.json() middleware
const admin = setupAdminJS(app);

// -------------------- BODY PARSER (after AdminJS) --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(requestLogger);

// -------------------- ROUTES --------------------
app.get('/', (_req, res) => res.send('🚀 EYES Perfume Backend Running!'));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: 'connected',
  });
});

// Mount all API routes
app.use('/api', routes);

// -------------------- 404 HANDLER --------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👨‍💻 AdminJS: http://localhost:${PORT}${admin.options.rootPath}`);
  console.log(`📁 Modular structure loaded successfully ✅`);
});
