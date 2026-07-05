const { db } = require('../db/index');
const { messMenu } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

// Initial default menu to auto-seed
const defaultMenu = [
  { dayOfWeek: 'Monday', breakfast: 'Aloo Paratha, Curd & Tea', lunch: 'Dal Tadka, Mix Veg, Roti, Rice & Salad', dinner: 'Kadhai Paneer, Roti, Rice & Salad' },
  { dayOfWeek: 'Tuesday', breakfast: 'Poha, Sprouts & Tea', lunch: 'Rajma, Jeera Rice, Roti & Curd', dinner: 'Aloo Gobhi Sabzi, Roti & Salad' },
  { dayOfWeek: 'Wednesday', breakfast: 'Bread Butter, Omelette & Tea', lunch: 'Choley, Rice, Poori & Raita', dinner: 'Egg Curry (or Veg Kadhai), Roti & Rice' },
  { dayOfWeek: 'Thursday', breakfast: 'Dalia, Boiled Egg & Tea', lunch: 'Kadhi Pakoda, Chawal, Roti & Salad', dinner: 'Khichdi, Papad, Pickle & Curd' },
  { dayOfWeek: 'Friday', breakfast: 'Suhr / Idli Sambhar & Tea', lunch: 'Chana Masala, Jeera Alloo, Roti & Rice', dinner: 'Seasonal Veg Sabzi, Roti & Salad' },
  { dayOfWeek: 'Saturday', breakfast: 'Bread Jam, Milk & Tea', lunch: 'Aloo Gobhi, Paratha, Curd & Pickle', dinner: 'Dal Makhani, Roti, Jeera Rice & Salad' },
  { dayOfWeek: 'Sunday', breakfast: 'Special Poori Sabzi, Jalebi & Tea', lunch: 'Shahi Paneer, Pulao, Butter Naan & Gulab Jamun', dinner: 'Aloo Soyabean Curry, Roti & Rice' }
];

/**
 * Fetch the entire weekly menu. Auto-seeds default menu if empty.
 */
async function getMenu(req, res, next) {
  try {
    let menuList = await db.select().from(messMenu);
    
    // Auto-seed if empty
    if (menuList.length === 0) {
      console.log('>>> [DB SEED] Seeding default mess menu...');
      await db.insert(messMenu).values(defaultMenu);
      menuList = await db.select().from(messMenu);
      console.log('>>> [DB SEED] Mess menu seeded successfully.');
    }

    return res.status(200).json(menuList);
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] menuController.getMenu failed:', error);
    next(error);
  }
}

/**
 * Update the menu for a specific day (Admin only)
 */
async function updateMenu(req, res, next) {
  console.log('>>> [CONTROLLER ENTRY] menuController.updateMenu - Params:', req.body);
  const { id, breakfast, lunch, dinner } = req.body;
  const adminId = req.user.id;

  try {
    if (!id || !breakfast || !lunch || !dinner) {
      return res.status(400).json({ error: 'Day ID, Breakfast, Lunch, and Dinner are required.' });
    }

    const [updated] = await db.update(messMenu)
      .set({
        breakfast: breakfast.trim(),
        lunch: lunch.trim(),
        dinner: dinner.trim(),
        updatedAt: new Date()
      })
      .where(eq(messMenu.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Menu day record not found.' });
    }

    await logAudit(adminId, 'UPDATE_MENU', `Updated menu for ID #${id} (${updated.dayOfWeek})`);

    return res.status(200).json({ message: `Menu for ${updated.dayOfWeek} updated successfully!`, menu: updated });
  } catch (error) {
    console.error('>>> [CONTROLLER ERROR] menuController.updateMenu failed:', error);
    next(error);
  }
}

module.exports = {
  getMenu,
  updateMenu
};
