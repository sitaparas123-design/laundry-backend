const express = require('express');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Role = require('../models/Role');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

const seedBranches = require('../utils/seedBranches');

// Helper to format branch matching frontend expectation
const formatBranch = (branch) => {
  const isSys = Boolean(
    branch.isSystemBranch ||
    (branch.name && branch.name.toLowerCase().includes('home service')) ||
    (branch.name && branch.name.toLowerCase().includes('main branch'))
  );
  return {
    id: branch._id.toString(),
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email || '',
    manager: branch.manager || '',
    status: branch.status,
    isSystemBranch: isSys,
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

// @route   POST /api/branches/restore-system-branches
// @desc    Auto-seed / Restore missing core system branches (Home Service, Main Branch)
router.post('/restore-system-branches', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    await seedBranches();
    const branches = await Branch.find().sort({ createdAt: -1 });
    const formatted = branches.map(branch => formatBranch(branch));
    res.json({ message: 'Core system branches verified and restored successfully.', branches: formatted });
  } catch (error) {
    console.error('Restore system branches error:', error);
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
      const formattedData = formatBranch(branch);
      return {
        ...formattedData,
        manager: assignedAdmin ? assignedAdmin.name : (branch.manager || '')
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

    const existingBranch = await Branch.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingBranch) {
      return res.status(400).json({ message: 'A branch with this name already exists.' });
    }

    const isSys = name.toLowerCase().includes('home service') || name.toLowerCase().includes('main branch');

    const branch = new Branch({
      name: name.trim(),
      address,
      phone,
      email: email || '',
      manager,
      status: status || 'Active',
      isSystemBranch: isSys
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

    if (name) {
      // If it is a system branch, preserve core identity
      const isCurrentSystem = branch.isSystemBranch || branch.name.toLowerCase().includes('home service');
      if (isCurrentSystem && !name.toLowerCase().includes('home service') && !name.toLowerCase().includes('main')) {
        return res.status(400).json({ message: 'Cannot rename protected system core branch to an arbitrary name.' });
      }
      branch.name = name.trim();
    }
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
// @desc    Delete a branch (Protected System Branches cannot be deleted)
router.delete('/:id', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    // Protection check for Home Service and Main Branch
    const isProtected = Boolean(
      branch.isSystemBranch ||
      (branch.name && branch.name.toLowerCase().includes('home service')) ||
      (branch.name && branch.name.toLowerCase().includes('main branch'))
    );

    if (isProtected) {
      return res.status(403).json({
        message: `Protected System Core Branch "${branch.name}" cannot be deleted. This branch is required for central logistics and operations.`
      });
    }

    await Branch.deleteOne({ _id: branch._id });
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
