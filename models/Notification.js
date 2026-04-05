const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Short label for icon selection on the frontend
    type: {
        type: String,
        enum: [
            'submitted',
            'plagiarism_check',
            'revision_required',     // plagiarism fail
            'plagiarism_passed',
            'reviewer_1',
            'reviewer_2',
            'technical_reviewer',
            'review_revision',       // reviewer asked for changes
            'reviewer_rejected',     // hard reject by reviewer
            'reviewer_assigned',     // paper assigned to reviewer
            'paper_resubmitted',     // revised paper resubmitted to reviewer
            'review_completed',      // a reviewer completed their review
            'new_submission',        // new paper submitted (for superadmin)
            'accepted',
            'payment',
            'published',
            'certificate',
            'general',
        ],
        default: 'general',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    articleId: { type: String },      // e.g. ICREATE2026-USR001-ART-001
    articleTitle: { type: String },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
