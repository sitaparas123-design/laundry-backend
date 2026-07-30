const express = require('express');
const Setting = require('../models/Setting');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Helper to format settings object matching frontend
const formatSettings = (settings) => {
  return {
    business: {
      businessName: settings.business.businessName,
      ownerName: settings.business.ownerName,
      email: settings.business.email,
      phone: settings.business.phone,
      address: settings.business.address,
      gstNumber: settings.business.gstNumber,
      website: settings.business.website,
      logo: settings.business.logo || ''
    },
    system: {
      currency: settings.system.currency,
      timezone: settings.system.timezone,
      dateFormat: settings.system.dateFormat,
      defaultDeliveryTime: settings.system.defaultDeliveryTime
    },
    notifications: {
      emailAlerts: settings.notifications.emailAlerts,
      smsAlerts: settings.notifications.smsAlerts,
      orderUpdates: settings.notifications.orderUpdates,
      paymentReminders: settings.notifications.paymentReminders,
      pickupDeliveryAlerts: settings.notifications.pickupDeliveryAlerts,
      marketingEmails: settings.notifications.marketingEmails
    },
    security: {
      twoFactorAuth: settings.security.twoFactorAuth,
      sessionTimeout: settings.security.sessionTimeout,
      loginAlerts: settings.security.loginAlerts
    },
    payment: {
      upiQrCode: settings.payment.upiQrCode || ''
    }
  };
};

// @route   GET /api/settings
// @desc    Get store settings
router.get('/', authenticate, async (req, res) => {
  try {
    let settings = await Setting.findOne({ key: 'spinclean-settings' });
    if (!settings) {
      // Return a temporary default if database not seeded
      settings = new Setting({ key: 'spinclean-settings' });
      await settings.save();
    }
    res.json(formatSettings(settings));
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/settings
// @desc    Update store settings
router.put('/', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    let settings = await Setting.findOne({ key: 'spinclean-settings' });
    if (!settings) {
      settings = new Setting({ key: 'spinclean-settings' });
    }

    const { business, system, notifications, security, payment } = req.body;

    if (business) settings.business = { ...settings.business, ...business };
    if (system) settings.system = { ...settings.system, ...system };
    if (notifications) settings.notifications = { ...settings.notifications, ...notifications };
    if (security) settings.security = { ...settings.security, ...security };
    if (payment) settings.payment = { ...settings.payment, ...payment };

    await settings.save();
    res.json(formatSettings(settings));
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
