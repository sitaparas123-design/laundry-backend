const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  deliveryId: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: String,
    required: true
  },
  deliveryDate: {
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
    enum: ['Scheduled', 'Assigned', 'Out For Delivery', 'Out for Delivery', 'Delivered', 'Failed'],
    default: 'Scheduled'
  },
  address: {
    type: String
  },
  contactNumber: {
    type: String
  },
  orderNumber: {
    type: String,
    required: true
  },
  orderDate: {
    type: String
  },
  areaName: {
    type: String
  },
  createdFromInvoice: {
    type: Boolean,
    default: false
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema);
