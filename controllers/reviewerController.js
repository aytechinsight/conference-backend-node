const Article = require('../models/Article');
const User = require('../models/User');
const emailUtils = require('../utils/emailUtils');
const notifUtils = require('../utils/notificationUtils');

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

// ── Review deadline: 2 minutes after first review is submitted (for testing) ──
const REVIEW_DEADLINE_MS = 2 * 60 * 1000; // 2 minutes

// ── Classify a single decision into a simple category ──
function classify(decision) {
    if (!decision) return null;
    if (decision === 'Accepted') return 'accept';
    if (decision === 'Accept with Minor Revision') return 'minor';
    if (decision === 'Accept with Major Revision') return 'major';
    if (decision === 'Reject') return 'reject';
    return null;
}

/**
 * Compute the combined review outcome given two decisions.
 *
 * Case 1: accept + accept  → Accepted         → Payment
 * Case 2: accept + minor   → Review Revision  (minor)
 * Case 3: minor  + minor   → Review Revision  (minor)
 * Case 4: minor  + major   → Review Revision  (major)
 * Case 5: accept + major   → Review Revision  (major)
 * Case 6: reject + ANY     → Reviewer Rejected (strict)
 *
 * @param {string} d1 - Reviewer 1 decision (full string)
 * @param {string} d2 - Reviewer 2 decision (full string) or null if not present
 * @param {object} r1Report - Full R1 report (for remark)
 * @param {object} r2Report - Full R2 report (for remark) or null
 * @returns {{ status, revisionDecision?, revisionRemark?, revisionStage?, rejectionStage?, rejectionRemark? }}
 */
function computeCombinedOutcome(d1, d2, r1Report, r2Report) {
    const c1 = classify(d1);
    const c2 = d2 ? classify(d2) : null;

    // Case 6: Any reject → immediate rejection
    if (c1 === 'reject') {
        return {
            status: 'Reviewer Rejected',
            rejectionStage: 'Reviewer 1',
            rejectionRemark: r1Report?.remark,
        };
    }
    if (c2 === 'reject') {
        return {
            status: 'Reviewer Rejected',
            rejectionStage: 'Reviewer 2',
            rejectionRemark: r2Report?.remark,
        };
    }

    // Case 1: both accept
    if (c1 === 'accept' && (c2 === null || c2 === 'accept')) {
        return { status: 'Accepted' };
    }

    // Case 3 or 4: minor + minor → minor; minor + major → major
    if (c1 === 'minor' && c2 === 'minor') {
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Minor Revision',
            revisionRemark: [r1Report?.remark, r2Report?.remark].filter(Boolean).join(' | '),
            revisionStage: 'Both',
        };
    }

    // Case 4: minor + major
    if ((c1 === 'minor' && c2 === 'major') || (c1 === 'major' && c2 === 'minor')) {
        const majorReport = c1 === 'major' ? r1Report : r2Report;
        const majorStage = c1 === 'major' ? 'Reviewer 1' : 'Reviewer 2';
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Major Revision',
            revisionRemark: [r1Report?.remark, r2Report?.remark].filter(Boolean).join(' | '),
            revisionStage: majorStage,
        };
    }

    // Case 2: accept + minor
    if ((c1 === 'accept' && c2 === 'minor') || (c1 === 'minor' && c2 === null)) {
        const minorReport = c1 === 'minor' ? r1Report : r2Report;
        const minorStage = c1 === 'minor' ? 'Reviewer 1' : 'Reviewer 2';
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Minor Revision',
            revisionRemark: minorReport?.remark,
            revisionStage: minorStage,
        };
    }

    // Case 5: accept + major
    if ((c1 === 'accept' && c2 === 'major') || (c1 === 'major' && c2 === null)) {
        const majorReport = c1 === 'major' ? r1Report : r2Report;
        const majorStage = c1 === 'major' ? 'Reviewer 1' : 'Reviewer 2';
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Major Revision',
            revisionRemark: majorReport?.remark,
            revisionStage: majorStage,
        };
    }

    // Minor only (no R2)
    if (c1 === 'minor' && c2 === null) {
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Minor Revision',
            revisionRemark: r1Report?.remark,
            revisionStage: 'Reviewer 1',
        };
    }

    // Major only (no R2)
    if (c1 === 'major' && c2 === null) {
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Major Revision',
            revisionRemark: r1Report?.remark,
            revisionStage: 'Reviewer 1',
        };
    }

    // Still waiting for the other reviewer
    return { status: 'Under Review' };
}

/**
 * Normalize inputs so the available decision is always in the `d1` slot.
 * This prevents `computeCombinedOutcome` from returning `Under Review` when
 * only R2 has reviewed (d1 would be null, making all conditions fail).
 */
function normalizeSingle(d1, d2, r1Report, r2Report) {
    if (d1 === null && d2 !== null) {
        // R2 reviewed, R1 didn't — swap so logic always has d1 as the present one
        return { d1: d2, d2: null, r1Report: r2Report, r2Report: null };
    }
    return { d1, d2, r1Report, r2Report };
}

/**
 * Given the article with its current reports, determine if we should finalise now.
 * Returns an outcome or null if we must keep waiting.
 */
function resolveOutcome(article) {
    const hasR2 = !!article.reviewer2;
    const r1Done = !!article.reviewer1Report?.decision;
    const r2Done = hasR2 && !!article.reviewer2Report?.decision;

    const r1Decision = article.reviewer1Report?.decision || null;
    const r2Decision = (hasR2 && article.reviewer2Report?.decision) ? article.reviewer2Report.decision : null;

    const bothDone = r1Done && (r2Done || !hasR2);

    if (bothDone) {
        // Full combination — all data available
        return computeCombinedOutcome(r1Decision, r2Decision, article.reviewer1Report, article.reviewer2Report);
    }

    // Only one of the two has reviewed — check deadline
    const now = Date.now();
    const deadlineReached = article.reviewDeadline && now >= new Date(article.reviewDeadline).getTime();

    if (deadlineReached && (r1Done || r2Done)) {
        // One reviewer done but the other hasn't reviewed within deadline → use available result
        const absentLabel = !r1Done ? 'Reviewer 1' : 'Reviewer 2';
        console.log(`[Review Deadline] Article ${article.articleId}: deadline passed, ${absentLabel} did not review. Using available review.`);

        // Normalize so the available decision is always in d1 position
        const { d1, d2, r1Report, r2Report } = normalizeSingle(r1Decision, r2Decision, article.reviewer1Report, article.reviewer2Report);
        return computeCombinedOutcome(d1, d2, r1Report, r2Report);
    }

    // Still waiting for both
    return { status: 'Under Review' };
}

// @desc  Get articles assigned to this reviewer
// @route GET /api/reviewer/articles
// @access Private (reviewer roles only)
exports.getMyAssignedArticles = async (req, res) => {
    try {
        const role = req.user.role;

        let filter = {};
        if (role === 'reviewer 1') {
            filter = { reviewer1: req.user._id };
        } else if (role === 'reviewer 2') {
            filter = { reviewer2: req.user._id };
        } else if (role === 'technical reviewer') {
            // TR only sees papers in Plagiarism Check stage assigned to them
            filter = { technicalReviewer: req.user._id, status: 'Plagiarism Check' };
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

// @desc  Submit plagiarism & AI similarity check (Technical Reviewer only)
// @route PUT /api/reviewer/articles/:id/plagiarism-check
// @access Private (technical reviewer only)
exports.submitTRPlagiarismCheck = async (req, res) => {
    try {
        if (req.user.role !== 'technical reviewer') {
            return res.status(403).json({ message: 'Only Technical Reviewers can submit plagiarism checks.' });
        }

        const { plagiarismPercent, aiSimilarityPercent, remark, decision } = req.body;

        if (!decision || !['Accept', 'Reject'].includes(decision)) {
            return res.status(400).json({ message: 'Decision must be Accept or Reject.' });
        }
        if (!req.files?.plagiarismReport?.[0]) {
            return res.status(400).json({ message: 'Plagiarism Report file is required.' });
        }
        if (!req.files?.aiSimilarityReport?.[0]) {
            return res.status(400).json({ message: 'AI Similarity Report file is required.' });
        }
        if (plagiarismPercent === undefined && plagiarismPercent !== '0') {
            return res.status(400).json({ message: 'Plagiarism % is required.' });
        }
        if (aiSimilarityPercent === undefined && aiSimilarityPercent !== '0') {
            return res.status(400).json({ message: 'AI Similarity % is required.' });
        }
        if (!remark || !remark.trim()) {
            return res.status(400).json({ message: 'Remark is required.' });
        }

        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email fullName name')
            .populate('reviewer1', 'email name fullName')
            .populate('reviewer2', 'email name fullName');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        // Verify this TR is assigned to this paper
        if (String(article.technicalReviewer) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You are not assigned as Technical Reviewer for this paper.' });
        }

        if (article.status !== 'Plagiarism Check') {
            return res.status(400).json({ message: 'This paper is not currently in Plagiarism Check stage.' });
        }

        // Save uploaded report paths
        article.plagiarismReport = req.files.plagiarismReport[0].path.replace(/\\/g, '/');
        article.aiSimilarityReport = req.files.aiSimilarityReport[0].path.replace(/\\/g, '/');
        article.plagiarismPercent = plagiarismPercent !== undefined ? parseFloat(plagiarismPercent) : undefined;
        article.aiSimilarityPercent = aiSimilarityPercent !== undefined ? parseFloat(aiSimilarityPercent) : undefined;
        article.plagiarismRemark = remark.trim();

        if (decision === 'Accept') {
            article.plagiarismDecision = 'Accepted';
            article.status = 'Under Review';
            // Reset review deadline flags for this round
            article.reviewDeadline = undefined;
            article.reviewDeadlineTriggered = false;
            await article.save();

            // Notify Reviewer 1 — they can now start their independent review
            if (article.reviewer1?.email) {
                emailUtils.sendAssignmentEmailToReviewer(article.reviewer1.email, 'Reviewer 1', article.articleId, article.title);
                notifUtils.notifyReviewerTurn(article.reviewer1.email, 'Reviewer 1', article.articleId, article.title);
            }
            // Notify Reviewer 2 if assigned — they can also start immediately
            if (article.reviewer2?.email) {
                emailUtils.sendAssignmentEmailToReviewer(article.reviewer2.email, 'Reviewer 2', article.articleId, article.title);
                notifUtils.notifyReviewerTurn(article.reviewer2.email, 'Reviewer 2', article.articleId, article.title);
            }
            // Notify author
            if (article.submittedBy?.email) {
                emailUtils.sendPlagiarismAcceptedEmail(article.submittedBy.email, article.articleId, article.title);
                notifUtils.notifyPlagiarismPassed(article.submittedBy.email, article.articleId, article.title);
                notifUtils.notifyStatusUpdate(article.submittedBy.email, article.articleId, article.title, 'Under Review');
            }

            return res.json({
                success: true,
                message: 'Plagiarism check accepted. Paper moved to Under Review. Both reviewers can now review independently.',
                status: article.status,
            });
        } else {
            // Reject — author must revise and resubmit
            article.plagiarismDecision = 'Rejected';
            article.status = 'Revision Required';
            await article.save();

            if (article.submittedBy?.email) {
                emailUtils.sendPlagiarismRejectionEmail(article.submittedBy.email, article.articleId, article.title, remark.trim());
                notifUtils.notifyRevisionRequired(article.submittedBy.email, article.articleId, article.title, remark.trim());
            }

            return res.json({
                success: true,
                message: 'Plagiarism check rejected. Author notified to revise and resubmit.',
                status: article.status,
            });
        }
    } catch (error) {
        console.error('TR plagiarism check error:', error);
        res.status(500).json({ message: 'Server error while processing plagiarism check.' });
    }
};

// @desc  Submit a review with scoring and decision (Reviewer 1 & 2 only — INDEPENDENT, no locking)
// @route PUT /api/reviewer/articles/:id/review
// @access Private (reviewer 1 / reviewer 2 only)
exports.submitReview = async (req, res) => {
    try {
        const role = req.user.role;

        if (role === 'technical reviewer') {
            return res.status(403).json({ message: 'Technical Reviewers submit plagiarism checks, not review scores. Use the plagiarism check endpoint.' });
        }

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
                return res.status(400).json({ message: `Invalid or missing score for: ${field}` });
            }
        }

        // ── Validate remark ──
        if (!remark || !remark.trim()) {
            return res.status(400).json({ message: 'Reviewer remark is required.' });
        }

        const article = await Article.findById(req.params.id)
            .populate('submittedBy', 'email fullName name');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Under Review') {
            return res.status(400).json({ message: 'This paper is not currently in Under Review stage.' });
        }

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
            if (article.reviewer1Report?.decision) {
                return res.status(400).json({ message: 'You have already submitted a review for this paper.' });
            }
            article.reviewer1Report = reviewReport;

            // If R2 is assigned and hasn't reviewed yet, set the review deadline now
            if (article.reviewer2 && !article.reviewer2Report?.decision && !article.reviewDeadline) {
                article.reviewDeadline = new Date(Date.now() + REVIEW_DEADLINE_MS);
                console.log(`[Review Deadline] Article ${article.articleId}: R1 reviewed. R2 has until ${article.reviewDeadline.toISOString()} to review.`);
            }

            // ── Reviewer 2 ──
        } else if (role === 'reviewer 2') {
            if (String(article.reviewer2) !== String(req.user._id) &&
                String(article.reviewer2?._id) !== String(req.user._id)) {
                return res.status(403).json({ message: 'You are not assigned as Reviewer 2 for this paper.' });
            }
            if (article.reviewer2Report?.decision) {
                return res.status(400).json({ message: 'You have already submitted a review for this paper.' });
            }
            article.reviewer2Report = reviewReport;

            // If R1 hasn't reviewed yet, set deadline for R1
            if (!article.reviewer1Report?.decision && !article.reviewDeadline) {
                article.reviewDeadline = new Date(Date.now() + REVIEW_DEADLINE_MS);
                console.log(`[Review Deadline] Article ${article.articleId}: R2 reviewed first. R1 has until ${article.reviewDeadline.toISOString()} to review.`);
            }

        } else {
            return res.status(403).json({ message: 'Not a reviewer role.' });
        }

        // ── Resolve the combined outcome ──
        const outcome = resolveOutcome(article);
        article.status = outcome.status;

        if (outcome.status === 'Reviewer Rejected') {
            article.reviewRejectionStage = outcome.rejectionStage;
            article.reviewRejectionRemark = outcome.rejectionRemark;
            article.reviewRevisionStage = undefined;
            article.reviewRevisionRemark = undefined;
            article.reviewRevisionDecision = undefined;
            await article.save();

            if (article.submittedBy?.email) {
                emailUtils.sendReviewRejectionEmail(article.submittedBy.email, article.articleId, article.title, outcome.rejectionRemark);
                notifUtils.notifyReviewRejection(article.submittedBy.email, article.articleId, article.title, outcome.rejectionRemark);
            }

        } else if (outcome.status === 'Review Revision') {
            article.reviewRevisionStage = outcome.revisionStage;
            article.reviewRevisionRemark = outcome.revisionRemark;
            article.reviewRevisionDecision = outcome.revisionDecision;
            await article.save();

            if (article.submittedBy?.email) {
                emailUtils.sendReviewRevisionEmail(article.submittedBy.email, article.articleId, article.title, outcome.revisionDecision, outcome.revisionRemark);
                notifUtils.notifyReviewRevision(article.submittedBy.email, article.articleId, article.title, outcome.revisionDecision, outcome.revisionRemark);
            }

        } else if (outcome.status === 'Accepted') {
            await article.save();

            if (article.submittedBy?.email) {
                emailUtils.sendFinalAcceptanceEmail(article.submittedBy.email, article.articleId, article.title);
                notifUtils.notifyFinalAcceptance(article.submittedBy.email, article.articleId, article.title);
            }
            notifUtils.notifySuperadminPaperAccepted(article.articleId, article.title);

        } else {
            // Still Under Review — waiting for the other reviewer
            await article.save();
        }

        const waitingForOther = outcome.status === 'Under Review';
        const waitMsg = waitingForOther
            ? `. Waiting for the other reviewer. They have until ${article.reviewDeadline ? new Date(article.reviewDeadline).toLocaleTimeString() : 'TBD'} to submit.`
            : '';

        res.json({
            success: true,
            message: `Review submitted. Your decision: ${decision}. Paper status: ${article.status}${waitMsg}`,
            status: article.status,
            reviewDeadline: article.reviewDeadline,
        });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ message: 'Server error while submitting review.' });
    }
};
