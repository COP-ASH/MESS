const LogRepository = require('../repositories/logRepository');

const logAction = async (userId, action, details) => {
  console.log(`>>> [AUDIT LOG] User: ${userId || 'SYSTEM'} | Action: ${action} | Details: ${details || 'None'}`);
  return LogRepository.createLog(userId, action, details);
};

module.exports = {
  logAction,
};
