const express = require('express');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { authenticate, requirePermission } = require('../middleware/auth');
const notify = require('../utils/notify');

const router = express.Router();

const formatCustomer = (customer) => {
  return {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email || '',
    phone: customer.phone,
    areaName: customer.areaName,
    partNo: customer.partNo || '',
    street: customer.street || '',
    jadda: customer.jadda || '',
    houseNo: customer.houseNo || '',
    levelNo: customer.levelNo || '',
    flatNo: customer.flatNo || '',
    status: customer.status,
    inactiveReason: customer.inactiveReason || '',
    totalSpent: customer.totalSpent,
    loyaltyPoints: customer.loyaltyPoints,
    branchId: customer.branch ? customer.branch.toString() : '',
    branch: customer.branch ? customer.branch.toString() : '',
    customerNo: customer.customerNo || '',
    arabicName: customer.arabicName || '',
    englishName: customer.englishName || '',
    customDiscountRate: customer.customDiscountRate || 0,
    customerLevel: customer.customerLevel || '',
    phones: customer.phones || [],
    paciNo: customer.paciNo || '',
    addressNotes: customer.addressNotes || '',
    registrationDate: customer.registrationDate || '',
    date: customer.date || '',
    insuranceAmount: customer.insuranceAmount || 0,
    isSubscriber: customer.isSubscriber === true || (customer.isSubscriber !== false && Number(customer.insuranceAmount || 0) >= 20),
    invoicesCount: customer.invoicesCount || 0,
    lastInvoiceDate: customer.lastInvoiceDate || '',
    freeBalance: customer.freeBalance || 0,
    freeTotal: customer.freeTotal || 0,
    balance: customer.balance || 0,
    notes: customer.notes || '',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
};

// @route   GET /api/customers
// @desc    Get all customers (accessible by all authenticated staff/roles)
router.get('/', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;
    const headerBranch = req.headers['x-selected-branch'];
    const selectedBranch = (headerBranch && headerBranch !== 'All') ? headerBranch : (branchId && branchId !== 'All' ? branchId : null);

    const filter = {};
    const Branch = require('../models/Branch');
    const branches = await Branch.find().select('_id');
    const branchIds = branches.map(b => b._id);

    if (selectedBranch) {
      filter.branch = selectedBranch;
    } else if (req.activeBranch) {
      filter.branch = req.activeBranch._id;
    } else if (req.user.branch) {
      filter.branch = req.user.branch;
    } else {
      // For Super Admin: filter out customers of deleted branches, keeping general customers (null branch)
      filter.branch = { $in: [...branchIds, null] };
    }
    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    res.json(customers.map(formatCustomer));
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/customers
// @desc    Create a customer
router.post('/', authenticate, requirePermission('manage_customers'), async (req, res) => {
  try {
    const {
      name, email, phone, areaName, partNo, street, jadda, houseNo, levelNo, flatNo, status, inactiveReason,
      customerNo, arabicName, englishName, customDiscountRate, customerLevel, phones,
      paciNo, addressNotes, registrationDate, date, insuranceAmount, isSubscriber, invoicesCount,
      lastInvoiceDate, freeBalance, freeTotal, notes, branchId
    } = req.body;

    const primaryName = englishName || name || arabicName || 'Unnamed';
    const primaryPhone = (phones && phones[0]) || phone || '';

    if (!primaryPhone) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    const phoneToFind = primaryPhone;
    const existingCustomer = await Customer.findOne({
      $or: [
        { phone: phoneToFind },
        { phones: phoneToFind }
      ]
    });
    if (existingCustomer) {
      return res.status(400).json({ message: 'A customer with this phone number already exists.' });
    }

    // Check email uniqueness if email is provided
    if (email && email.trim()) {
      const existingEmail = await Customer.findOne({ email: email.trim() });
      if (existingEmail) {
        return res.status(400).json({ message: 'A customer with this email already exists.' });
      }
    }

    const effectiveBranch = (req.activeBranch ? req.activeBranch._id : null) || branchId || req.body.branch || req.user.branch || null;

    const customer = new Customer({
      name: primaryName,
      email: (email && email.trim()) || undefined,
      phone: primaryPhone,
      areaName,
      partNo,
      street,
      jadda,
      houseNo,
      levelNo,
      flatNo,
      status: status || 'Active',
      inactiveReason: inactiveReason || '',
      totalSpent: 0.0,
      loyaltyPoints: 0,
      branch: effectiveBranch,
      customerNo,
      arabicName,
      englishName: englishName || primaryName,
      customDiscountRate,
      customerLevel,
      phones: phones || [primaryPhone],
      paciNo,
      addressNotes,
      registrationDate,
      date,
      insuranceAmount: insuranceAmount || 0,
      isSubscriber: isSubscriber !== undefined ? Boolean(isSubscriber) : Number(insuranceAmount) >= 20,
      invoicesCount,
      lastInvoiceDate,
      freeBalance,
      freeTotal,
      notes
    });

    await customer.save();
    res.status(201).json(formatCustomer(customer));
  } catch (error) {
    console.error('Create customer error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(400).json({ message: `Customer with this ${field} already exists.` });
    }
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update a customer
router.put('/:id', authenticate, requirePermission('manage_customers'), async (req, res) => {
  try {
    const {
      name, email, phone, areaName, partNo, street, jadda, houseNo, levelNo, flatNo, status, inactiveReason,
      totalSpent, loyaltyPoints, customerNo, arabicName, englishName, customDiscountRate,
      customerLevel, phones, paciNo, addressNotes, registrationDate, date, insuranceAmount,
      isSubscriber, invoicesCount, lastInvoiceDate, freeBalance, freeTotal, balance, notes, branchId
    } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const primaryName = englishName || name || arabicName;
    const primaryPhone = (phones && phones[0]) || phone;

    // Check phone uniqueness on update
    if (primaryPhone) {
      const existingPhone = await Customer.findOne({
        _id: { $ne: customer._id },
        $or: [
          { phone: primaryPhone },
          { phones: primaryPhone }
        ]
      });
      if (existingPhone) {
        return res.status(400).json({ message: 'A customer with this phone number already exists.' });
      }
    }

    // Check email uniqueness on update
    if (email && email.trim()) {
      const existingEmail = await Customer.findOne({
        _id: { $ne: customer._id },
        email: email.trim()
      });
      if (existingEmail) {
        return res.status(400).json({ message: 'A customer with this email already exists.' });
      }
    }

    if (primaryName) {
      customer.name = primaryName;
      customer.englishName = englishName || primaryName;
    }
    if (email !== undefined) customer.email = email;
    if (primaryPhone) customer.phone = primaryPhone;
    if (areaName !== undefined) customer.areaName = areaName;
    if (partNo !== undefined) customer.partNo = partNo;
    if (street !== undefined) customer.street = street;
    if (jadda !== undefined) customer.jadda = jadda;
    if (houseNo !== undefined) customer.houseNo = houseNo;
    if (levelNo !== undefined) customer.levelNo = levelNo;
    if (flatNo !== undefined) customer.flatNo = flatNo;
    if (status) customer.status = status;
    if (inactiveReason !== undefined) customer.inactiveReason = inactiveReason;
    if (totalSpent !== undefined) customer.totalSpent = totalSpent;
    if (loyaltyPoints !== undefined) customer.loyaltyPoints = loyaltyPoints;
    
    if (customerNo !== undefined) customer.customerNo = customerNo;
    if (arabicName !== undefined) customer.arabicName = arabicName;
    if (customDiscountRate !== undefined) customer.customDiscountRate = customDiscountRate;
    if (customerLevel !== undefined) customer.customerLevel = customerLevel;
    if (phones !== undefined) customer.phones = phones;
    if (paciNo !== undefined) customer.paciNo = paciNo;
    if (addressNotes !== undefined) customer.addressNotes = addressNotes;
    if (registrationDate !== undefined) customer.registrationDate = registrationDate;
    if (date !== undefined) customer.date = date;
    if (insuranceAmount !== undefined) customer.insuranceAmount = insuranceAmount;
    if (isSubscriber !== undefined) {
      customer.isSubscriber = Boolean(isSubscriber);
      if (!isSubscriber && (insuranceAmount === undefined || Number(insuranceAmount) >= 20)) {
        customer.insuranceAmount = 0;
      }
    } else if (Number(customer.insuranceAmount || 0) >= 20) {
      customer.isSubscriber = true;
    }
    if (invoicesCount !== undefined) customer.invoicesCount = invoicesCount;
    if (lastInvoiceDate !== undefined) customer.lastInvoiceDate = lastInvoiceDate;
    if (freeBalance !== undefined) customer.freeBalance = freeBalance;
    if (freeTotal !== undefined) customer.freeTotal = freeTotal;
    if (balance !== undefined) customer.balance = balance;
    if (notes !== undefined) customer.notes = notes;
    
    if (branchId !== undefined) {
      customer.branch = branchId;
    } else if (req.body.branch !== undefined) {
      customer.branch = req.body.branch;
    }

    await customer.save();
    res.json(formatCustomer(customer));
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete a customer
router.delete('/:id', authenticate, requirePermission('manage_customers'), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    await Customer.deleteOne({ _id: customer._id });
    res.json({ message: 'Customer deleted successfully.' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/customers/:id/settle
// @route   POST /api/customers/:id/settle
// @desc    Settle outstanding balance / credit payment with FIFO waterfall for a customer
router.post('/:id/settle', authenticate, async (req, res) => {
  try {
    const { amount, method, branchId, note } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    // Find all pending or partial orders for this customer (FIFO: oldest first)
    const pendingOrders = await Order.find({
      customer: customer._id,
      paymentStatus: { $in: ['Pending', 'Partial'] }
    }).sort({ createdAt: 1, date: 1 });

    const totalOrdersDue = pendingOrders.reduce((sum, ord) => {
      const paid = Number(ord.amountPaid || 0);
      const total = Number(ord.totalAmount || 0);
      return sum + Math.max(0, total - paid);
    }, 0);

    const custBalance = Number(customer.balance || 0);
    const totalCurrentDue = Math.max(totalOrdersDue, custBalance);

    // Determine the payment amount (custom amount if provided, or full outstanding due)
    let paymentAmount = (amount !== undefined && amount !== null && amount !== '') ? Number(amount) : totalCurrentDue;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid payment amount greater than 0.' });
    }

    // Prepare next paymentId sequence
    const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (latestPayment && latestPayment.paymentId) {
      const match = latestPayment.paymentId.match(/PAY-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    let unallocated = paymentAmount;
    const createdPayments = [];
    const settledOrdersInfo = [];

    // 1. Process each pending order in FIFO sequence
    for (const order of pendingOrders) {
      if (unallocated <= 0) break;

      const paidAlready = Number(order.amountPaid || 0);
      const orderTotal = Number(order.totalAmount || 0);
      const orderDue = Math.max(0, orderTotal - paidAlready);
      if (orderDue <= 0) continue;

      const payForThis = Math.min(unallocated, orderDue);
      const newPaid = paidAlready + payForThis;
      order.amountPaid = newPaid;

      if (newPaid >= orderTotal - 0.001) {
        order.paymentStatus = 'Paid';
      } else {
        order.paymentStatus = 'Partial';
      }
      await order.save();

      const paymentId = `PAY-${String(nextNum++).padStart(4, '0')}`;
      const payment = new Payment({
        paymentId,
        order: order._id,
        orderNumber: order.number,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        amount: payForThis,
        method: method || 'Cash',
        status: 'Paid',
        branch: branchId || order.branchId || customer.branch || (req.activeBranch && req.activeBranch._id)
      });
      await payment.save();
      createdPayments.push(payment);

      settledOrdersInfo.push({
        orderId: order._id,
        orderNumber: order.number,
        orderTotal,
        amountApplied: payForThis,
        remainingDue: Math.max(0, orderTotal - newPaid),
        newStatus: order.paymentStatus
      });

      unallocated -= payForThis;
    }

    // 2. If excess amount paid after settling all pending orders, credit to customer's free balance / advance
    let advanceCredited = 0;
    if (unallocated > 0) {
      advanceCredited = unallocated;
      customer.freeBalance = Number(customer.freeBalance || 0) + advanceCredited;

      const paymentId = `PAY-${String(nextNum++).padStart(4, '0')}`;
      const payment = new Payment({
        paymentId,
        orderNumber: `ADV-${customer.customerNo || customer._id.toString().slice(-4)}`,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        amount: advanceCredited,
        method: method || 'Cash',
        status: 'Paid',
        branch: branchId || customer.branch || (req.activeBranch && req.activeBranch._id)
      });
      await payment.save();
      createdPayments.push(payment);
    }

    // 3. Recalculate remaining customer outstanding balance
    const remainingPendingOrders = await Order.find({
      customer: customer._id,
      paymentStatus: { $in: ['Pending', 'Partial'] }
    });
    const newTotalDue = remainingPendingOrders.reduce((sum, ord) => {
      const paid = Number(ord.amountPaid || 0);
      const total = Number(ord.totalAmount || 0);
      return sum + Math.max(0, total - paid);
    }, 0);

    customer.balance = newTotalDue;
    await customer.save();

    await notify(
      'Balance Settled',
      `Customer ${customer.name} paid ${paymentAmount.toFixed(3)} KWD via ${method || 'Cash'}.`,
      'general',
      branchId || customer.branch || (req.activeBranch && req.activeBranch._id)
    );

    res.json({
      success: true,
      message: `Payment of ${paymentAmount.toFixed(3)} KWD via ${method || 'Cash'} recorded successfully.`,
      totalPaid: paymentAmount,
      advanceAdded: advanceCredited,
      newTotalDue,
      customer: formatCustomer(customer),
      settledOrders: settledOrdersInfo,
      payments: createdPayments.map(p => ({
        id: p._id.toString(),
        paymentId: p.paymentId,
        orderNumber: p.orderNumber,
        customerName: p.customerName,
        date: p.date,
        amount: p.amount,
        method: p.method,
        status: p.status
      }))
    });
  } catch (error) {
    console.error('Settle customer balance error:', error);
    res.status(500).json({ message: 'Internal server error while settling customer balance.' });
  }
});

module.exports = router;
