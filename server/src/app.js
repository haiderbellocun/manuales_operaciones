import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import './config/env.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import workflowRoutes from './routes/workflow.js';
import catalogRoutes from './routes/catalog.js';
import notificationRoutes from './routes/notifications.js';
import moduleRoutes from './routes/modules.js';
import { migrate } from './db/migrate.js';
import { checkConnection } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', '..', 'dist');

export async function createApp() {
  await migrate();

  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = new Set(corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean));

  app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: false,
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origen no permitido por CORS.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ message: 'Origen no permitido para esta operacion.' });
    }
    return next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const db = await checkConnection();
      res.json({
        status: 'ok',
        service: 'acervo-api',
        database: 'postgresql',
        dbTime: db.now,
        time: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'error',
        service: 'acervo-api',
        database: 'disconnected',
        message: err.message,
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/workflow', workflowRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api', moduleRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Ruta API no encontrada.' });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.statusCode || 500;
    const message = status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor.'
      : (err.message || 'Error interno del servidor.');
    res.status(status).json({ message });
  });

  return app;
}
