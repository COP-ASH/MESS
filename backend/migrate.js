const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { db, pool } = require('./src/db/index');

async function runMigrations() {
  console.log('>>> [DB MIGRATION - START] Running Drizzle migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('>>> [DB MIGRATION - SUCCESS] Migrations completed successfully.');
  } catch (error) {
    console.error('>>> [DB MIGRATION - ERROR] Migrations failed:', error);
    process.exit(1);
  } finally {
    // End pool connection after migrations complete
    await pool.end();
  }
}

runMigrations();
