const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['order', 'delivery', 'system', 'general'],
    default: 'general'
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
