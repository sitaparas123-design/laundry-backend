const express = require('express');
const Area = require('../models/Area');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/areas
// @desc    Get all areas
router.get('/', authenticate, async (req, res) => {
  try {
    const areas = await Area.find().sort({ name: 1 });
    res.json(areas.map(a => ({ id: a._id.toString(), name: a.name })));
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/areas
// @desc    Create a new service area
router.post('/', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Area name is required.' });
    }

    const trimmedName = name.trim();
    const existingArea = await Area.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existingArea) {
      return res.status(400).json({ message: 'Area already exists.' });
    }

    const area = new Area({ name: trimmedName });
    await area.save();

    res.status(201).json({ id: area._id.toString(), name: area.name });
  } catch (error) {
    console.error('Create area error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/areas/:name
// @desc    Delete a service area by name
router.delete('/:name', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const area = await Area.findOne({ name: req.params.name });
    if (!area) {
      return res.status(404).json({ message: 'Area not found.' });
    }

    await Area.deleteOne({ _id: area._id });
    res.json({ message: 'Area deleted successfully.' });
  } catch (error) {
    console.error('Delete area error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
