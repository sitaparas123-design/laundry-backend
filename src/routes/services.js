const express = require('express');
const LaundryService = require('../models/LaundryService');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

const formatService = (service) => {
  return {
    id: service._id.toString(),
    name: service.name,
    category: service.category,
    price: service.price,
    estimatedTime: service.estimatedTime,
    status: service.status,
    description: service.description || ''
  };
};

// @route   GET /api/services
// @desc    Get all services
router.get('/', authenticate, async (req, res) => {
  try {
    const services = await LaundryService.find().sort({ createdAt: -1 });
    res.json(services.map(formatService));
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/services
// @desc    Create a service
router.post('/', authenticate, requirePermission('manage_services'), async (req, res) => {
  try {
    const { name, category, price, estimatedTime, status, description } = req.body;

    if (!name || !category || price === undefined || !estimatedTime) {
      return res.status(400).json({ message: 'Name, category, price, and estimated time are required.' });
    }

    const existingService = await LaundryService.findOne({ name });
    if (existingService) {
      return res.status(400).json({ message: 'A service with this name already exists.' });
    }

    const service = new LaundryService({
      name,
      category,
      price,
      estimatedTime,
      status: status || 'Active',
      description
    });

    await service.save();
    res.status(201).json(formatService(service));
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/services/:id
// @desc    Update a service
router.put('/:id', authenticate, requirePermission('manage_services'), async (req, res) => {
  try {
    const { name, category, price, estimatedTime, status, description } = req.body;

    const service = await LaundryService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (name) service.name = name;
    if (category) service.category = category;
    if (price !== undefined) service.price = price;
    if (estimatedTime) service.estimatedTime = estimatedTime;
    if (status) service.status = status;
    if (description !== undefined) service.description = description;

    await service.save();
    res.json(formatService(service));
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/services/:id
// @desc    Delete a service
router.delete('/:id', authenticate, requirePermission('manage_services'), async (req, res) => {
  try {
    const service = await LaundryService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await LaundryService.deleteOne({ _id: service._id });
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
