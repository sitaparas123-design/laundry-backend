const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');

const MONGODB_URI = 'mongodb+srv://Ijazsandhu:Ijaz%40Laundary2026%21%21@laundarysurru.wrutv3j.mongodb.net/laundry_management?retryWrites=true&w=majority&appName=LaundarySurru';

async function check() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');
  
  const paymentsCount = await Payment.countDocuments({});
  const ordersCount = await Order.countDocuments({});
  console.log('Payments count:', paymentsCount);
  console.log('Orders count:', ordersCount);
  
  const allPayments = await Payment.find({});
  console.log('All payments:', allPayments);
  
  const allOrders = await Order.find({});
  console.log('All orders:', allOrders.map(o => ({ id: o._id, orderNumber: o.orderNumber, branchId: o.branchId, paymentStatus: o.paymentStatus })));

  mongoose.connection.close();
}

check().catch(console.error);
