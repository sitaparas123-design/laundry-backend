const mongoose = require('mongoose');

const laundryServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  estimatedTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  description: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('LaundryService', laundryServiceSchema);
