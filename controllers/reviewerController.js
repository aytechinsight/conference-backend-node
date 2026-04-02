const Article = require('../models/Article');
const User = require('../models/User');
const emailUtils = require('../utils/emailUtils');

const SCORE_FIELDS = [
    'abstractQuality',
    'originalityNovelty',
    'technicalMethodology',
    'experimentalResults',
    'technicalDiscussion',
    'figureTableQuality',
    'referenceQuality',
    'languageFormatting',
    'innovationClarity',
    'conclusionStrength',
];

const VALID_SCORES = ['Excellent', 'Good', 'Fair', 'Poor'];
const VALID_DECISIONS = ['Accepted', 'Accept with Minor Revision', 'Accept with Major Revision', 'Reject'];

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

// @desc  Submit a review with scoring and decision
// @route PUT /api/reviewer/articles/:id/review
// @access Private (reviewer roles only)
exports.submitReview = async (req, res) => {
    try {
        const role = req.user.role;
        const { scores, remark, decision } = req.body;

        // ── Validate decision ──
        if (!decision || !VALID_DECISIONS.includes(decision)) {
            return res.status(400).json({ message: `Invalid decision. Must be one of: ${VALID_DECISIONS.join(', ')}` });
        }

        // ── Validate scores ──
        if (!scores || typeof scores !== 'object') {
            return res.status(400).json({ message: 'Scores are required.' });
        }
        for (const field of SCORE_FIELDS) {
            if (!scores[field] || !VALID_SCORES.includes(scores[field])) {
                return res.status(400).json({ message: `Invalid or missing score for: ${field}. Must be one of: ${VALID_SCORES.join(', ')}` });
            }
        }

        // ── Validate remark ──
        if (!remark || !remark.trim()) {
            return res.status(400).json({ message: 'Reviewer remark is required.' });
        }

        // ── Load article ──
        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email fullName name')
            .populate('reviewer2', 'email name fullName')
            .populate('technicalReviewer', 'email name fullName');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        // Build the review report object
        const reviewReport = {
            scores,
            remark: remark.trim(),
            decision,
            reviewedAt: new Date(),
        };

        // ── Reviewer 1 ──
        if (role === 'reviewer 1') {
            if (String(article.reviewer1) !== String(req.user._id) &&
                String(article.reviewer1?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Reviewer 1 for this paper.' });
            }
            if (article.status !== 'Reviewer 1') {
                return res.status(400).json({ message: 'This paper is not currently in Reviewer 1 stage.' });
            }

            article.reviewer1Report = reviewReport;

            if (decision === 'Accepted') {
                article.status = 'Reviewer 2';
                await article.save();

                // Notify Reviewer 2
                if (article.reviewer2?.email) {
                    emailUtils.sendAssignmentEmailToReviewer(article.reviewer2.email, 'Reviewer 2', article.articleId, article.title);
                }
                // Notify Author
                if (article.submittedBy?.email) {
                    emailUtils.sendStatusUpdateEmailToAuthor(article.submittedBy.email, article.articleId, article.title, 'Reviewer 2');
                }
            } else if (decision === 'Accept with Minor Revision' || decision === 'Accept with Major Revision') {
                article.status = 'Review Revision';
                article.reviewRevisionStage = 'Reviewer 1';
                article.reviewRevisionRemark = remark.trim();
                article.reviewRevisionDecision = decision;
                await article.save();

                // Notify author to revise
                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRevisionEmail(article.submittedBy.email, article.articleId, article.title, decision, remark.trim());
                }
            } else if (decision === 'Reject') {
                // Move to 'Reviewer Rejected' — user must resubmit fresh content on same ID
                article.status = 'Reviewer Rejected';
                article.reviewRejectionStage = 'Reviewer 1';
                article.reviewRejectionRemark = remark.trim();
                // Clear any in-progress revision fields
                article.reviewRevisionStage = undefined;
                article.reviewRevisionRemark = undefined;
                article.reviewRevisionDecision = undefined;
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRejectionEmail(article.submittedBy.email, article.articleId, article.title, remark.trim());
                }
            }

        // ── Reviewer 2 ──
        } else if (role === 'reviewer 2') {
            if (String(article.reviewer2) !== String(req.user._id) &&
                String(article.reviewer2?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Reviewer 2 for this paper.' });
            }
            if (article.status !== 'Reviewer 2') {
                return res.status(400).json({ message: 'This paper is not currently in Reviewer 2 stage.' });
            }

            article.reviewer2Report = reviewReport;

            if (decision === 'Accepted') {
                article.status = 'Technical Reviewer';
                await article.save();

                // Notify Technical Reviewer
                if (article.technicalReviewer?.email) {
                    emailUtils.sendAssignmentEmailToReviewer(article.technicalReviewer.email, 'Technical Reviewer', article.articleId, article.title);
                }
                if (article.submittedBy?.email) {
                    emailUtils.sendStatusUpdateEmailToAuthor(article.submittedBy.email, article.articleId, article.title, 'Technical Reviewer');
                }
            } else if (decision === 'Accept with Minor Revision' || decision === 'Accept with Major Revision') {
                article.status = 'Review Revision';
                article.reviewRevisionStage = 'Reviewer 2';
                article.reviewRevisionRemark = remark.trim();
                article.reviewRevisionDecision = decision;
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRevisionEmail(article.submittedBy.email, article.articleId, article.title, decision, remark.trim());
                }
            } else if (decision === 'Reject') {
                // Move to 'Reviewer Rejected' — user must resubmit fresh content on same ID
                article.status = 'Reviewer Rejected';
                article.reviewRejectionStage = 'Reviewer 2';
                article.reviewRejectionRemark = remark.trim();
                article.reviewRevisionStage = undefined;
                article.reviewRevisionRemark = undefined;
                article.reviewRevisionDecision = undefined;
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRejectionEmail(article.submittedBy.email, article.articleId, article.title, remark.trim());
                }
            }

        // ── Technical Reviewer ──
        } else if (role === 'technical reviewer') {
            if (String(article.technicalReviewer) !== String(req.user._id) &&
                String(article.technicalReviewer?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Technical Reviewer for this paper.' });
            }
            if (article.status !== 'Technical Reviewer') {
                return res.status(400).json({ message: 'This paper is not currently in Technical Reviewer stage.' });
            }

            article.technicalReviewerReport = reviewReport;

            if (decision === 'Accepted') {
                article.status = 'Accepted';
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendFinalAcceptanceEmail(article.submittedBy.email, article.articleId, article.title);
                }
            } else if (decision === 'Accept with Minor Revision' || decision === 'Accept with Major Revision') {
                article.status = 'Review Revision';
                article.reviewRevisionStage = 'Technical Reviewer';
                article.reviewRevisionRemark = remark.trim();
                article.reviewRevisionDecision = decision;
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRevisionEmail(article.submittedBy.email, article.articleId, article.title, decision, remark.trim());
                }
            } else if (decision === 'Reject') {
                // Move to 'Reviewer Rejected' — user must resubmit fresh content on same ID
                article.status = 'Reviewer Rejected';
                article.reviewRejectionStage = 'Technical Reviewer';
                article.reviewRejectionRemark = remark.trim();
                article.reviewRevisionStage = undefined;
                article.reviewRevisionRemark = undefined;
                article.reviewRevisionDecision = undefined;
                await article.save();

                if (article.submittedBy?.email) {
                    emailUtils.sendReviewRejectionEmail(article.submittedBy.email, article.articleId, article.title, remark.trim());
                }
            }

        } else {
            return res.status(403).json({ message: 'Not a reviewer role.' });
        }

        res.json({
            success: true,
            message: `Review submitted successfully. Decision: ${decision}. New status: ${article.status}`,
            status: article.status,
        });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ message: 'Server error while submitting review.' });
    }
};
