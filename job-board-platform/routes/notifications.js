const express = require('express');
const { Notification } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get all notifications for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(notifications);
  } catch (err) {
    console.error('Fetch Notifications Error:', err);
    res.status(500).json({ error: 'Server error while fetching notifications.' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    await notification.update({ isRead: true });
    res.json(notification);
  } catch (err) {
    console.error('Mark Notification Read Error:', err);
    res.status(500).json({ error: 'Server error while updating notification.' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id } }
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark All Read Error:', err);
    res.status(500).json({ error: 'Server error while updating notifications.' });
  }
});

module.exports = router;
