const express = require('express');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const { authenticate, requirePermission } = require('../middleware/auth');
const notify = require('../utils/notify');
const { updateDriverStatus } = require('../utils/driverStatus');

const router = express.Router();

const formatDelivery = (delivery) => {
  return {
    id: delivery._id.toString(),
    deliveryId: delivery.deliveryId,
    customer: delivery.customer,
    deliveryDate: delivery.deliveryDate,
    assignedStaff: delivery.assignedStaff || '',
    orderCount: delivery.orderCount || 1,
    status: delivery.status,
    address: delivery.address || '',
    contactNumber: delivery.contactNumber || '',
    orderNumber: delivery.orderNumber,
    areaName: delivery.areaName || '',
    createdFromInvoice: delivery.createdFromInvoice || false,
    branchId: delivery.branchId ? delivery.branchId.toString() : ''
  };
};

// @route   GET /api/deliveries
// @desc    Get all deliveries
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};
    const effectiveBranchId = req.activeBranch ? req.activeBranch._id : req.user.branch;
    const isDeliveryRole = req.user.role && (req.user.role.name === 'Delivery Staff' || req.user.role.name === 'Driver');

    if (isDeliveryRole) {
      const staffNames = [req.user.name, req.user.username].filter(Boolean);
      const orConditions = [{ assignedStaff: { $in: staffNames } }];

      if (effectiveBranchId && !req.isHomeServiceBranch) {
        const orders = await Order.find({ branchId: effectiveBranchId }).select('number');
        const orderNumbers = orders.map(o => o.number);
        orConditions.push({ branchId: effectiveBranchId });
        if (orderNumbers.length > 0) {
          orConditions.push({ orderNumber: { $in: orderNumbers } });
        }
      } else {
        orConditions.push({});
      }

      query = { $or: orConditions };
      if (orConditions.some(c => Object.keys(c).length === 0)) {
        query = {};
      }
    } else if (effectiveBranchId && !req.isHomeServiceBranch) {
      const orders = await Order.find({ branchId: effectiveBranchId }).select('number');
      const orderNumbers = orders.map(o => o.number);
      query = {
        $or: [
          { branchId: effectiveBranchId },
          { orderNumber: { $in: orderNumbers } }
        ]
      };
    }
    const deliveries = await Delivery.find(query).sort({ createdAt: -1 });
    res.json(deliveries.map(formatDelivery));
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/deliveries
// @desc    Create a delivery scheduling
router.post('/', authenticate, requirePermission('manage_deliveries'), async (req, res) => {
  try {
    const { customer, deliveryDate, orderNumber, address, contactNumber, areaName, assignedStaff, branchId } = req.body;

    if (!customer || !deliveryDate || !orderNumber) {
      return res.status(400).json({ message: 'Customer, deliveryDate, and orderNumber are required.' });
    }

    const latestDelivery = await Delivery.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (latestDelivery && latestDelivery.deliveryId) {
      const match = latestDelivery.deliveryId.match(/DEL-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const deliveryId = `DEL-${String(nextNum).padStart(3, '0')}`;

    const delivery = new Delivery({
      deliveryId,
      customer,
      deliveryDate,
      assignedStaff: assignedStaff || '',
      orderCount: 1,
      status: assignedStaff ? 'Assigned' : 'Scheduled',
      address,
      contactNumber,
      orderNumber,
      areaName,
      branchId: branchId || req.user.branch
    });

    await delivery.save();

    await notify(
      'New Delivery Scheduled',
      `Delivery ${deliveryId} scheduled for ${customer}.`,
      'delivery'
    );

    if (delivery.assignedStaff) {
      await updateDriverStatus(delivery.assignedStaff);
    }

    res.status(201).json(formatDelivery(delivery));
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/deliveries/:id/assign
// @desc    Assign driver to delivery
router.put('/:id/assign', authenticate, requirePermission('manage_deliveries'), async (req, res) => {
  try {
    const { assignedStaff } = req.body;
    const unassign = !assignedStaff || assignedStaff === 'Unassigned';

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery job not found.' });
    }

    const previousDriver = delivery.assignedStaff;

    if (unassign) {
      delivery.assignedStaff = '';
      delivery.status = 'Scheduled';
    } else {
      delivery.assignedStaff = assignedStaff;
      delivery.status = 'Assigned';
    }

    await delivery.save();

    if (unassign) {
      await notify(
        'Delivery Unassigned',
        `Delivery ${delivery.deliveryId} is now unassigned.`,
        'delivery',
        delivery.branchId || req.user.branch
      );
    } else {
      await notify(
        'Delivery Assigned',
        `Delivery ${delivery.deliveryId} has been assigned to driver ${assignedStaff}.`,
        'delivery',
        delivery.branchId || req.user.branch
      );
    }

    if (previousDriver) {
      await updateDriverStatus(previousDriver);
    }
    if (delivery.assignedStaff) {
      await updateDriverStatus(delivery.assignedStaff);
    }

    res.json(formatDelivery(delivery));
  } catch (error) {
    console.error('Assign delivery error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/deliveries/:id/status
// @desc    Update delivery status and sync with Order status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery job not found.' });
    }

    delivery.status = status;
    await delivery.save();

    await notify(
      'Delivery Status Updated',
      `Delivery ${delivery.deliveryId} status changed to ${status}.`,
      'delivery',
      delivery.branchId || req.user.branch
    );

    // If status is updated to Delivered, synchronize the main order status and payment status
    if (status === 'Delivered') {
      const order = await Order.findOne({ number: delivery.orderNumber });
      if (order) {
        order.status = 'Delivered';
        order.paymentStatus = 'Paid';
        
        // Push timeline update
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        order.timeline.push({
          status: 'Delivered',
          date: dateStr,
          time: timeStr,
          updatedBy: req.user.name,
          comment: 'Delivered at doorstep by rider'
        });
        
        await order.save();
      }
    }

    if (delivery.assignedStaff) {
      await updateDriverStatus(delivery.assignedStaff);
    }

    res.json(formatDelivery(delivery));
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
