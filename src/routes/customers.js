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
      name, email, phone, areaName, partNo, street, jadda, houseNo, levelNo, flatNo, status,
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
      email,
      phone: primaryPhone,
      areaName,
      partNo,
      street,
      jadda,
      houseNo,
      levelNo,
      flatNo,
      status: status || 'Active',
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update a customer
router.put('/:id', authenticate, requirePermission('manage_customers'), async (req, res) => {
  try {
    const {
      name, email, phone, areaName, partNo, street, jadda, houseNo, levelNo, flatNo, status,
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
// @desc    Settle outstanding balance for a customer
router.post('/:id/settle', authenticate, requirePermission('manage_payments'), async (req, res) => {
  try {
    const { method } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const settledAmount = customer.balance || 0;
    if (settledAmount <= 0) {
      return res.status(400).json({ message: 'Customer has no outstanding balance.' });
    }

    // Find corresponding pending or partial orders before updating them
    const pendingOrders = await Order.find({ customer: customer._id, paymentStatus: { $in: ['Pending', 'Partial'] } }).select('number _id totalAmount amountPaid branchId');

    // Reset customer balance to 0
    customer.balance = 0;
    await customer.save();

    // Register payments
    const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (latestPayment && latestPayment.paymentId) {
      const match = latestPayment.paymentId.match(/PAY-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    let remainingAmount = settledAmount;
    const createdPayments = [];

    // 1. Process each pending/partial order
    for (const order of pendingOrders) {
      const paidAlready = order.amountPaid || 0;
      const orderAmount = Math.max(0, (order.totalAmount || 0) - paidAlready);
      if (orderAmount <= 0) continue;
      
      // Update order paymentStatus to Paid
      order.paymentStatus = 'Paid';
      order.amountPaid = order.totalAmount;
      await order.save();
      
      const paymentId = `PAY-${String(nextNum++).padStart(4, '0')}`;
      
      const payment = new Payment({
        paymentId,
        order: order._id,
        orderNumber: order.number,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        amount: orderAmount,
        method: method || 'Cash',
        status: 'Paid',
        branch: order.branchId || customer.branch
      });
      await payment.save();
      createdPayments.push(payment);
      
      remainingAmount -= orderAmount;
    }

    // 2. If there is remaining balance (no pending orders, or manual adjustment), create a general balance payment
    if (remainingAmount > 0) {
      const paymentId = `PAY-${String(nextNum++).padStart(4, '0')}`;
      const payment = new Payment({
        paymentId,
        orderNumber: `BAL-${customer._id.toString()}`,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        amount: remainingAmount,
        method: method || 'Cash',
        status: 'Paid',
        branch: customer.branch
      });
      await payment.save();
      createdPayments.push(payment);
    }

    await notify(
      'Balance Settled',
      `Customer ${customer.name} settled outstanding balance of ${settledAmount}.`,
      'general',
      req.user.branch
    );

    res.json({
      message: `Payment of ${settledAmount} via ${method || 'Cash'} recorded successfully.`,
      customer: formatCustomer(customer),
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
