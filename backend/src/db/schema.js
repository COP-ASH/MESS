const { pgTable, serial, text, timestamp, integer, boolean, numeric, date } = require('drizzle-orm/pg-core');

// 1. Roles table
const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // 'admin', 'police_personnel'
});

// 2. Police Users table
const policeUsers = pgTable('police_users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  pno: text('pno').unique().notNull(), // Police personal number
  rank: text('rank').notNull(), // Constable, Sub-Inspector, Inspector, etc.
  postingUnit: text('posting_unit').notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'active', 'deactivated'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Mess Menu table
const messMenu = pgTable('mess_menu', {
  id: serial('id').primaryKey(),
  dayOfWeek: text('day_of_week').notNull(), // 'Monday', 'Tuesday', etc.
  breakfast: text('breakfast').notNull(),
  lunch: text('lunch').notNull(),
  dinner: text('dinner').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Meal Attendance table
const mealAttendance = pgTable('meal_attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => policeUsers.id).notNull(),
  date: date('date').notNull(),
  breakfast: boolean('breakfast').default(false).notNull(),
  lunch: boolean('lunch').default(false).notNull(),
  dinner: boolean('dinner').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Monthly Bills table
const monthlyBills = pgTable('monthly_bills', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => policeUsers.id).notNull(),
  month: integer('month').notNull(), // 1 - 12
  year: integer('year').notNull(),
  totalMeals: integer('total_meals').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('unpaid').notNull(), // 'paid', 'unpaid'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Payments table
const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id').references(() => monthlyBills.id).notNull(),
  userId: integer('user_id').references(() => policeUsers.id).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMode: text('payment_mode').notNull(), // 'Cash', 'Online'
  transactionId: text('transaction_id'),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
});

// 7. Notices table
const notices = pgTable('notices', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  postedBy: integer('posted_by').references(() => policeUsers.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Audit Logs table
const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => policeUsers.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = {
  roles,
  policeUsers,
  messMenu,
  mealAttendance,
  monthlyBills,
  payments,
  notices,
  auditLogs
};
