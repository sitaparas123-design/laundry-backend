const Branch = require('../models/Branch');

const seedBranches = async () => {
  try {
    const systemBranches = [
      {
        name: 'Home Service',
        address: 'Central Logistics & Home Delivery Hub',
        phone: '+965 2222 0000',
        email: 'homeservice@tuhama.com',
        status: 'Active',
        isSystemBranch: true
      },
      {
        name: 'Main Branch',
        address: 'Headquarters & Central Processing Unit',
        phone: '+965 2222 1111',
        email: 'main@tuhama.com',
        status: 'Active',
        isSystemBranch: true
      }
    ];

    for (const item of systemBranches) {
      const existing = await Branch.findOne({
        name: { $regex: new RegExp(`^${item.name}$`, 'i') }
      });

      if (!existing) {
        await Branch.create(item);
        console.log(`[Self-Healing] Created missing system core branch: ${item.name}`);
      } else if (!existing.isSystemBranch) {
        existing.isSystemBranch = true;
        await existing.save();
      }
    }
  } catch (error) {
    console.error('Error seeding/restoring system branches:', error);
  }
};

module.exports = seedBranches;
