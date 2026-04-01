const mongoose = require('mongoose');

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
        enum: ['Submitted', 'Plagiarism Check', 'Revision Required', 'Reviewer 1', 'Reviewer 2', 'Technical Reviewer', 'Review Revision', 'Accepted', 'Payment', 'Published'],
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
}, { timestamps: true });

// Auto-generate articleId before saving
ArticleSchema.pre('save', async function () {
    if (this.articleId) return;

    const currentYear = new Date().getFullYear();
    const prefix = `ICREATE${currentYear}-ART-`;

    // Find the latest article for this year
    const latestArticle = await mongoose.model('Article')
        .findOne({ articleId: { $regex: `^${prefix}` } })
        .sort({ articleId: -1 })
        .lean();

    let nextNum = 1;
    if (latestArticle) {
        const lastNum = parseInt(latestArticle.articleId.split('-').pop(), 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    this.articleId = `${prefix}${String(nextNum).padStart(3, '0')}`;
});

module.exports = mongoose.model('Article', ArticleSchema);
