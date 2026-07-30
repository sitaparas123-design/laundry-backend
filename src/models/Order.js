const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  nameAr: {
    type: String
  },
  quantity: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  modifiers: {
    type: String
  }
});

const timelineNodeSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String,
    required: true
  },
  comment: {
    type: String
  }
});

const orderSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: [
      'Waiting', 'Preparing in shop', 'Preparing in workshop', 'Hold', 
      'Ready', 'Ready for delivery', 'Ready for shop', 'With Driver', 
      'Delivered', 'Return', 'Store', 'In Store', 'In Workshop', 'Cancelled'
    ],
    default: 'Waiting'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial', 'Overdue'],
    default: 'Pending'
  },
  amount: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0.0
  },
  amountPaid: {
    type: Number,
    default: 0.0
  },
  date: {
    type: String,
    required: true
  },
  pickupDate: {
    type: String
  },
  deliveryDate: {
    type: String
  },
  deliveryType: {
    type: String,
    enum: ['Branch Pickup', 'Home Delivery'],
    default: 'Branch Pickup'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: String,
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  itemDetails: [orderItemSchema],
  timeline: [timelineNodeSchema]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
