import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import workflowRoutes from './routes/workflow.js';
import catalogRoutes from './routes/catalog.js';
import notificationRoutes from './routes/notifications.js';
import { migrate } from './db/migrate.js';
import { seedIfEmpty } from './db/seedData.js';
import { checkConnection } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', '..', 'dist');

export async function createApp() {
  await migrate();
  const seedResult = await seedIfEmpty();
  if (seedResult.seeded) {
    console.log(`  PostgreSQL: seed aplicado (${seedResult.documents} documentos)`);
  }

  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

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
    res.status(err.statusCode || 500).json({ message: err.message || 'Error interno del servidor.' });
  });

  return app;
}
