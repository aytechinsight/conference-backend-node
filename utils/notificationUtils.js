/**
 * notificationUtils.js
 * Creates in-app notifications in MongoDB for the author.
 * Called alongside emailUtils at every status change point.
 */

const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create a notification for a user identified by their email address.
 * Silently swallows errors so a notification failure never breaks the main flow.
 */
const createNotificationForEmail = async (email, { type, title, message, articleId, articleTitle }) => {
    try {
        const user = await User.findOne({ email }).select('_id').lean();
        if (!user) return;
        await Notification.create({
            user: user._id,
            type,
            title,
            message,
            articleId,
            articleTitle,
        });
    } catch (err) {
        console.error('Failed to create notification:', err.message);
    }
};

/**
 * Create a notification directly by user _id (used when we already resolved the user).
 */
const createNotificationForUser = async (userId, { type, title, message, articleId, articleTitle }) => {
    try {
        await Notification.create({
            user: userId,
            type,
            title,
            message,
            articleId,
            articleTitle,
        });
    } catch (err) {
        console.error('Failed to create notification:', err.message);
    }
};

// ── Typed helpers matching every emailUtils function ──

exports.notifySubmitted = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'submitted',
        title: 'Paper Submitted',
        message: `Your paper "${articleTitle}" (${articleId}) has been successfully submitted and is awaiting admin review.`,
        articleId, articleTitle,
    });

exports.notifyPlagiarismCheck = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'plagiarism_check',
        title: 'Plagiarism Check Started',
        message: `Your paper "${articleTitle}" (${articleId}) is now undergoing plagiarism and AI similarity checks.`,
        articleId, articleTitle,
    });

exports.notifyPlagiarismPassed = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'plagiarism_passed',
        title: 'Plagiarism Check Passed ✅',
        message: `Your paper "${articleTitle}" (${articleId}) has passed the plagiarism check and has been forwarded to the review panel.`,
        articleId, articleTitle,
    });

exports.notifyRevisionRequired = (email, articleId, articleTitle, remark) =>
    createNotificationForEmail(email, {
        type: 'revision_required',
        title: 'Revision Required',
        message: `Your paper "${articleTitle}" (${articleId}) requires revision after the plagiarism check. Remark: "${remark || 'See dashboard for details'}". Please resubmit a revised version.`,
        articleId, articleTitle,
    });

exports.notifyReviewerAssigned = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'reviewer_1',
        title: 'Paper Under Review',
        message: `Your paper "${articleTitle}" (${articleId}) has been assigned to reviewers and the review process has begun.`,
        articleId, articleTitle,
    });

exports.notifyStatusUpdate = (email, articleId, articleTitle, newStatus) => {
    const typeMap = {
        'Reviewer 1': 'reviewer_1',
        'Reviewer 2': 'reviewer_2',
        'Technical Reviewer': 'technical_reviewer',
        'Accepted': 'accepted',
        'Payment': 'payment',
        'Published': 'published',
    };
    return createNotificationForEmail(email, {
        type: typeMap[newStatus] || 'general',
        title: `Status Update: ${newStatus}`,
        message: `Your paper "${articleTitle}" (${articleId}) has advanced to the "${newStatus}" stage.`,
        articleId, articleTitle,
    });
};

exports.notifyReviewRevision = (email, articleId, articleTitle, decision, remark) =>
    createNotificationForEmail(email, {
        type: 'review_revision',
        title: `Revision Requested — ${decision}`,
        message: `A reviewer has requested changes for your paper "${articleTitle}" (${articleId}). Decision: ${decision}. Remark: "${remark || 'See dashboard for details'}". Please upload a revised version.`,
        articleId, articleTitle,
    });

exports.notifyReviewRejection = (email, articleId, articleTitle, remark) =>
    createNotificationForEmail(email, {
        type: 'reviewer_rejected',
        title: 'Paper Rejected by Reviewer',
        message: `Your paper "${articleTitle}" (${articleId}) was rejected during review. Remark: "${remark || 'See dashboard for details'}". You may resubmit a fresh version.`,
        articleId, articleTitle,
    });

exports.notifyFinalAcceptance = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'accepted',
        title: '🎉 Paper Accepted!',
        message: `Congratulations! Your paper "${articleTitle}" (${articleId}) has been accepted after completing all review stages. Please proceed with the registration payment.`,
        articleId, articleTitle,
    });

exports.notifyPaymentVerified = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'payment',
        title: 'Payment Verified ✅',
        message: `Your payment for paper "${articleTitle}" (${articleId}) has been verified. A receipt has been sent to your email.`,
        articleId, articleTitle,
    });

exports.notifyCertificateReady = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'certificate',
        title: '🏅 Certificate & Publication Ready',
        message: `Your certificate and publication details for "${articleTitle}" (${articleId}) are now available in your dashboard.`,
        articleId, articleTitle,
    });

exports.notifyPublished = (email, articleId, articleTitle) =>
    createNotificationForEmail(email, {
        type: 'published',
        title: '📖 Paper Published!',
        message: `Your paper "${articleTitle}" (${articleId}) has been officially published. View the publication link from your dashboard.`,
        articleId, articleTitle,
    });

// Also export the by-userId version for any place that has userId directly
exports.createNotificationForUser = createNotificationForUser;

// ═══════════════════════════════════════════════════════════
// Reviewer-facing notifications (paper assigned, resubmitted, etc.)
// ═══════════════════════════════════════════════════════════

/**
 * Notify a reviewer that a paper has been assigned to them.
 * @param {string} reviewerEmail — the reviewer's email
 * @param {string} roleLabel — "Reviewer 1", "Reviewer 2", or "Technical Reviewer"
 */
exports.notifyReviewerPaperAssigned = (reviewerEmail, roleLabel, articleId, articleTitle) =>
    createNotificationForEmail(reviewerEmail, {
        type: 'reviewer_assigned',
        title: `📋 New Paper Assigned`,
        message: `You have been assigned as ${roleLabel} for paper "${articleTitle}" (${articleId}). Please log in to your dashboard to review it.`,
        articleId, articleTitle,
    });

/**
 * Notify a reviewer that the author has resubmitted a revised paper back to their stage.
 */
exports.notifyReviewerPaperResubmitted = (reviewerEmail, roleLabel, articleId, articleTitle) =>
    createNotificationForEmail(reviewerEmail, {
        type: 'paper_resubmitted',
        title: `🔄 Revised Paper Resubmitted`,
        message: `The author of "${articleTitle}" (${articleId}) has uploaded a revised version. As ${roleLabel}, please re-review the paper from your dashboard.`,
        articleId, articleTitle,
    });

/**
 * Notify the next reviewer in the chain that it's their turn.
 * e.g. Reviewer 1 → Accepted → notify Reviewer 2
 */
exports.notifyReviewerTurn = (reviewerEmail, roleLabel, articleId, articleTitle) =>
    createNotificationForEmail(reviewerEmail, {
        type: 'reviewer_assigned',
        title: `📥 Paper Ready for Your Review`,
        message: `Paper "${articleTitle}" (${articleId}) has passed the previous review stage and is now awaiting your review as ${roleLabel}.`,
        articleId, articleTitle,
    });

// ═══════════════════════════════════════════════════════════
// Superadmin notifications (new submissions, payments, etc.)
// ═══════════════════════════════════════════════════════════

/**
 * Notify all superadmins that a new paper was submitted.
 */
exports.notifySuperadminNewSubmission = async (articleId, articleTitle, authorName) => {
    try {
        const superadmins = await User.find({ role: 'superadmin' }).select('_id').lean();
        for (const sa of superadmins) {
            await createNotificationForUser(sa._id, {
                type: 'new_submission',
                title: '📄 New Paper Submitted',
                message: `${authorName || 'An author'} submitted a new paper: "${articleTitle}" (${articleId}). It's ready for plagiarism check.`,
                articleId, articleTitle,
            });
        }
    } catch (err) {
        console.error('Failed to notify superadmins:', err.message);
    }
};

/**
 * Notify all superadmins that a payment was completed.
 */
exports.notifySuperadminPaymentReceived = async (articleId, articleTitle, authorName) => {
    try {
        const superadmins = await User.find({ role: 'superadmin' }).select('_id').lean();
        for (const sa of superadmins) {
            await createNotificationForUser(sa._id, {
                type: 'payment',
                title: '💰 Payment Received',
                message: `${authorName || 'An author'} has completed payment for "${articleTitle}" (${articleId}).`,
                articleId, articleTitle,
            });
        }
    } catch (err) {
        console.error('Failed to notify superadmins:', err.message);
    }
};

/**
 * Notify all superadmins that a paper was accepted (all review stages passed).
 */
exports.notifySuperadminPaperAccepted = async (articleId, articleTitle) => {
    try {
        const superadmins = await User.find({ role: 'superadmin' }).select('_id').lean();
        for (const sa of superadmins) {
            await createNotificationForUser(sa._id, {
                type: 'accepted',
                title: '✅ Paper Accepted',
                message: `Paper "${articleTitle}" (${articleId}) has passed all review stages and is now accepted. Awaiting author payment.`,
                articleId, articleTitle,
            });
        }
    } catch (err) {
        console.error('Failed to notify superadmins:', err.message);
    }
};
