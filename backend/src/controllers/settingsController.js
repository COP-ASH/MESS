const { eq } = require('drizzle-orm');
const { db } = require('../db');
const { settings } = require('../db/schema');
const { logAction } = require('../services/logService');
const { sendSuccess } = require('../utils/response');

const getSettings = async (req, res, next) => {
  try {
    const list = await db.select().from(settings);
    // Convert to a clean key-value object
    const configMap = {};
    list.forEach((item) => {
      configMap[item.key] = item.value;
    });
    return sendSuccess(res, { list, configMap }, 'Settings list retrieved.');
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const updateObj = req.body; // Expects format: { key: value, ... }
    const keys = Object.keys(updateObj);

    for (const key of keys) {
      await db.update(settings)
        .set({ value: updateObj[key].toString(), updatedAt: new Date() })
        .where(eq(settings.key, key));
    }

    await logAction(req.user.id, 'SETTINGS_UPDATE', `Updated settings: ${keys.join(', ')}`);
    
    // Return the updated settings map
    const list = await db.select().from(settings);
    const configMap = {};
    list.forEach((item) => {
      configMap[item.key] = item.value;
    });

    return sendSuccess(res, { list, configMap }, 'Settings updated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
