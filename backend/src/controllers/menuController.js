const { db } = require('../db/index');
const { messMenu } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { logAudit } = require('../utils/logger');

// Initial default menu to auto-seed
const defaultMenu = [
  { dayOfWeek: 'Monday', morningNormal: 'Aloo Paratha & Tea', morningHalfSpecial: 'Dal Tadka, Roti & Rice', morningFullSpecial: 'Kadhai Paneer & Salad', eveningNormal: 'Aloo Gobhi Sabzi & Roti', eveningHalfSpecial: 'Mix Veg, Roti & Rice', eveningFullSpecial: 'Paneer Butter Masala & Naan' },
  { dayOfWeek: 'Tuesday', morningNormal: 'Poha & Tea', morningHalfSpecial: 'Rajma, Jeera Rice & Curd', morningFullSpecial: 'Aloo Gobhi & Salad', eveningNormal: 'Soyabean Curry & Roti', eveningHalfSpecial: 'Dal Fry, Rice & Roti', eveningFullSpecial: 'Kadhai Paneer & Salad' },
  { dayOfWeek: 'Wednesday', morningNormal: 'Bread Butter & Tea', morningHalfSpecial: 'Choley, Rice & Raita', morningFullSpecial: 'Egg Curry (or Veg Kadhai)', eveningNormal: 'Seasonal Veg & Roti', eveningHalfSpecial: 'Black Dal, Roti & Rice', eveningFullSpecial: 'Paneer Do Pyaza & Roti' },
  { dayOfWeek: 'Thursday', morningNormal: 'Dalia & Tea', morningHalfSpecial: 'Kadhi Pakoda, Rice & Roti', morningFullSpecial: 'Khichdi & Curd', eveningNormal: 'Aloo Methi & Roti', eveningHalfSpecial: 'Dal Tadka, Rice & Roti', eveningFullSpecial: 'Veg Pulao & Raita' },
  { dayOfWeek: 'Friday', morningNormal: 'Idli Sambhar & Tea', morningHalfSpecial: 'Chana Masala & Rice', morningFullSpecial: 'Seasonal Veg & Salad', eveningNormal: 'Jeera Alloo & Roti', eveningHalfSpecial: 'Mix Veg, Roti & Rice', eveningFullSpecial: 'Shahi Paneer & Naan' },
  { dayOfWeek: 'Saturday', morningNormal: 'Bread Jam & Tea', morningHalfSpecial: 'Aloo Gobhi & Paratha', morningFullSpecial: 'Dal Makhani & Rice', eveningNormal: 'Tinda Sabzi & Roti', eveningHalfSpecial: 'Dal Tadka, Roti & Rice', eveningFullSpecial: 'Paneer Pasanda & Rice' },
  { dayOfWeek: 'Sunday', morningNormal: 'Poori Sabzi & Tea', morningHalfSpecial: 'Shahi Paneer & Pulao', morningFullSpecial: 'Gulab Jamun & Salad', eveningNormal: 'Aloo Soyabean & Roti', eveningHalfSpecial: 'Choley Bhatture & Salad', eveningFullSpecial: 'Kadhai Paneer & Rice' }
];

/**
 * Fetch the entire weekly menu. Auto-seeds default menu if empty.
 */
async function getMenu(req, res, next) {
  try {
    const userDistrictId = req.user.districtId;
    if (!userDistrictId) {
      return res.status(400).json({ error: 'User is not assigned to a district.' });
    }

    let menuList = await db.select().from(messMenu).where(eq(messMenu.districtId, userDistrictId));
    
    // Auto-seed if empty
    if (menuList.length === 0) {
      console.log('>>> [DB SEED] Seeding default mess menu for district:', userDistrictId);
      const seedData = defaultMenu.map(m => ({ ...m, districtId: userDistrictId }));
      await db.insert(messMenu).values(seedData);
      menuList = await db.select().from(messMenu).where(eq(messMenu.districtId, userDistrictId));
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
  const { id, morningNormal, morningHalfSpecial, morningFullSpecial, eveningNormal, eveningHalfSpecial, eveningFullSpecial } = req.body;
  const adminId = req.user.id;
  const userDistrictId = req.user.districtId;

  try {
    if (!userDistrictId) {
      return res.status(400).json({ error: 'User is not assigned to a district.' });
    }
    if (!id || !morningNormal || !morningHalfSpecial || !morningFullSpecial || !eveningNormal || !eveningHalfSpecial || !eveningFullSpecial) {
      return res.status(400).json({ error: 'Day ID and all 6 meal options are required.' });
    }

    const [updated] = await db.update(messMenu)
      .set({
        morningNormal: morningNormal.trim(),
        morningHalfSpecial: morningHalfSpecial.trim(),
        morningFullSpecial: morningFullSpecial.trim(),
        eveningNormal: eveningNormal.trim(),
        eveningHalfSpecial: eveningHalfSpecial.trim(),
        eveningFullSpecial: eveningFullSpecial.trim(),
        updatedAt: new Date()
      })
      .where(and(eq(messMenu.id, id), eq(messMenu.districtId, userDistrictId)))
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
