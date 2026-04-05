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
// @route PUT /api/admin/articles/:id/assign
// @access Private (admin only)
exports.assignReviewers = async (req, res) => {
    try {
        const { reviewer1Id, reviewer2Id, technicalReviewerId } = req.body;

        if (!reviewer1Id || !reviewer2Id || !technicalReviewerId) {
            return res.status(400).json({ message: 'All three reviewer IDs are required.' });
        }

        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        // Verify all reviewer users exist and have correct roles
        const [r1, r2, tr] = await Promise.all([
            User.findOne({ _id: reviewer1Id, role: 'reviewer 1' }),
            User.findOne({ _id: reviewer2Id, role: 'reviewer 2' }),
            User.findOne({ _id: technicalReviewerId, role: 'technical reviewer' }),
        ]);

        if (!r1) return res.status(400).json({ message: 'Invalid Reviewer 1 selection.' });
        if (!r2) return res.status(400).json({ message: 'Invalid Reviewer 2 selection.' });
        if (!tr) return res.status(400).json({ message: 'Invalid Technical Reviewer selection.' });

        article.reviewer1 = r1._id;
        article.reviewer2 = r2._id;
        article.technicalReviewer = tr._id;
        article.status = 'Reviewer 1';
        await article.save();

        // Send emails + in-app notifications to assigned reviewers
        emailUtils.sendAssignmentEmailToReviewer(r1.email, 'Reviewer 1', article.articleId, article.title);
        emailUtils.sendAssignmentEmailToReviewer(r2.email, 'Reviewer 2', article.articleId, article.title);
        emailUtils.sendAssignmentEmailToReviewer(tr.email, 'Technical Reviewer', article.articleId, article.title);
        notifUtils.notifyReviewerPaperAssigned(r1.email, 'Reviewer 1', article.articleId, article.title);
        notifUtils.notifyReviewerPaperAssigned(r2.email, 'Reviewer 2', article.articleId, article.title);
        notifUtils.notifyReviewerPaperAssigned(tr.email, 'Technical Reviewer', article.articleId, article.title);

        // Notify the author
        if (article.submittedBy?.email) {
            emailUtils.sendAssignmentEmailToAuthor(article.submittedBy.email, article.articleId, article.title);
            notifUtils.notifyReviewerAssigned(article.submittedBy.email, article.articleId, article.title);
        }

        res.json({
            success: true,
            message: 'Reviewers assigned successfully. Status moved to Reviewer 1.',
        });
    } catch (error) {
        console.error('Assign reviewers error:', error);
        res.status(500).json({ message: 'Server error while assigning reviewers.' });
    }
};

// @desc  Submit plagiarism check for an article
// @route PUT /api/admin/articles/:id/plagiarism-check
// @access Private (admin only)
exports.submitPlagiarismCheck = async (req, res) => {
    try {
        const { plagiarismPercent, aiSimilarityPercent, remark, decision } = req.body;

        if (!decision || !['Accept', 'Reject'].includes(decision)) {
            return res.status(400).json({ message: 'Decision must be either Accept or Reject.' });
        }

        if (!req.files?.plagiarismReport?.[0]) {
            return res.status(400).json({ message: 'Plagiarism Report file is required.' });
        }
        if (!plagiarismPercent && plagiarismPercent !== '0') {
            return res.status(400).json({ message: 'Plagiarism % is required.' });
        }
        if (!req.files?.aiSimilarityReport?.[0]) {
            return res.status(400).json({ message: 'AI Similarity Report file is required.' });
        }
        if (!aiSimilarityPercent && aiSimilarityPercent !== '0') {
            return res.status(400).json({ message: 'AI Similarity % is required.' });
        }
        if (!remark || !remark.trim()) {
            return res.status(400).json({ message: 'Remark is required.' });
        }

        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email fullName name');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Submitted') {
            return res.status(400).json({ message: 'Plagiarism check can only be done on papers with Submitted status.' });
        }

        // Save uploaded report file paths
        if (req.files?.plagiarismReport?.[0]) {
            article.plagiarismReport = req.files.plagiarismReport[0].path.replace(/\\/g, '/');
        }
        if (req.files?.aiSimilarityReport?.[0]) {
            article.aiSimilarityReport = req.files.aiSimilarityReport[0].path.replace(/\\/g, '/');
        }

        article.plagiarismPercent = plagiarismPercent ? parseFloat(plagiarismPercent) : undefined;
        article.aiSimilarityPercent = aiSimilarityPercent ? parseFloat(aiSimilarityPercent) : undefined;
        article.plagiarismRemark = remark || '';

        if (decision === 'Accept') {
            article.plagiarismDecision = 'Accepted';
            article.status = 'Plagiarism Check'; // Mark plagiarism stage complete

            // Auto-assign reviewers and advance to Reviewer 1
            try {
                const [r1List, r2List, trList] = await Promise.all([
                    User.find({ role: 'reviewer 1' }),
                    User.find({ role: 'reviewer 2' }),
                    User.find({ role: 'technical reviewer' }),
                ]);

                if (r1List.length === 1 && r2List.length === 1 && trList.length === 1) {
                    article.reviewer1 = r1List[0]._id;
                    article.reviewer2 = r2List[0]._id;
                    article.technicalReviewer = trList[0]._id;
                    article.status = 'Reviewer 1';

                    // Notify assigned reviewers
                    emailUtils.sendAssignmentEmailToReviewer(r1List[0].email, 'Reviewer 1', article.articleId, article.title);
                    emailUtils.sendAssignmentEmailToReviewer(r2List[0].email, 'Reviewer 2', article.articleId, article.title);
                    emailUtils.sendAssignmentEmailToReviewer(trList[0].email, 'Technical Reviewer', article.articleId, article.title);
                } else {
                    // If reviewers not fully set up, keep at Plagiarism Check (accepted) until assigned
                    article.status = 'Reviewer 1';
                }
            } catch (assignErr) {
                console.error('Auto-assignment after plagiarism check failed:', assignErr);
                article.status = 'Reviewer 1';
            }

            await article.save();

            // Notify author
            if (article.submittedBy?.email) {
                emailUtils.sendPlagiarismAcceptedEmail(article.submittedBy.email, article.articleId, article.title);
                notifUtils.notifyPlagiarismPassed(article.submittedBy.email, article.articleId, article.title);
                notifUtils.notifyStatusUpdate(article.submittedBy.email, article.articleId, article.title, 'Reviewer 1');
            }

            res.json({
                success: true,
                message: 'Plagiarism check accepted. Paper forwarded to reviewers.',
                status: article.status,
            });
        } else {
            // Reject
            article.plagiarismDecision = 'Rejected';
            article.status = 'Revision Required';
            await article.save();

            // Notify author
            if (article.submittedBy?.email) {
                emailUtils.sendPlagiarismRejectionEmail(article.submittedBy.email, article.articleId, article.title, remark);
                notifUtils.notifyRevisionRequired(article.submittedBy.email, article.articleId, article.title, remark);
            }

            res.json({
                success: true,
                message: 'Paper rejected. Author notified to revise and resubmit.',
                status: article.status,
            });
        }
    } catch (error) {
        console.error('Plagiarism check error:', error);
        res.status(500).json({ message: 'Server error while processing plagiarism check.' });
    }
};
