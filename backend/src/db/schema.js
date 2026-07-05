const { pgTable, serial, text, timestamp } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  pno: text('pno').unique().notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = {
  users
};
