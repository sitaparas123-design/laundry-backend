const mongoose = require('mongoose');

const pickupSchema = new mongoose.Schema({
  pickupId: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: String,
    required: true
  },
  pickupDate: {
    type: String,
    required: true
  },
  assignedStaff: {
    type: String
  },
  orderCount: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Assigned', 'In Progress', 'Picked Up', 'Completed'],
    default: 'Scheduled'
  },
  address: {
    type: String
  },
  contactNumber: {
    type: String
  },
  orderNumber: {
    type: String
  },
  areaName: {
    type: String
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }
}, { timestamps: true });

module.exports = mongoose.model('Pickup', pickupSchema);
