const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Helper to format expense
const formatExpense = (e) => ({
  id: e._id,
  _id: e._id,
  title: e.title,
  amount: Number(e.amount || 0),
  category: e.category,
  paymentMethod: e.paymentMethod,
  date: e.date,
  time: e.time || '',
  shift: e.shift || 'General',
  notes: e.notes || '',
  createdBy: e.createdBy,
  branchId: e.branchId ? e.branchId.toString() : '',
  createdAt: e.createdAt,
  updatedAt: e.updatedAt
});

// @route   GET /api/expenses
// @desc    Get all expenses (with optional branch, date, and category filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { start, end, category, branchId, shift } = req.query;
    const filter = {};

    // Branch filter
    const queryBranch = branchId || req.headers['x-branch-id'];
    if (queryBranch && queryBranch !== 'all' && queryBranch !== 'undefined' && queryBranch !== 'null') {
      try {
        filter.branchId = new mongoose.Types.ObjectId(queryBranch);
      } catch (err) {
        console.error('Invalid branchId:', queryBranch);
      }
    } else if (req.user.role !== 'Super Admin' && req.user.branch) {
      filter.branchId = new mongoose.Types.ObjectId(req.user.branch);
    }

    // Date filter
    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = start;
      if (end) filter.date.$lte = end;
    }

    // Category filter
    if (category && category !== 'All') {
      filter.category = category;
    }

    // Shift filter
    if (shift && shift !== 'All') {
      filter.shift = shift;
    }

    const expenses = await Expense.find(filter).sort({ createdAt: -1 });
    res.json(expenses.map(formatExpense));
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/expenses
// @desc    Log a new expense
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, amount, category, paymentMethod, date, notes, shift, branchId } = req.body;

    if (!title || amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Title and amount are required.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }

    let finalBranchId = (req.activeBranch ? req.activeBranch._id : null) || branchId || req.user.branch;
    if (!finalBranchId) {
      const fallbackBranch = await Branch.findOne();
      if (fallbackBranch) {
        finalBranchId = fallbackBranch._id;
      } else {
        return res.status(400).json({ message: 'No branch is configured.' });
      }
    }

    const now = new Date();
    const currentDate = date || now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Determine shift automatically if not provided
    let calculatedShift = shift;
    if (!calculatedShift || calculatedShift === 'General') {
      const hour = now.getHours();
      calculatedShift = hour < 15 ? 'Morning' : 'Evening';
    }

    const expense = new Expense({
      title,
      amount: parseFloat(numAmount.toFixed(3)),
      category: category || 'Laundry Supplies & Detergents',
      paymentMethod: paymentMethod || 'Cash',
      date: currentDate,
      time: currentTime,
      shift: calculatedShift,
      notes: notes || '',
      createdBy: req.user.name || req.user.username || 'Staff',
      branchId: finalBranchId
    });

    await expense.save();
    res.status(201).json(formatExpense(expense));
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete an expense entry
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }

    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
