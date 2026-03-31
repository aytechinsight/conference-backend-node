const Article = require('../models/Article');
const User = require('../models/User');
const emailUtils = require('../utils/emailUtils');

// @desc  Get articles assigned to this reviewer (matching their role queue)
// @route GET /api/reviewer/articles
// @access Private (reviewer roles only)
exports.getMyAssignedArticles = async (req, res) => {
    try {
        const role = req.user.role; // 'reviewer 1', 'reviewer 2', 'technical reviewer'

        let filter = {};
        if (role === 'reviewer 1') {
            filter = { reviewer1: req.user._id };
        } else if (role === 'reviewer 2') {
            filter = { reviewer2: req.user._id };
        } else if (role === 'technical reviewer') {
            filter = { technicalReviewer: req.user._id };
        } else {
            return res.status(403).json({ message: 'Not a reviewer role.' });
        }

        const articles = await Article.find(filter)
            .sort({ createdAt: -1 })
            .populate('submittedBy', 'name email fullName')
            .populate('reviewer1', 'name email fullName')
            .populate('reviewer2', 'name email fullName')
            .populate('technicalReviewer', 'name email fullName');

        res.json({ success: true, articles });
    } catch (error) {
        console.error('Get assigned articles error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Forward a paper to the next reviewer in the chain
// @route PUT /api/reviewer/articles/:id/forward
// @access Private (reviewer roles only)
exports.forwardArticle = async (req, res) => {
    try {
        const role = req.user.role;
        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email')
            .populate('reviewer2', 'email name')
            .populate('technicalReviewer', 'email name');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        // Verify this reviewer is actually assigned and it's their turn
        if (role === 'reviewer 1') {
            if (String(article.reviewer1) !== String(req.user._id) &&
                String(article.reviewer1?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Reviewer 1 for this paper.' });
            }
            if (article.status !== 'Reviewer 1') {
                return res.status(400).json({ message: 'This paper is not currently in Reviewer 1 stage.' });
            }
            article.status = 'Reviewer 2';
            await article.save();

            // Notify Reviewer 2
            if (article.reviewer2?.email) {
                emailUtils.sendAssignmentEmailToReviewer(article.reviewer2.email, 'Reviewer 2', article.articleId, article.title);
            }
            // Notify Author (no reviewer names)
            if (article.submittedBy?.email) {
                emailUtils.sendStatusUpdateEmailToAuthor(article.submittedBy.email, article.articleId, article.title, 'Reviewer 2');
            }

        } else if (role === 'reviewer 2') {
            if (String(article.reviewer2) !== String(req.user._id) &&
                String(article.reviewer2?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Reviewer 2 for this paper.' });
            }
            if (article.status !== 'Reviewer 2') {
                return res.status(400).json({ message: 'This paper is not currently in Reviewer 2 stage.' });
            }
            article.status = 'Technical Reviewer';
            await article.save();

            // Notify Technical Reviewer
            if (article.technicalReviewer?.email) {
                emailUtils.sendAssignmentEmailToReviewer(article.technicalReviewer.email, 'Technical Reviewer', article.articleId, article.title);
            }
            // Notify Author
            if (article.submittedBy?.email) {
                emailUtils.sendStatusUpdateEmailToAuthor(article.submittedBy.email, article.articleId, article.title, 'Technical Reviewer');
            }

        } else if (role === 'technical reviewer') {
            if (String(article.technicalReviewer) !== String(req.user._id) &&
                String(article.technicalReviewer?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Technical Reviewer for this paper.' });
            }
            if (article.status !== 'Technical Reviewer') {
                return res.status(400).json({ message: 'This paper is not currently in Technical Reviewer stage.' });
            }
            article.status = 'Accepted';
            await article.save();

            // Notify Author
            if (article.submittedBy?.email) {
                emailUtils.sendStatusUpdateEmailToAuthor(article.submittedBy.email, article.articleId, article.title, 'Accepted');
            }

        } else {
            return res.status(403).json({ message: 'Not a reviewer role.' });
        }

        res.json({
            success: true,
            message: `Paper forwarded successfully. New status: ${article.status}`,
            status: article.status,
        });
    } catch (error) {
        console.error('Forward article error:', error);
        res.status(500).json({ message: 'Server error while forwarding article.' });
    }
};
