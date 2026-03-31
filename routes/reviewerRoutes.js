const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getMyAssignedArticles,
    forwardArticle,
} = require('../controllers/reviewerController');

const reviewerOnly = [protect, authorize('reviewer 1', 'reviewer 2', 'technical reviewer')];

router.get('/articles', ...reviewerOnly, getMyAssignedArticles);
router.put('/articles/:id/forward', ...reviewerOnly, forwardArticle);

module.exports = router;
