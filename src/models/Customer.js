const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  areaName: {
    type: String,
    required: true
  },
  partNo: {
    type: String
  },
  street: {
    type: String
  },
  jadda: {
    type: String
  },
  houseNo: {
    type: String
  },
  levelNo: {
    type: String
  },
  flatNo: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  totalSpent: {
    type: Number,
    default: 0.0
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  customerNo: {
    type: String
  },
  arabicName: {
    type: String
  },
  englishName: {
    type: String
  },
  customDiscountRate: {
    type: Number
  },
  customerLevel: {
    type: String
  },
  phones: {
    type: [String]
  },
  paciNo: {
    type: String
  },
  addressNotes: {
    type: String
  },
  registrationDate: {
    type: String
  },
  date: {
    type: String
  },
  insuranceAmount: {
    type: Number,
    default: 20.0
  },
  invoicesCount: {
    type: Number,
    default: 0
  },
  lastInvoiceDate: {
    type: String
  },
  freeBalance: {
    type: Number,
    default: 0
  },
  freeTotal: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0.0
  },
  notes: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
