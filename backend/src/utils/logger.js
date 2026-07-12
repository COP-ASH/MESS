const { db } = require('../db/index');
const { activityLogs } = require('../db/schema');

/**
 * Police-grade audit logger. Saves audit trails to database and outputs to console.
 */
async function logAudit(userId, action, details) {
  const timestamp = new Date().toISOString();
  console.log(`>>> [AUDIT TRAIL] [${timestamp}] User #${userId || 'System'} | Action: ${action} | Details: ${details || 'N/A'}`);
  
  try {
    await db.insert(activityLogs).values({
      userId: userId || null,
      action,
      details: details || null
    });
  } catch (err) {
    console.error('>>> [AUDIT LOGGING FAILURE]', err);
  }
}

module.exports = {
  logAudit
};
