const mongoose = require('mongoose');
const { getNextSequence } = require('./Counter');

// Review report schema — reusable for each reviewer stage
const ReviewReportSchema = new mongoose.Schema({
    scores: {
        abstractQuality: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        originalityNovelty: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        technicalMethodology: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        experimentalResults: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        technicalDiscussion: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        figureTableQuality: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        referenceQuality: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        languageFormatting: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        innovationClarity: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        conclusionStrength: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
    },
    remark: { type: String },
    decision: {
        type: String,
        enum: ['Accepted', 'Accept with Minor Revision', 'Accept with Major Revision', 'Reject'],
    },
    reviewedAt: { type: Date },
}, { _id: false });

const ArticleSchema = new mongoose.Schema({
    articleId: {
        type: String,
        unique: true,
    },
    title: {
        type: String,
        required: [true, 'Please add an article title'],
        trim: true,
    },
    correspondingAuthor: {
        name: { type: String, required: true },
        email: { type: String, required: true },
    },
    numberOfAuthors: {
        type: Number,
        required: [true, 'Please specify the number of authors'],
        min: 1,
    },
    authors: [{
        name: { type: String, required: true },
        email: { type: String, required: true },
    }],
    paperFile: {
        type: String,
        required: [true, 'Please upload a paper file'],
    },
    originalFileName: {
        type: String,
    },
    plagiarismDeclared: {
        type: Boolean,
        required: true,
        validate: {
            validator: function (v) { return v === true; },
            message: 'You must accept the plagiarism declaration',
        },
    },
    status: {
        type: String,
        enum: ['Submitted', 'Plagiarism Check', 'Revision Required', 'Reviewer 1', 'Reviewer 2', 'Technical Reviewer', 'Review Revision', 'Reviewer Rejected', 'Accepted', 'Payment', 'Published'],
        default: 'Submitted',
    },
    // Plagiarism check fields (filled by admin)
    plagiarismReport: { type: String },
    plagiarismPercent: { type: Number },
    aiSimilarityReport: { type: String },
    aiSimilarityPercent: { type: Number },
    plagiarismRemark: { type: String },
    plagiarismDecision: {
        type: String,
        enum: ['Accepted', 'Rejected'],
    },
    // Revision history (stores previous submissions when paper is rejected & resubmitted)
    revisionHistory: [{
        paperFile: String,
        originalFileName: String,
        plagiarismReport: String,
        plagiarismPercent: Number,
        aiSimilarityReport: String,
        aiSimilarityPercent: Number,
        plagiarismRemark: String,
        plagiarismDecision: String,
        resubmittedAt: { type: Date, default: Date.now },
    }],
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reviewer1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewer2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    technicalReviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // ── Review Reports ──
    reviewer1Report: ReviewReportSchema,
    reviewer2Report: ReviewReportSchema,
    technicalReviewerReport: ReviewReportSchema,

    // Track which reviewer stage sent the paper back for revision
    reviewRevisionStage: {
        type: String,
        enum: ['Reviewer 1', 'Reviewer 2', 'Technical Reviewer'],
    },
    reviewRevisionRemark: { type: String },
    reviewRevisionDecision: { type: String },

    // ── Reviewer Rejection (hard reject by a reviewer) ──
    reviewRejectionStage: {
        type: String,
        enum: ['Reviewer 1', 'Reviewer 2', 'Technical Reviewer'],
    },
    reviewRejectionRemark: { type: String },

    // Revised paper for reviewer revisions
    revisedPaperFile: { type: String },
    revisedPaperOriginalName: { type: String },

    // ── Payment fields ──
    selectedPlan: { type: String }, // e.g. "Peer Reviewed Journal - Indian", "Scopus Student - Indian", etc.
    paymentAmount: { type: Number },
    paymentCurrency: { type: String, default: 'INR' },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed'],
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },

    // ── Certificate & Publication fields ──
    certificateFile: { type: String },        // relative path to uploaded certificate file
    publicationLink: { type: String },        // DOI / journal URL for published paper
    certificateAttachedAt: { type: Date },    // when superadmin uploaded cert/link
    certificateSentAt: { type: Date },        // when superadmin manually sent to author
}, { timestamps: true });

// Auto-generate articleId before saving (atomic — no race conditions)
ArticleSchema.pre('save', async function () {
    if (this.articleId) return;

    const currentYear = new Date().getFullYear();

    // Resolve the submitting user's userId (e.g. USR001)
    let userSegment = 'USR000';
    if (this.submittedBy) {
        try {
            const User = mongoose.model('User');
            const author = await User.findById(this.submittedBy).select('userId').lean();
            if (author?.userId) {
                userSegment = author.userId;
            }
        } catch (_) { /* fallback to USR000 */ }
    }

    // Atomically get the next article sequence number for this year
    const counterKey = `article_counter_${currentYear}`;
    const nextNum = await getNextSequence(counterKey);

    // Format: ICREATE2026-USR001-ART-001
    this.articleId = `ICREATE${currentYear}-${userSegment}-ART-${String(nextNum).padStart(3, '0')}`;
});

module.exports = mongoose.model('Article', ArticleSchema);
