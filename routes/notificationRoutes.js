const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
} = require('../controllers/notificationController');

router.get('/', protect, getMyNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

module.exports = router;
