const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getAllArticles,
    getReviewers,
    assignReviewers,
} = require('../controllers/adminController');

const adminOnly = [protect, authorize('superadmin')];

router.get('/articles', ...adminOnly, getAllArticles);
router.get('/reviewers', ...adminOnly, getReviewers);
router.put('/articles/:id/assign', ...adminOnly, assignReviewers);

module.exports = router;
