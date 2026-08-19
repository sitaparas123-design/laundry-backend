const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: [
      'Laundry Supplies & Detergents',
      'Packaging & Bags',
      'Fuel & Petrol',
      'Shop Maintenance & Repairs',
      'Tea & Refreshments',
      'Utilities & Bills',
      'Staff Petty Cash',
      'Other Expense'
    ],
    default: 'Laundry Supplies & Detergents'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'K-Net / Card', 'Bank Transfer', 'Other'],
    default: 'Cash'
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String
  },
  shift: {
    type: String,
    enum: ['Morning', 'Evening', 'General'],
    default: 'General'
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: String,
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
