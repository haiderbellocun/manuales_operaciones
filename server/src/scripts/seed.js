import { migrate } from '../db/migrate.js';
import { seedDatabase } from '../db/seedData.js';
import { pool } from '../db/pool.js';

async function main() {
  const force = process.argv.includes('--force');
  console.log('Migrando esquema PostgreSQL...');
  await migrate();
  console.log('Sembrando datos...');
  const result = await seedDatabase({ force });
  if (result.seeded) {
    console.log(`Listo: ${result.documents} documentos cargados.`);
  } else {
    console.log('La base ya tiene datos. Usa --force para reiniciar.');
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
