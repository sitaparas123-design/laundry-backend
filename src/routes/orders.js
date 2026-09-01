const express = require('express');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const Delivery = require('../models/Delivery');
const Payment = require('../models/Payment');
const { authenticate, requirePermission } = require('../middleware/auth');
const notify = require('../utils/notify');

const router = express.Router();

const formatOrder = (order) => {
  const isHome = String(order.deliveryType || '').trim().toLowerCase() === 'home delivery';
  const cust = order.customer && typeof order.customer === 'object' && order.customer._id ? order.customer : null;
  const custIdStr = cust ? cust._id.toString() : (order.customer ? order.customer.toString() : '');
  const custNo = cust ? (cust.customerNo || `CUS-${String(cust.displayId || cust._id).slice(-4).toUpperCase()}`) : (order.customerNo || '');
  const custPhone = cust ? (cust.phone || (cust.phones && cust.phones[0]) || '') : (order.customerPhone || order.contactNumber || '');

  return {
    id: order._id.toString(),
    number: order.number,
    customerId: custIdStr,
    customerNo: custNo,
    customerPhone: custPhone,
    contactNumber: custPhone,
    customerName: order.customerName,
    serviceType: order.serviceType,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod || 'Cash',
    shift: order.shift || 'Morning',
    amount: order.amount,
    tax: order.tax,
    totalAmount: order.totalAmount,
    discountAmount: order.discountAmount || 0.0,
    freeBalanceUsed: order.freeBalanceUsed || 0.0,
    amountPaid: order.amountPaid || 0.0,
    date: order.date,
    pickupDate: order.pickupDate || '',
    deliveryDate: order.deliveryDate || '',
    expectedDeliveryDate: order.deliveryDate || '',
    expectedDeliveryTime: order.expectedDeliveryTime || '',
    deliveryType: isHome ? 'Home Delivery' : 'Branch Pickup',
    isHomeDelivery: isHome,
    deliveryMode: isHome ? 'home' : 'branch',
    notes: order.notes || '',
    createdBy: order.createdBy,
    branchId: order.branchId ? order.branchId.toString() : '',
    sharedBranches: (order.sharedBranches || []).map(b => b.toString()),
    transferredTo: order.transferredTo ? order.transferredTo.toString() : null,
    transferredBranchName: order.transferredBranchName || '',
    transferredAt: order.transferredAt || null,
    transferredBy: order.transferredBy || '',
    itemDetails: order.itemDetails.map(item => ({
      name: item.name,
      nameAr: item.nameAr || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifiers: item.modifiers || ''
    })),
    timeline: order.timeline.map(t => ({
      status: t.status,
      date: t.date,
      time: t.time,
      updatedBy: t.updatedBy,
      comment: t.comment || ''
    })),
    isEdited: order.isEdited || false,
    editedAt: order.editedAt || null,
    editedBy: order.editedBy || '',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
};

// Helper helper to format current date/time for timeline
const getTimelineDateTime = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}/${month}/${year}`; // DD/MM/YYYY
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); // HH:MM AM/PM
  return { dateStr, timeStr };
};

// @route   GET /api/orders/public/:idOrNumber
// @desc    Get order details by order number or MongoDB ID for public receipt scanning (no auth required)
router.get('/public/:idOrNumber', async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.idOrNumber || '').trim();
    if (!rawParam) {
      return res.status(400).json({ message: 'Order number or ID is required' });
    }

    // 1. Try exact number match
    let order = await Order.findOne({ number: rawParam });

    // 2. Try case-insensitive regex
    if (!order) {
      const escaped = rawParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      order = await Order.findOne({
        number: { $regex: new RegExp(`^${escaped}$`, 'i') }
      });
    }

    // 3. Try MongoDB _id match
    if (!order && /^[0-9a-fA-F]{24}$/.test(rawParam)) {
      order = await Order.findById(rawParam);
    }

    // 4. Try suffix match (e.g. MIS-064 vs 064 or 64)
    if (!order) {
      const numericMatch = rawParam.match(/(\d+)/);
      if (numericMatch) {
        order = await Order.findOne({
          number: { $regex: new RegExp(`MIS-0*${numericMatch[1]}$`, 'i') }
        });
      }
    }

    if (!order) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Fetch customer details if available
    let customerObj = null;
    if (order.customer) {
      customerObj = await Customer.findById(order.customer).lean();
    }

    // Fetch branch details if available
    let branchObj = null;
    if (order.branchId) {
      branchObj = await Branch.findById(order.branchId).lean();
    }

    const formatted = formatOrder(order);
    if (customerObj) {
      formatted.customerPhone = customerObj.phone || (customerObj.phones && customerObj.phones[0]) || '';
      formatted.customerNo = customerObj.customerNo || '';
      formatted.isSubscriber = customerObj.isSubscriber === true || (customerObj.isSubscriber !== false && Number(customerObj.insuranceAmount || 0) >= 20);
    }
    if (branchObj) {
      formatted.branchName = branchObj.name;
      formatted.branchNameAr = branchObj.nameAr;
    }

    res.json(formatted);
  } catch (error) {
    console.error('Public receipt lookup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/orders
// @desc    Get orders with optional filters (branchId, status)
router.get('/', authenticate, async (req, res) => {
  try {
    const { branchId, status } = req.query;
    const headerBranch = req.headers['x-selected-branch'];
    const selectedBranch = (headerBranch && headerBranch !== 'All') ? headerBranch : (branchId && branchId !== 'All' ? branchId : null);

    const filter = {};
    const branches = await Branch.find().select('_id');
    const existingBranchIds = branches.map(b => b._id.toString());

    if (selectedBranch && selectedBranch !== 'All') {
      filter.$or = [
        { branchId: selectedBranch },
        { sharedBranches: selectedBranch },
        { transferredTo: selectedBranch }
      ];
    } else if (req.activeBranch) {
      filter.$or = [
        { branchId: req.activeBranch._id },
        { sharedBranches: req.activeBranch._id },
        { transferredTo: req.activeBranch._id }
      ];
    } else if (req.user && req.user.role !== 'Super Admin' && req.user.branch) {
      filter.$or = [
        { branchId: req.user.branch },
        { sharedBranches: req.user.branch },
        { transferredTo: req.user.branch }
      ];
    } else {
      filter.branchId = { $in: existingBranchIds };
    }
    
    if (status) filter.status = status;

    const orders = await Order.find(filter).populate('customer').sort({ createdAt: -1 });
    res.json(orders.map(formatOrder));
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/orders/transfer
// @desc    Transfer/Share orders to another target branch
router.put('/transfer', authenticate, async (req, res) => {
  try {
    const { orderIds, targetBranchId, comment } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required' });
    }
    if (!targetBranchId) {
      return res.status(400).json({ message: 'Target branch ID is required' });
    }

    const targetBranch = await Branch.findById(targetBranchId);
    if (!targetBranch) {
      return res.status(404).json({ message: 'Target branch not found' });
    }

    const { dateStr, timeStr } = getTimelineDateTime();
    const updatedBy = req.user.name || req.user.username || 'Staff';

    const updatedOrders = [];
    for (const id of orderIds) {
      let order = null;
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        order = await Order.findById(id).populate('customer');
      }
      if (!order) {
        order = await Order.findOne({ number: id }).populate('customer');
      }
      if (!order) continue;

      if (!order.sharedBranches) order.sharedBranches = [];
      const hasBranch = order.sharedBranches.some(b => b.toString() === targetBranchId.toString());
      if (!hasBranch) {
        order.sharedBranches.push(targetBranch._id);
      }

      order.transferredTo = targetBranch._id;
      order.transferredBranchName = targetBranch.name;
      order.transferredAt = new Date();
      order.transferredBy = updatedBy;

      order.timeline.push({
        status: `Sent to ${targetBranch.name}`,
        date: dateStr,
        time: timeStr,
        updatedBy,
        comment: comment || `Order sent to ${targetBranch.name} branch for processing`
      });

      await order.save();
      updatedOrders.push(order);
    }

    await notify(
      'Orders Transferred',
      `${updatedOrders.length} order(s) sent to ${targetBranch.name} by ${updatedBy}.`,
      'order',
      targetBranch._id
    );

    res.json({
      message: `Successfully sent ${updatedOrders.length} order(s) to ${targetBranch.name}`,
      orders: updatedOrders.map(formatOrder)
    });
  } catch (error) {
    console.error('Transfer orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/orders
// @desc    Create new order (Make Invoice)
router.post('/', authenticate, requirePermission('create_orders'), async (req, res) => {
  try {
    const {
      customerId, customerName, serviceType, amount, tax, totalAmount, discountAmount,
      date, deliveryDate, expectedDeliveryTime, deliveryType, notes, itemDetails, paymentStatus, paymentMethod
    } = req.body;

    if (!customerId || !customerName || !serviceType || amount === undefined || tax === undefined || totalAmount === undefined || !itemDetails) {
      return res.status(400).json({ message: 'Missing required order details.' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    if (customer.status === 'Inactive') {
      const reason = customer.inactiveReason || 'Account is suspended';
      return res.status(400).json({
        message: `Cannot create invoice. Customer is Inactive (سبب الإيقاف: ${reason})`,
        inactiveReason: reason
      });
    }

    // Generate unique order number (prevent collision)
    let orderNumber = req.body.number;
    if (orderNumber) {
      const existing = await Order.findOne({ number: orderNumber });
      if (existing) {
        orderNumber = null;
      }
    }

    if (!orderNumber) {
      const latestOrder = await Order.findOne().sort({ createdAt: -1 });
      let nextNum = 1;
      if (latestOrder && latestOrder.number) {
        const match = latestOrder.number.match(/MIS-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      orderNumber = `MIS-${String(nextNum).padStart(3, '0')}`;
      let checkCount = 0;
      while (await Order.findOne({ number: orderNumber }) && checkCount < 100) {
        nextNum++;
        orderNumber = `MIS-${String(nextNum).padStart(3, '0')}`;
        checkCount++;
      }
    }

    // Get current branch with fallback options
    let finalBranchId = (req.activeBranch ? req.activeBranch._id : null) || req.body.branchId || req.user.branch;
    if (!finalBranchId) {
      const fallbackBranch = await Branch.findOne();
      if (fallbackBranch) {
        finalBranchId = fallbackBranch._id;
      } else {
        return res.status(400).json({ message: 'No branch is configured in the system. Please create a branch first.' });
      }
    }

    const { dateStr, timeStr } = getTimelineDateTime();
    const orderShift = req.body.shift || (new Date().getHours() < 15 ? 'Morning' : 'Evening');
    const freeBalanceUsed = Math.max(0, Number(req.body.freeBalanceUsed || 0));

    const order = new Order({
      number: orderNumber,
      customer: customer._id,
      customerName,
      serviceType,
      status: 'Waiting',
      paymentStatus: paymentStatus || 'Pending',
      paymentMethod: paymentMethod || (paymentStatus === 'Paid' ? 'Cash' : 'Unpaid'),
      shift: orderShift,
      amount,
      tax,
      totalAmount,
      discountAmount: discountAmount || 0.0,
      freeBalanceUsed: freeBalanceUsed,
      amountPaid: paymentStatus === 'Paid' ? parseFloat(totalAmount) : parseFloat(req.body.amountPaid || 0.0),
      date: date || new Date().toISOString().split('T')[0],
      deliveryDate,
      expectedDeliveryTime: expectedDeliveryTime || '',
      deliveryType: deliveryType || 'Branch Pickup',
      notes,
      createdBy: req.user.name,
      branchId: finalBranchId,
      itemDetails: itemDetails || [],
      timeline: [{
        status: 'Waiting',
        date: dateStr,
        time: timeStr,
        updatedBy: req.user.name,
        comment: 'Invoice created'
      }]
    });

    await order.save();

    await notify(
      'New Order Created',
      `Order ${order.number} was created for ${customerName}.`,
      'order',
      order.branchId || req.user.branch
    );

    // Increment customer loyalty metrics & deduct free balance
    customer.totalSpent += parseFloat(totalAmount);
    customer.loyaltyPoints += Math.floor(totalAmount); // 1 point per 1 unit spent
    if (freeBalanceUsed > 0) {
      customer.freeBalance = Math.max(0, Number(customer.freeBalance || 0) - freeBalanceUsed);
    }

    // Handle payment ledger and outstanding customer balance
    if (order.paymentStatus === 'Pending') {
      customer.balance = (customer.balance || 0) + parseFloat(totalAmount);
    } else if (order.paymentStatus === 'Paid') {
      const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
      let nextNum = 1;
      if (latestPayment && latestPayment.paymentId) {
        const match = latestPayment.paymentId.match(/PAY-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      const paymentId = `PAY-${String(nextNum).padStart(4, '0')}`;

      const payment = new Payment({
        paymentId,
        order: order._id,
        orderNumber: order.number,
        customerName: customerName,
        date: new Date().toISOString().split('T')[0],
        amount: parseFloat(totalAmount),
        method: paymentMethod || 'Cash',
        status: 'Paid',
        branch: finalBranchId,
        branchId: finalBranchId,
        shift: orderShift,
        createdBy: req.user.name
      });
      await payment.save();
    } else if (order.paymentStatus === 'Partial') {
      const actualAmountPaid = parseFloat(req.body.amountPaid || 0);
      const remainingBalance = parseFloat(totalAmount) - actualAmountPaid;
      
      // Update customer balance with unpaid amount
      customer.balance = (customer.balance || 0) + Math.max(0, remainingBalance);
      
      if (actualAmountPaid > 0) {
        const latestPayment = await Payment.findOne().sort({ createdAt: -1 });
        let nextNum = 1;
        if (latestPayment && latestPayment.paymentId) {
          const match = latestPayment.paymentId.match(/PAY-(\d+)/);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        const paymentId = `PAY-${String(nextNum).padStart(4, '0')}`;

        const payment = new Payment({
          paymentId,
          order: order._id,
          orderNumber: order.number,
          customerName: customerName,
          date: new Date().toISOString().split('T')[0],
          amount: actualAmountPaid,
          method: paymentMethod || 'Cash',
          status: 'Paid',
          branch: finalBranchId,
          branchId: finalBranchId,
          shift: orderShift,
          createdBy: req.user.name
        });
        await payment.save();
      }
    }

    await customer.save();

    // Auto-schedule delivery if deliveryType is Home Delivery
    let deliveryStatus = 'None';
    if (deliveryType === 'Home Delivery') {
      const latestDelivery = await Delivery.findOne().sort({ createdAt: -1 });
      let nextDelNum = 1;
      if (latestDelivery && latestDelivery.deliveryId) {
        const delMatch = latestDelivery.deliveryId.match(/DEL-(\d+)/);
        if (delMatch) {
          nextDelNum = parseInt(delMatch[1], 10) + 1;
        }
      }
      const deliveryId = `DEL-${String(nextDelNum).padStart(3, '0')}`;

      const delivery = new Delivery({
        deliveryId,
        customer: customerName,
        deliveryDate: deliveryDate || '',
        orderDate: order.date || new Date().toISOString().split('T')[0],
        orderCount: 1,
        status: 'Scheduled',
        address: `${customer.areaName}, St. ${customer.street || ''}, House ${customer.houseNo || ''}`,
        contactNumber: customer.phone,
        orderNumber: order.number,
        areaName: customer.areaName,
        createdFromInvoice: true,
        branchId: order.branchId
      });
      await delivery.save();
      await notify(
        'New Delivery Scheduled',
        `Delivery ${deliveryId} scheduled for ${customerName}.`,
        'delivery',
        order.branchId || req.user.branch
      );
      deliveryStatus = 'Scheduled';
    }

    res.status(201).json({
      id: order._id.toString(),
      number: order.number,
      status: order.status,
      deliveryStatus
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/orders/bulk/status
// @desc    Bulk update order statuses
router.put('/bulk/status', authenticate, requirePermission(['manage_orders', 'create_orders']), async (req, res) => {
  try {
    const { orderIds, status } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0 || !status) {
      return res.status(400).json({ message: 'orderIds (array) and status are required.' });
    }

    const { dateStr, timeStr } = getTimelineDateTime();

    const ordersToUpdate = await Order.find({ _id: { $in: orderIds } });
    for (const order of ordersToUpdate) {
      order.status = status;
      order.timeline.push({
        status,
        date: dateStr,
        time: timeStr,
        updatedBy: req.user.name,
        comment: 'Bulk status update'
      });

      if (status === 'Delivered') {
        order.paymentStatus = 'Paid';
      }
      await order.save();

      await notify(
        'Order Status Updated',
        `Order ${order.number} status changed to ${status}.`,
        'order',
        order.branchId || req.user.branch
      );
    }

    res.json({ message: `Successfully updated status of ${ordersToUpdate.length} orders.` });
  } catch (error) {
    console.error('Bulk update orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status and append to timeline
router.put('/:id/status', authenticate, requirePermission(['manage_orders', 'create_orders']), async (req, res) => {
  try {
    const { status, holdComment, deliveryType, deliveryDate, expectedDeliveryTime } = req.body;
    if (!status && !deliveryType) {
      return res.status(400).json({ message: 'Status or deliveryType is required.' });
    }

    let order = null;
    if (/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      order = await Order.findById(req.params.id);
    }
    if (!order) {
      order = await Order.findOne({ number: req.params.id });
    }
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const { dateStr, timeStr } = getTimelineDateTime();

    if (status && status !== order.status) {
      order.status = status;
      order.timeline.push({
        status,
        date: dateStr,
        time: timeStr,
        updatedBy: req.user.name,
        comment: holdComment || (deliveryType ? `Status: ${status}, Delivery: ${deliveryType}` : `Status changed to ${status}`)
      });

      // If order gets delivered, update payment status if unpaid, or handle delivery completion links
      if (status === 'Delivered') {
        order.paymentStatus = 'Paid';
      }
    } else if (holdComment) {
      order.timeline.push({
        status: order.status,
        date: dateStr,
        time: timeStr,
        updatedBy: req.user.name,
        comment: holdComment
      });
    }

    if (deliveryType !== undefined) {
      order.deliveryType = String(deliveryType).trim().toLowerCase() === 'home delivery' ? 'Home Delivery' : 'Branch Pickup';
    } else if (req.body.isHomeDelivery !== undefined) {
      order.deliveryType = req.body.isHomeDelivery ? 'Home Delivery' : 'Branch Pickup';
    } else if (req.body.deliveryMode !== undefined) {
      order.deliveryType = req.body.deliveryMode === 'home' ? 'Home Delivery' : 'Branch Pickup';
    }
    if (deliveryDate !== undefined) {
      order.deliveryDate = deliveryDate;
    } else if (req.body.expectedDeliveryDate !== undefined) {
      order.deliveryDate = req.body.expectedDeliveryDate;
    }
    if (expectedDeliveryTime !== undefined) order.expectedDeliveryTime = expectedDeliveryTime;

    order.markModified('deliveryType');
    order.markModified('deliveryDate');
    order.markModified('expectedDeliveryTime');

    await order.save();

    await notify(
      'Order Status Updated',
      `Order ${order.number} updated. Status: ${order.status}, Delivery: ${order.deliveryType || 'Branch Pickup'}.`,
      'order',
      order.branchId || req.user.branch
    );

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/orders/:id/payment-status
// @desc    Update order payment status
router.put('/:id/payment-status', authenticate, requirePermission(['manage_orders', 'create_orders', 'manage_payments']), async (req, res) => {
  try {
    const { paymentStatus, amountPaid } = req.body;
    if (!paymentStatus) {
      return res.status(400).json({ message: 'paymentStatus is required.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const oldPaymentStatus = order.paymentStatus;
    const oldAmountPaid = order.amountPaid || 0;

    let newAmountPaid = oldAmountPaid;
    if (paymentStatus === 'Paid') {
      newAmountPaid = order.totalAmount;
    } else if (paymentStatus === 'Pending') {
      newAmountPaid = 0;
    } else if (paymentStatus === 'Partial') {
      newAmountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : oldAmountPaid;
    }

    order.paymentStatus = paymentStatus;
    order.amountPaid = newAmountPaid;
    await order.save();

    // Sync with Customer outstanding balance
    const Customer = require('../models/Customer');
    const customer = await Customer.findById(order.customer);
    if (customer) {
      const oldUnpaid = oldPaymentStatus === 'Paid' ? 0 : (order.totalAmount - oldAmountPaid);
      const newUnpaid = paymentStatus === 'Paid' ? 0 : (order.totalAmount - newAmountPaid);
      
      customer.balance = Math.max(0, (customer.balance || 0) - oldUnpaid + newUnpaid);
      await customer.save();
    }

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Update order payment status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/orders/:id
// @desc    Delete an order by ID
router.delete('/:id', authenticate, requirePermission('manage_orders'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted successfully.' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/orders/:id/edit
// @desc    Edit order items and delivery mode (admin only) — add/remove items, update quantities, delivery type, recalculate totals
router.put('/:id/edit', authenticate, requirePermission('manage_orders'), async (req, res) => {
  try {
    const { itemDetails, notes, serviceType, discountAmount, deliveryType, deliveryDate, expectedDeliveryTime } = req.body;

    let order = null;
    if (/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      order = await Order.findById(req.params.id);
    }
    if (!order) {
      order = await Order.findOne({ number: req.params.id });
    }
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    let newTotal = order.totalAmount;
    let oldTotal = order.totalAmount;
    let oldAmountPaid = order.amountPaid || 0;

    if (itemDetails && Array.isArray(itemDetails) && itemDetails.length > 0) {
      // Calculate new amounts
      const newAmount = itemDetails.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const discount = discountAmount !== undefined ? parseFloat(discountAmount) : (order.discountAmount || 0);
      const subtotalAfterDiscount = Math.max(0, newAmount - discount);
      // Preserve tax rate from original order
      const originalTaxRate = order.amount > 0 ? (order.tax / order.amount) : 0;
      const newTax = parseFloat((subtotalAfterDiscount * originalTaxRate).toFixed(3));
      newTotal = parseFloat((subtotalAfterDiscount + newTax).toFixed(3));

      // Update order fields
      order.itemDetails = itemDetails;
      order.amount = parseFloat(newAmount.toFixed(3));
      order.tax = newTax;
      order.totalAmount = newTotal;
      order.discountAmount = discount;

      // Adjust amountPaid if it exceeds new total
      if (order.amountPaid > newTotal) {
        order.amountPaid = newTotal;
        order.paymentStatus = 'Paid';
      }
    } else if (discountAmount !== undefined) {
      const discount = parseFloat(discountAmount);
      const subtotalAfterDiscount = Math.max(0, order.amount - discount);
      const originalTaxRate = order.amount > 0 ? (order.tax / order.amount) : 0;
      const newTax = parseFloat((subtotalAfterDiscount * originalTaxRate).toFixed(3));
      newTotal = parseFloat((subtotalAfterDiscount + newTax).toFixed(3));
      order.tax = newTax;
      order.totalAmount = newTotal;
      order.discountAmount = discount;
    }

    if (notes !== undefined) order.notes = notes;
    if (serviceType) order.serviceType = serviceType;
    if (deliveryType !== undefined) {
      order.deliveryType = String(deliveryType).trim().toLowerCase() === 'home delivery' ? 'Home Delivery' : 'Branch Pickup';
    } else if (req.body.isHomeDelivery !== undefined) {
      order.deliveryType = req.body.isHomeDelivery ? 'Home Delivery' : 'Branch Pickup';
    } else if (req.body.deliveryMode !== undefined) {
      order.deliveryType = req.body.deliveryMode === 'home' ? 'Home Delivery' : 'Branch Pickup';
    }
    if (deliveryDate !== undefined) {
      order.deliveryDate = deliveryDate;
    } else if (req.body.expectedDeliveryDate !== undefined) {
      order.deliveryDate = req.body.expectedDeliveryDate;
    }
    if (expectedDeliveryTime !== undefined) order.expectedDeliveryTime = expectedDeliveryTime;

    order.markModified('deliveryType');
    order.markModified('deliveryDate');
    order.markModified('expectedDeliveryTime');

    order.isEdited = true;
    order.editedAt = new Date();
    order.editedBy = req.user.name;

    // Add timeline entry for edit
    const { dateStr, timeStr } = getTimelineDateTime();
    order.timeline.push({
      status: order.status,
      date: dateStr,
      time: timeStr,
      updatedBy: req.user.name,
      comment: `Invoice edited by admin — Delivery: ${order.deliveryType || 'Branch Pickup'}, Total: ${newTotal.toFixed(3)}`
    });

    await order.save();

    // Adjust customer balance if payment was pending/partial
    if (order.paymentStatus !== 'Paid') {
      const customer = await Customer.findById(order.customer);
      if (customer) {
        const oldUnpaid = oldTotal - oldAmountPaid;
        const newUnpaid = newTotal - (order.amountPaid || 0);
        customer.balance = Math.max(0, (customer.balance || 0) - oldUnpaid + newUnpaid);
        await customer.save();
      }
    }

    await notify(
      'Invoice Edited',
      `Invoice ${order.number} was edited by ${req.user.name}. Delivery: ${order.deliveryType || 'Branch Pickup'}, New total: ${newTotal.toFixed(3)}.`,
      'order',
      order.branchId || req.user.branch
    );

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Edit order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/orders/purge-preview
// @desc    Preview invoices older than specified years (default 2 years)
router.get('/purge-preview', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const years = parseFloat(req.query.years) || 2;
    const cutoffDate = new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const eligibleOrders = await Order.find({
      $or: [
        { createdAt: { $lte: cutoffDate } },
        { date: { $lte: cutoffDateStr } }
      ]
    }).sort({ createdAt: -1 });

    const totalAmount = eligibleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    res.json({
      cutoffDate: cutoffDateStr,
      years,
      eligibleCount: eligibleOrders.length,
      totalAmount,
      orders: eligibleOrders.slice(0, 50).map(formatOrder)
    });
  } catch (error) {
    console.error('Purge preview error:', error);
    res.status(500).json({ message: 'Failed to generate purge preview' });
  }
});

// @route   POST /api/orders/purge-old-invoices
// @desc    Safely delete invoices older than specified years (default 2 years)
router.post('/purge-old-invoices', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const years = parseFloat(req.body.years) || 2;
    const cutoffDate = new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Find target orders
    const targetOrders = await Order.find({
      $or: [
        { createdAt: { $lte: cutoffDate } },
        { date: { $lte: cutoffDateStr } }
      ]
    });

    const targetOrderIds = targetOrders.map(o => o._id);
    const targetOrderNumbers = targetOrders.map(o => o.number);

    if (targetOrderIds.length === 0) {
      return res.json({
        message: 'No invoices found older than 2 years.',
        deletedCount: 0
      });
    }

    // Delete orders
    const deleteOrdersResult = await Order.deleteMany({ _id: { $in: targetOrderIds } });

    // Also delete associated payments
    await Payment.deleteMany({
      $or: [
        { order: { $in: targetOrderIds } },
        { orderNumber: { $in: targetOrderNumbers } },
        { createdAt: { $lte: cutoffDate } }
      ]
    });

    // Notify audit
    await notify(
      'Invoices Purged (2 Years)',
      `${req.user.name} purged ${deleteOrdersResult.deletedCount} invoices created before ${cutoffDateStr}.`,
      'system'
    );

    res.json({
      message: `Successfully purged ${deleteOrdersResult.deletedCount} invoices older than ${years} years.`,
      deletedCount: deleteOrdersResult.deletedCount,
      cutoffDate: cutoffDateStr
    });
  } catch (error) {
    console.error('Purge old invoices error:', error);
    res.status(500).json({ message: 'Failed to purge old invoices' });
  }
});

module.exports = router;
