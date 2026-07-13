const { pgTable, serial, text, timestamp, integer, boolean, numeric, date } = require('drizzle-orm/pg-core');

// 1. Districts table
const districts = pgTable('districts', {
  id: serial('id').primaryKey(),
  districtName: text('district_name').unique().notNull(),
  districtCode: text('district_code').unique().notNull(),
  adminId: integer('admin_id'), // Set after creating district admin (circular reference handled lazily)
  status: text('status').default('active').notNull(), // 'active', 'inactive'
  morningCutoff: text('morning_cutoff').default('20:00').notNull(),
  eveningCutoff: text('evening_cutoff').default('12:00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Users table (Unified for Super Admin, District Admin, and Simple User)
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // 'super_admin', 'district_admin', 'user'
  districtId: integer('district_id').references(() => districts.id), // Nullable for Super Admin
  isVerified: boolean('is_verified').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Circular reference resolved by removing database-level adminId foreign key, validated in service layer instead.

// 3. OTP Verifications table
const otpVerifications = pgTable('otp_verifications', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Sessions table for JWT Refresh Tokens
const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Activity/Audit Logs table
const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Reports table
const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'district', 'user', 'registration', 'login', etc.
  data: text('data'), // JSON string containing metrics/analytics
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. System Settings table
const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  category: text('category').default('general').notNull(), // 'website', 'otp', 'email', 'general'
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Mess Menu table (District scoped)
const messMenu = pgTable('mess_menu', {
  id: serial('id').primaryKey(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  dayOfWeek: text('day_of_week').notNull(), // 'Monday', 'Tuesday', etc.
  morningNormal: text('morning_normal').notNull(),
  morningHalfSpecial: text('morning_half_special').notNull(),
  morningFullSpecial: text('morning_full_special').notNull(),
  eveningNormal: text('evening_normal').notNull(),
  eveningHalfSpecial: text('evening_half_special').notNull(),
  eveningFullSpecial: text('evening_full_special').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Meal Attendance table (District scoped)
const mealAttendance = pgTable('meal_attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  date: date('date').notNull(),
  morningNormal: boolean('morning_normal').default(false).notNull(),
  morningHalfSpecial: boolean('morning_half_special').default(false).notNull(),
  morningFullSpecial: boolean('morning_full_special').default(false).notNull(),
  eveningNormal: boolean('evening_normal').default(false).notNull(),
  eveningHalfSpecial: boolean('evening_half_special').default(false).notNull(),
  eveningFullSpecial: boolean('evening_full_special').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Monthly Bills table (District scoped)
const monthlyBills = pgTable('monthly_bills', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  month: integer('month').notNull(), // 1 - 12
  year: integer('year').notNull(),
  totalMeals: integer('total_meals').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('unpaid').notNull(), // 'paid', 'unpaid'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Payments table (District scoped)
const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id').references(() => monthlyBills.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMode: text('payment_mode').notNull(), // 'Cash', 'Online'
  transactionId: text('transaction_id'),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
});

// 12. Notices table (District scoped)
const notices = pgTable('notices', {
  id: serial('id').primaryKey(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  postedBy: integer('posted_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Nil Diet Requests table (District scoped)
const nilDietRequests = pgTable('nil_diet_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  districtId: integer('district_id').references(() => districts.id).notNull(),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date').notNull(),
  morningDiet: boolean('morning_diet').default(true).notNull(),
  eveningDiet: boolean('evening_diet').default(true).notNull(),
  fromMorning: boolean('from_morning').default(true).notNull(),
  fromEvening: boolean('from_evening').default(true).notNull(),
  toMorning: boolean('to_morning').default(true).notNull(),
  toEvening: boolean('to_evening').default(true).notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = {
  districts,
  users,
  otpVerifications,
  sessions,
  activityLogs,
  reports,
  settings,
  messMenu,
  mealAttendance,
  monthlyBills,
  payments,
  notices,
  nilDietRequests
};
