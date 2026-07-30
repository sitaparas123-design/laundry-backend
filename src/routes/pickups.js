const express = require('express');
const Pickup = require('../models/Pickup');
const Order = require('../models/Order');
const { authenticate, requirePermission } = require('../middleware/auth');
const notify = require('../utils/notify');
const { updateDriverStatus } = require('../utils/driverStatus');

const router = express.Router();

const formatPickup = (pickup) => {
  return {
    id: pickup._id.toString(),
    pickupId: pickup.pickupId,
    customer: pickup.customer,
    pickupDate: pickup.pickupDate,
    assignedStaff: pickup.assignedStaff || '',
    orderCount: pickup.orderCount || 1,
    status: pickup.status,
    address: pickup.address || '',
    contactNumber: pickup.contactNumber || '',
    orderNumber: pickup.orderNumber || '',
    areaName: pickup.areaName || '',
    branchId: pickup.branchId ? pickup.branchId.toString() : ''
  };
};

// @route   GET /api/pickups
// @desc    Get all pickups
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
    const pickups = await Pickup.find(query).sort({ createdAt: -1 });
    res.json(pickups.map(formatPickup));
  } catch (error) {
    console.error('Get pickups error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/pickups
// @desc    Create a pickup
router.post('/', authenticate, requirePermission('manage_pickups'), async (req, res) => {
  try {
    const { customer, pickupDate, address, contactNumber, orderNumber, areaName, assignedStaff, branchId } = req.body;

    if (!customer || !pickupDate) {
      return res.status(400).json({ message: 'Customer name and pickup date are required.' });
    }

    const latestPickup = await Pickup.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (latestPickup && latestPickup.pickupId) {
      const match = latestPickup.pickupId.match(/PKP-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const pickupId = `PKP-${String(nextNum).padStart(3, '0')}`;

    const pickup = new Pickup({
      pickupId,
      customer,
      pickupDate,
      assignedStaff: assignedStaff || '',
      orderCount: 1,
      status: assignedStaff ? 'Assigned' : 'Scheduled',
      address,
      contactNumber,
      orderNumber,
      areaName,
      branchId: branchId || req.user.branch
    });

    await pickup.save();

    await notify(
      'New Pickup Scheduled',
      `Pickup ${pickupId} scheduled for ${customer}.`,
      'delivery',
      pickup.branchId || req.user.branch
    );

    if (pickup.assignedStaff) {
      await updateDriverStatus(pickup.assignedStaff);
    }

    res.status(201).json(formatPickup(pickup));
  } catch (error) {
    console.error('Create pickup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/pickups/:id/assign
// @desc    Assign driver to pickup
router.put('/:id/assign', authenticate, requirePermission('manage_pickups'), async (req, res) => {
  try {
    const { assignedStaff } = req.body;
    const unassign = !assignedStaff || assignedStaff === 'Unassigned';

    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) {
      return res.status(404).json({ message: 'Pickup job not found.' });
    }

    const previousDriver = pickup.assignedStaff;

    if (unassign) {
      pickup.assignedStaff = '';
      pickup.status = 'Scheduled';
    } else {
      pickup.assignedStaff = assignedStaff;
      pickup.status = 'Assigned';
    }

    await pickup.save();

    if (unassign) {
      await notify(
        'Pickup Unassigned',
        `Pickup ${pickup.pickupId} is now unassigned.`,
        'delivery',
        pickup.branchId || req.user.branch
      );
    } else {
      await notify(
        'Pickup Assigned',
        `Pickup ${pickup.pickupId} has been assigned to driver ${assignedStaff}.`,
        'delivery',
        pickup.branchId || req.user.branch
      );
    }

    if (previousDriver) {
      await updateDriverStatus(previousDriver);
    }
    if (pickup.assignedStaff) {
      await updateDriverStatus(pickup.assignedStaff);
    }

    res.json(formatPickup(pickup));
  } catch (error) {
    console.error('Assign pickup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/pickups/:id/status
// @desc    Update pickup status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) {
      return res.status(404).json({ message: 'Pickup job not found.' });
    }

    pickup.status = status;
    await pickup.save();

    await notify(
      'Pickup Status Updated',
      `Pickup ${pickup.pickupId} status changed to ${status}.`,
      'delivery',
      pickup.branchId || req.user.branch
    );

    if (pickup.assignedStaff) {
      await updateDriverStatus(pickup.assignedStaff);
    }

    res.json(formatPickup(pickup));
  } catch (error) {
    console.error('Update pickup status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
