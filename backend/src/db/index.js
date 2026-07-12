require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const bcrypt = require('bcryptjs');
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
    // 0. Ensure cutoff columns exist in districts table and morning/evening columns in nil_diet_requests
    console.log('>>> [DB SEED] Ensuring cutoff columns exist in districts and nil_diet_requests...');
    await db.execute(require('drizzle-orm').sql`
      ALTER TABLE districts 
      ADD COLUMN IF NOT EXISTS morning_cutoff VARCHAR(5) DEFAULT '20:00',
      ADD COLUMN IF NOT EXISTS evening_cutoff VARCHAR(5) DEFAULT '12:00';
    `);
    await db.execute(require('drizzle-orm').sql`
      ALTER TABLE nil_diet_requests
      ADD COLUMN IF NOT EXISTS morning_diet BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS evening_diet BOOLEAN DEFAULT true NOT NULL;
    `);

    // 1. Seed Settings if empty
    const settingsList = await db.select().from(schema.settings);
    if (settingsList.length === 0) {
      console.log('>>> [DB SEED] Seeding default system settings...');
      await db.insert(schema.settings).values([
        { key: 'website_name', value: 'Uttar Pradesh Police Mess Management', category: 'website' },
        { key: 'otp_expiry_minutes', value: '10', category: 'otp' },
        { key: 'email_sender', value: 'Mess Manager <otp@copash.shop>', category: 'email' },
        { key: 'allowed_emails', value: process.env.ALLOWED_EMAILS || 'vicky.nick1991@gmail.com,vicky.nick1992@gmail.com', category: 'general' }
      ]);
      console.log('>>> [DB SEED] Default settings seeded successfully.');
    }

    // 2. Seed Super Admin if none exists
    const superAdmin = await db.select().from(schema.users).where(
      require('drizzle-orm').eq(schema.users.role, 'super_admin')
    ).limit(1);

    if (superAdmin.length === 0) {
      console.log('>>> [DB SEED] No Super Admin found. Seeding default Super Admin...');
      const hashedPassword = bcrypt.hashSync('Admin@123', 10);
      await db.insert(schema.users).values({
        fullName: 'Super Admin',
        email: 'superadmin@copash.shop',
        passwordHash: hashedPassword,
        role: 'super_admin',
        isVerified: true,
        isActive: true,
        districtId: null
      });
      console.log('>>> [DB SEED] Default Super Admin seeded. Email: superadmin@copash.shop | Password: Admin@123');
    }
  } catch (err) {
    console.error('>>> [DB SEED ERROR] Failed to seed database:', err);
  }
}

// Export database resources and the explicit seeding trigger
module.exports = {
  db,
  pool,
  seedDatabase
};
