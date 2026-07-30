const express = require('express');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Role = require('../models/Role');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Helper to format branch matching frontend expectation
const formatBranch = (branch) => {
  return {
    id: branch._id.toString(),
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email || '',
    manager: branch.manager || '',
    status: branch.status,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt
  };
};

// @route   GET /api/branches/public
// @desc    Get active branches for public dropdowns (like Login)
router.get('/public', async (req, res) => {
  try {
    const branches = await Branch.find({ status: 'Active' }).sort({ name: 1 });
    const formatted = branches.map(branch => ({
      id: branch._id.toString(),
      name: branch.name
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Get public branches error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/branches
// @desc    Get all branches with populated assigned Admin name
router.get('/', authenticate, async (req, res) => {
  try {
    const adminRole = await Role.findOne({ name: 'Admin' });
    const admins = adminRole ? await User.find({ role: adminRole._id }) : [];

    const branches = await Branch.find().sort({ createdAt: -1 });
    const formatted = branches.map(branch => {
      const assignedAdmin = admins.find(a => a.branch && a.branch.toString() === branch._id.toString());
      return {
        id: branch._id.toString(),
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        email: branch.email || '',
        manager: assignedAdmin ? assignedAdmin.name : '',
        status: branch.status
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/branches
// @desc    Create a branch
router.post('/', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { name, address, phone, email, manager, status } = req.body;

    if (!name || !address || !phone) {
      return res.status(400).json({ message: 'Name, address, and phone are required.' });
    }

    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
      return res.status(400).json({ message: 'A branch with this name already exists.' });
    }

    const branch = new Branch({
      name,
      address,
      phone,
      email: email || '',
      manager,
      status: status || 'Active'
    });

    await branch.save();
    res.status(201).json(formatBranch(branch));
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/branches/:id
// @desc    Update a branch
router.put('/:id', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { name, address, phone, email, manager, status } = req.body;
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    if (name) branch.name = name;
    if (address) branch.address = address;
    if (phone) branch.phone = phone;
    if (email !== undefined) branch.email = email;
    if (manager !== undefined) branch.manager = manager;
    if (status) branch.status = status;

    await branch.save();
    res.json(formatBranch(branch));
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/branches/:id
// @desc    Delete a branch
router.delete('/:id', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    await Branch.deleteOne({ _id: branch._id });
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
