const Article = require('../models/Article');
const User = require('../models/User');
const emailUtils = require('../utils/emailUtils');
const notifUtils = require('../utils/notificationUtils');

// @desc  Get all articles (for admin overview)
// @route GET /api/admin/articles
// @access Private (admin only)
exports.getAllArticles = async (req, res) => {
    try {
        const articles = await Article.find()
            .sort({ createdAt: -1 })
            .populate('submittedBy', 'name email fullName')
            .populate('reviewer1', 'name email fullName')
            .populate('reviewer2', 'name email fullName')
            .populate('technicalReviewer', 'name email fullName');

        res.json({ success: true, articles });
    } catch (error) {
        console.error('Get all articles error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Get all reviewers grouped by role
// @route GET /api/admin/reviewers
// @access Private (admin only)
exports.getReviewers = async (req, res) => {
    try {
        const reviewers = await User.find({
            role: { $in: ['reviewer 1', 'reviewer 2', 'technical reviewer'] }
        }).select('name email fullName role');

        const grouped = {
            'reviewer 1': reviewers.filter(r => r.role === 'reviewer 1'),
            'reviewer 2': reviewers.filter(r => r.role === 'reviewer 2'),
            'technical reviewer': reviewers.filter(r => r.role === 'technical reviewer'),
        };

        res.json({ success: true, reviewers: grouped });
    } catch (error) {
        console.error('Get reviewers error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

// @desc  Assign reviewers to an article
//        Technical Reviewer (for plagiarism) + Reviewer 1 are required.
//        Reviewer 2 is optional.
//        Status moves to 'Plagiarism Check' so TR can start immediately.
// @route PUT /api/admin/articles/:id/assign
// @access Private (admin only)
exports.assignReviewers = async (req, res) => {
    try {
        const { reviewer1Id, reviewer2Id, technicalReviewerId } = req.body;

        if (!reviewer1Id || !technicalReviewerId) {
            return res.status(400).json({ message: 'Technical Reviewer and Reviewer 1 are required.' });
        }

        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        // Verify required reviewer roles
        const [r1, tr] = await Promise.all([
            User.findOne({ _id: reviewer1Id, role: 'reviewer 1' }),
            User.findOne({ _id: technicalReviewerId, role: 'technical reviewer' }),
        ]);

        if (!r1) return res.status(400).json({ message: 'Invalid Reviewer 1 selection.' });
        if (!tr) return res.status(400).json({ message: 'Invalid Technical Reviewer selection.' });

        // Reviewer 2 is optional
        let r2 = null;
        if (reviewer2Id) {
            r2 = await User.findOne({ _id: reviewer2Id, role: 'reviewer 2' });
            if (!r2) return res.status(400).json({ message: 'Invalid Reviewer 2 selection.' });
        }

        article.reviewer1 = r1._id;
        article.reviewer2 = r2 ? r2._id : undefined;
        article.technicalReviewer = tr._id;
        // Move to Plagiarism Check so TR can start their work
        article.status = 'Plagiarism Check';
        await article.save();

        // Notify Technical Reviewer (they go first — plagiarism check)
        emailUtils.sendAssignmentEmailToReviewer(tr.email, 'Technical Reviewer', article.articleId, article.title);
        notifUtils.notifyReviewerPaperAssigned(tr.email, 'Technical Reviewer', article.articleId, article.title);

        // Notify Reviewer 1 (assigned but will review after TR accepts)
        emailUtils.sendAssignmentEmailToReviewer(r1.email, 'Reviewer 1', article.articleId, article.title);
        notifUtils.notifyReviewerPaperAssigned(r1.email, 'Reviewer 1', article.articleId, article.title);

        // Notify Reviewer 2 if assigned
        if (r2) {
            emailUtils.sendAssignmentEmailToReviewer(r2.email, 'Reviewer 2', article.articleId, article.title);
            notifUtils.notifyReviewerPaperAssigned(r2.email, 'Reviewer 2', article.articleId, article.title);
        }

        // Notify the author
        if (article.submittedBy?.email) {
            emailUtils.sendAssignmentEmailToAuthor(article.submittedBy.email, article.articleId, article.title);
            notifUtils.notifyReviewerAssigned(article.submittedBy.email, article.articleId, article.title);
        }

        res.json({
            success: true,
            message: 'Reviewers assigned successfully. Status moved to Plagiarism Check.',
        });
    } catch (error) {
        console.error('Assign reviewers error:', error);
        res.status(500).json({ message: 'Server error while assigning reviewers.' });
    }
};
