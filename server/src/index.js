import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

try {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`\n  Acervo API — http://localhost:${PORT}`);
    console.log(`  Health:      http://localhost:${PORT}/api/health`);
    console.log(`  PostgreSQL:  ${process.env.DATABASE_URL ? 'configurado' : 'postgresql://acervo:***@localhost:5432/acervo'}`);
    console.log(`  Modo:        ${process.env.NODE_ENV || 'development'}\n`);
  });
} catch (err) {
  console.error('\n  No se pudo iniciar el servidor:', err.message);
  console.error('  Asegúrate de que PostgreSQL esté corriendo (npm run db:up)\n');
  process.exit(1);
}
