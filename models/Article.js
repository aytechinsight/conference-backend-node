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

    // ── New Flow Status ──
    // Submitted → Plagiarism Check (TR) → Under Review (R1 + optional R2 independently)
    //   → Review Revision / Reviewer Rejected / Accepted → Payment → Published
    //   Plagiarism Check failure → Revision Required → resubmit → Plagiarism Check
    status: {
        type: String,
        enum: [
            'Submitted',
            'Plagiarism Check',   // Technical Reviewer is doing plagiarism check
            'Revision Required',  // Plagiarism rejected — author must resubmit
            'Under Review',       // R1 (and optional R2) reviewing independently
            'Review Revision',    // At least one reviewer requested revision
            'Reviewer Rejected',  // A reviewer hard-rejected
            'Accepted',
            'Payment',
            'Published',
        ],
        default: 'Submitted',
    },

    // ── Plagiarism check fields (filled by Technical Reviewer) ──
    plagiarismReport: { type: String },
    plagiarismPercent: { type: Number },
    aiSimilarityReport: { type: String },
    aiSimilarityPercent: { type: Number },
    plagiarismRemark: { type: String },
    plagiarismDecision: {
        type: String,
        enum: ['Accepted', 'Rejected'],
    },

    // Revision history (stores previous submissions when paper is plagiarism-rejected & resubmitted)
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
        // Optional — assigned only for papers with high load or multiple review tracks
    },
    technicalReviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Does plagiarism & similarity check ONLY — no content review
    },

    // ── Review Reports (Reviewer 1 & 2 only — TR does not fill review scores) ──
    reviewer1Report: ReviewReportSchema,
    reviewer2Report: ReviewReportSchema,

    // ── Track which reviewer requested revision ──
    reviewRevisionStage: {
        type: String,
        // Supports 'Reviewer 1', 'Reviewer 2', or 'Both'
    },
    reviewRevisionRemark: { type: String },
    reviewRevisionDecision: { type: String },

    // ── Reviewer Rejection (hard reject) ──
    reviewRejectionStage: {
        type: String,
    },
    reviewRejectionRemark: { type: String },

    // Revised paper for reviewer revisions
    revisedPaperFile: { type: String },
    revisedPaperOriginalName: { type: String },

    // ── Reviewer Revision Cycle History ──
    reviewerRevisionHistory: [{
        stage: { type: String },    // 'Reviewer 1' | 'Reviewer 2'
        decision: { type: String },
        remark: { type: String },
        scores: {
            abstractQuality: String,
            originalityNovelty: String,
            technicalMethodology: String,
            experimentalResults: String,
            technicalDiscussion: String,
            figureTableQuality: String,
            referenceQuality: String,
            languageFormatting: String,
            innovationClarity: String,
            conclusionStrength: String,
        },
        reviewedAt: { type: Date },
        originalPaperFile: { type: String },
        originalFileName: { type: String },
        revisedPaperFile: { type: String },
        revisedPaperOriginalName: { type: String },
        revisedAt: { type: Date },
    }],

    // ── Submission country & plan selection (set at submission time) ──
    country: { type: String },              // e.g. "India" or "United States"
    submissionPlanKey: { type: String },    // e.g. "Scopus Student - Indian"

    // ── Reapplication flag (set when user resubmits after Reviewer Rejected) ──
    reappliedFromRejection: { type: Boolean, default: false },

    // ── Review deadline (set when first reviewer submits; if R2 hasn't reviewed by then, R1 result is used) ──
    reviewDeadline: { type: Date },
    reviewDeadlineTriggered: { type: Boolean, default: false },

    // ── Payment fields ──
    selectedPlan: { type: String },
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
    // Per-author certificates — one cert file per author
    authorCertificates: [{
        authorName: { type: String },
        authorEmail: { type: String },
        certificateFile: { type: String },   // relative path, e.g. uploads/certificates/cert_xxx.pdf
        uploadedAt: { type: Date },
        sentAt: { type: Date },
    }],
    publicationLink: { type: String },       // DOI / journal URL for the paper (shared)
    certificateAttachedAt: { type: Date },   // when any cert/link was last attached
    certificateSentAt: { type: Date },       // when certs were last emailed to authors
}, { timestamps: true });

// Auto-generate articleId before saving (atomic — no race conditions)
ArticleSchema.pre('save', async function () {
    if (this.articleId) return;

    const currentYear = new Date().getFullYear();

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

    const counterKey = `article_counter_${currentYear}`;
    const nextNum = await getNextSequence(counterKey);

    this.articleId = `ICREATE${currentYear}-${userSegment}-ART-${String(nextNum).padStart(3, '0')}`;
});

module.exports = mongoose.model('Article', ArticleSchema);
