import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import workflowRoutes from './routes/workflow.js';
import catalogRoutes from './routes/catalog.js';
import { ensureUploadsDir } from './store/database.js';
import { migrate } from './db/migrate.js';
import { seedIfEmpty } from './db/seedData.js';
import { checkConnection } from './db/pool.js';

export async function createApp() {
  await migrate();
  const seedResult = await seedIfEmpty();
  if (seedResult.seeded) {
    console.log(`  PostgreSQL: seed aplicado (${seedResult.documents} documentos)`);
  }
  ensureUploadsDir();

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
  app.use('/api', catalogRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Error interno del servidor.' });
  });

  return app;
}
