const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  arabicName: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  manager: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  isSystemBranch: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
