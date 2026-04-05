const Notification = require('../models/Notification');

// @desc  Get all notifications for the logged-in user (newest first)
// @route GET /api/notifications
// @access Private (user)
exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(100);
        const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Mark a single notification as read
// @route PUT /api/notifications/:id/read
// @access Private (user)
exports.markAsRead = async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isRead: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Mark ALL notifications as read for this user
// @route PUT /api/notifications/read-all
// @access Private (user)
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Get unread count only (for sidebar badge polling)
// @route GET /api/notifications/unread-count
// @access Private (user)
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
        res.json({ success: true, unreadCount: count });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};
