require('dotenv').config();
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const app = require('./src/app');
const config = require('./src/config');
const { db, pool, seedDatabase } = require('./src/db/index');

async function startServer() {
  console.log('>>> [SERVER START] Initializing multi-district mess management system...');

  try {
    // 1. Run Drizzle DB Migrations
    console.log('>>> [DATABASE] Running pending Drizzle schema migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('>>> [DATABASE] Migrations executed successfully.');
    await seedDatabase();

    // 2. Start Express Server listener
    app.listen(config.PORT, () => {
      console.log(`>>> [SERVER ONLINE] Listening on port: ${config.PORT}`);
      console.log(`>>> [SERVER ENVIRONMENT] Active mode: ${config.NODE_ENV}`);
      console.log(`>>> [SERVER URL] Local API URL: http://localhost:${config.PORT}`);
    });
  } catch (error) {
    console.error('>>> [CRITICAL STARTUP ERROR] Failed to start backend server:', error);
    process.exit(1);
  }
}

// Handle termination signals cleanly
process.on('SIGTERM', async () => {
  console.log('>>> [SERVER SHUTDOWN] SIGTERM signal received. Terminating database pool connections...');
  try {
    await pool.end();
    console.log('>>> [SERVER SHUTDOWN] DB pool ended. Exiting process.');
    process.exit(0);
  } catch (error) {
    console.error('>>> [SERVER SHUTDOWN ERROR] Failed to close database pool during exit:', error);
    process.exit(1);
  }
});

startServer();
