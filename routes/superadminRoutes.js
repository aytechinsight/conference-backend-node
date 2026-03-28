const express = require('express');
const router = express.Router();
const { getStats, getAllUsers, createReviewer, deleteUser } = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const superadminOnly = [protect, authorize('superadmin')];

router.get('/stats', ...superadminOnly, getStats);
router.get('/users', ...superadminOnly, getAllUsers);
router.post('/create-reviewer', ...superadminOnly, createReviewer);
router.delete('/users/:id', ...superadminOnly, deleteUser);

module.exports = router;
