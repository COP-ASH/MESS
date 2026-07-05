require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');

// Establish Pg connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

// Auto-seed database tables on startup
async function seedDatabase() {
  try {
    const rolesList = await db.select().from(schema.roles);
    if (rolesList.length === 0) {
      console.log('>>> [DB SEED] Seeding default roles...');
      await db.insert(schema.roles).values([
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Police Personnel' }
      ]);
      console.log('>>> [DB SEED] Default roles seeded successfully.');
    }
  } catch (err) {
    console.error('>>> [DB SEED ERROR] Failed to seed database:', err);
  }
}

// Trigger database seeding asynchronously
seedDatabase();

module.exports = {
  db,
  pool
};
