const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

const MONGODB_URI = 'mongodb+srv://Ijazsandhu:Ijaz%40Laundary2026%21%21@laundarysurru.wrutv3j.mongodb.net/laundry_management?retryWrites=true&w=majority&appName=LaundarySurru';
const branchId = '6a3cf82764fc882a198272c5'; // Mishrif branch ID

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const userBranch = new mongoose.Types.ObjectId(branchId);

  const orders = await Order.find({ branchId: userBranch }).select('_id');
  const orderIds = orders.map(o => o._id);
  console.log('Found orders for branch:', orderIds.length);

  const customers = await Customer.find({ branch: userBranch }).select('_id');
  const balOrderNumbers = customers.map(c => `BAL-${c._id.toString()}`);
  console.log('Found customers for branch:', customers.length);

  const query = {
    $or: [
      { order: { $in: orderIds } },
      { branch: userBranch },
      { orderNumber: { $in: balOrderNumbers } }
    ]
  };

  const payments = await Payment.find(query).populate('order').sort({ createdAt: -1 });
  console.log('Query result payments count:', payments.length);
  console.log('Query result payments:', payments.map(p => ({ id: p._id, paymentId: p.paymentId, branch: p.branch, orderNumber: p.orderNumber })));

  mongoose.connection.close();
}

run().catch(console.error);
