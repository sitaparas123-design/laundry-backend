const express = require('express');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const formatNotification = (n) => {
  return {
    id: n._id.toString(),
    title: n.title,
    text: n.text,
    time: n.time ? n.time.toISOString() : new Date().toISOString(),
    read: n.read,
    type: n.type,
    branchId: n.branchId ? n.branchId.toString() : ''
  };
};

// @route   GET /api/notifications
// @desc    Get all notifications
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};
    if (req.user.branch) {
      query = {
        $or: [
          { branchId: req.user.branch },
          { branchId: null }
        ]
      };
    }
    const notifications = await Notification.find(query).sort({ time: -1 }).limit(50);
    res.json(notifications.map(formatNotification));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.json(formatNotification(notification));
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete/Acknowledge notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await Notification.deleteOne({ _id: notification._id });
    res.json({ message: 'Notification dismissed' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
