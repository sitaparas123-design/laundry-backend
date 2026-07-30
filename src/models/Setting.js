const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'spinclean-settings',
    unique: true
  },
  business: {
    businessName: { type: String, default: 'Tuhama PRO' },
    ownerName: { type: String, default: 'Dana Lee' },
    email: { type: String, default: 'admin@tuhama.com' },
    phone: { type: String, default: '555-0001' },
    address: { type: String, default: '100 Executive Blvd, New York, NY 10001' },
    gstNumber: { type: String, default: 'GST-29ABCDE1234F1Z5' },
    website: { type: String, default: 'https://tuhama.com' },
    logo: { type: String }
  },
  system: {
    currency: { type: String, default: 'KWD' },
    timezone: { type: String, default: 'Asia/Kuwait' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    defaultDeliveryTime: { type: String, default: '48 hours' }
  },
  notifications: {
    emailAlerts: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: false },
    orderUpdates: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: true },
    pickupDeliveryAlerts: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },
  security: {
    twoFactorAuth: { type: Boolean, default: false },
    sessionTimeout: { type: String, default: '30' },
    loginAlerts: { type: Boolean, default: true }
  },
  payment: {
    upiQrCode: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
