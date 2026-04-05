const Article = require('../models/Article');
const User = require('../models/User');
const emailUtils = require('../utils/emailUtils');
const notifUtils = require('../utils/notificationUtils');
const path = require('path');
const fs = require('fs');

// @desc Submit a new article
// @route POST /api/articles
// @access Private
exports.submitArticle = async (req, res) => {
    try {
        const { title, correspondingAuthorName, numberOfAuthors, authors, plagiarismDeclared } = req.body;

        // Validation
        if (!title || !correspondingAuthorName || !numberOfAuthors || !authors || !plagiarismDeclared) {
            // Clean up uploaded file if validation fails
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a paper file (PDF/DOC/DOCX).' });
        }

        // Parse authors if sent as JSON string
        let parsedAuthors;
        try {
            parsedAuthors = typeof authors === 'string' ? JSON.parse(authors) : authors;
        } catch {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Invalid authors data format.' });
        }

        // Validate each author has name and email
        if (!Array.isArray(parsedAuthors) || parsedAuthors.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Please provide at least one author with name and email.' });
        }

        for (const author of parsedAuthors) {
            if (!author.name || !author.email) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Each author must have a name and email address.' });
            }
        }

        const article = await Article.create({
            title,
            correspondingAuthor: {
                name: correspondingAuthorName,
                email: req.user.email,
            },
            numberOfAuthors: parseInt(numberOfAuthors, 10),
            authors: parsedAuthors,
            paperFile: req.file.path.replace(/\\/g, '/'),
            originalFileName: req.file.originalname,
            plagiarismDeclared: plagiarismDeclared === 'true' || plagiarismDeclared === true,
            submittedBy: req.user._id,
        });

        // In-app notification — paper submitted
        notifUtils.notifySubmitted(req.user.email, article.articleId, article.title);
        // Notify superadmins of new submission
        notifUtils.notifySuperadminNewSubmission(article.articleId, article.title, req.user.fullName || req.user.name);

        res.status(201).json({
            success: true,
            message: 'Article submitted successfully!',
            article: {
                articleId: article.articleId,
                title: article.title,
                status: article.status,
                correspondingAuthor: article.correspondingAuthor,
                numberOfAuthors: article.numberOfAuthors,
                authors: article.authors,
                originalFileName: article.originalFileName,
                createdAt: article.createdAt,
            },
        });
    } catch (error) {
        console.error('Submit article error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ message: 'Server error while submitting article.' });
    }
};

// @desc Get all articles for the logged-in user
// @route GET /api/articles/my
// @access Private
exports.getMyArticles = async (req, res) => {
    try {
        const articles = await Article.find({ submittedBy: req.user._id })
            .sort({ createdAt: -1 });

        res.json({ success: true, articles });
    } catch (error) {
        console.error('Get my articles error:', error);
        res.status(500).json({ message: 'Server error while fetching articles.' });
    }
};

// @desc Get single article by articleId
// @route GET /api/articles/:articleId
// @access Private
exports.getArticleById = async (req, res) => {
    try {
        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        res.json({ success: true, article });
    } catch (error) {
        console.error('Get article error:', error);
        res.status(500).json({ message: 'Server error while fetching article.' });
    }
};

// @desc Resubmit a paper after plagiarism rejection (Revision Required)
// @route PUT /api/articles/:articleId/resubmit
// @access Private
exports.resubmitArticle = async (req, res) => {
    try {
        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Revision Required') {
            return res.status(400).json({ message: 'Only papers with "Revision Required" status can be resubmitted.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload the revised paper file.' });
        }

        // Archive current submission into revision history
        article.revisionHistory.push({
            paperFile: article.paperFile,
            originalFileName: article.originalFileName,
            plagiarismReport: article.plagiarismReport,
            plagiarismPercent: article.plagiarismPercent,
            aiSimilarityReport: article.aiSimilarityReport,
            aiSimilarityPercent: article.aiSimilarityPercent,
            plagiarismRemark: article.plagiarismRemark,
            plagiarismDecision: article.plagiarismDecision,
            resubmittedAt: new Date(),
        });

        // Update with new paper
        article.paperFile = req.file.path.replace(/\\/g, '/');
        article.originalFileName = req.file.originalname;

        // Clear plagiarism fields
        article.plagiarismReport = undefined;
        article.plagiarismPercent = undefined;
        article.aiSimilarityReport = undefined;
        article.aiSimilarityPercent = undefined;
        article.plagiarismRemark = undefined;
        article.plagiarismDecision = undefined;

        // Reset status
        article.status = 'Submitted';
        await article.save();

        res.json({
            success: true,
            message: 'Paper resubmitted successfully. It will be reviewed again.',
            article: {
                articleId: article.articleId,
                title: article.title,
                status: article.status,
                originalFileName: article.originalFileName,
            },
        });
    } catch (error) {
        console.error('Resubmit article error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ message: 'Server error while resubmitting article.' });
    }
};

// @desc Resubmit a revised paper after reviewer revision request (Review Revision)
// @route PUT /api/articles/:articleId/resubmit-revised
// @access Private
exports.resubmitRevisedPaper = async (req, res) => {
    try {
        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        })
            .populate('reviewer1', 'email name fullName')
            .populate('reviewer2', 'email name fullName')
            .populate('technicalReviewer', 'email name fullName');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Review Revision') {
            return res.status(400).json({ message: 'Only papers with "Review Revision" status can be revised.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload the revised paper file.' });
        }

        const newFilePathNorm = req.file.path.replace(/\\/g, '/');

        // Capture the ORIGINAL file references BEFORE overwriting them (needed for history)
        const originalPaperFileBeforeRevision = article.paperFile;
        const originalFileNameBeforeRevision = article.originalFileName;

        // Return to the reviewer stage that requested the revision
        const returnStage = article.reviewRevisionStage;

        // ── Archive the current reviewer report into revision history BEFORE clearing ──
        // This lets the reviewer see their previous review, the original paper, and the
        // revised paper side-by-side when the paper comes back for re-review.
        let oldReport = null;
        if (returnStage === 'Reviewer 1') {
            oldReport = article.reviewer1Report;
        } else if (returnStage === 'Reviewer 2') {
            oldReport = article.reviewer2Report;
        } else if (returnStage === 'Technical Reviewer') {
            oldReport = article.technicalReviewerReport;
        }

        if (oldReport) {
            article.reviewerRevisionHistory.push({
                stage: returnStage,
                decision: oldReport.decision,
                remark: oldReport.remark,
                scores: oldReport.scores ? (oldReport.scores.toObject ? oldReport.scores.toObject() : oldReport.scores) : undefined,
                reviewedAt: oldReport.reviewedAt,
                originalPaperFile: originalPaperFileBeforeRevision,  // the file the reviewer actually reviewed
                originalFileName: originalFileNameBeforeRevision,
                revisedPaperFile: newFilePathNorm,                    // the new revised file from author
                revisedPaperOriginalName: req.file.originalname,
                revisedAt: new Date(),
            });
        }

        // Store new file references
        article.revisedPaperFile = newFilePathNorm;
        article.revisedPaperOriginalName = req.file.originalname;

        // Update the main paper file to the new (revised) version
        article.paperFile = newFilePathNorm;
        article.originalFileName = req.file.originalname;

        if (returnStage) {
            article.status = returnStage;
        } else {
            // Fallback — shouldn't happen but safe
            article.status = 'Reviewer 1';
        }

        // Clear the old reviewer report for the stage that sent it back,
        // so the reviewer gets a fresh review form for the revised paper.
        // NOTE: Must use null + markModified, as assigning `undefined` to a
        // Mongoose sub-document does not reliably persist the unset to MongoDB.
        if (returnStage === 'Reviewer 1') {
            article.reviewer1Report = null;
            article.markModified('reviewer1Report');
        } else if (returnStage === 'Reviewer 2') {
            article.reviewer2Report = null;
            article.markModified('reviewer2Report');
        } else if (returnStage === 'Technical Reviewer') {
            article.technicalReviewerReport = null;
            article.markModified('technicalReviewerReport');
        }

        // Clear revision fields
        article.reviewRevisionStage = undefined;
        article.reviewRevisionRemark = undefined;
        article.reviewRevisionDecision = undefined;

        await article.save();

        // Notify the reviewer that the revised paper is back for re-review
        let reviewerEmail = null;
        if (returnStage === 'Reviewer 1' && article.reviewer1?.email) {
            reviewerEmail = article.reviewer1.email;
        } else if (returnStage === 'Reviewer 2' && article.reviewer2?.email) {
            reviewerEmail = article.reviewer2.email;
        } else if (returnStage === 'Technical Reviewer' && article.technicalReviewer?.email) {
            reviewerEmail = article.technicalReviewer.email;
        }
        if (reviewerEmail) {
            notifUtils.notifyReviewerPaperResubmitted(reviewerEmail, returnStage, article.articleId, article.title);
        }

        res.json({
            success: true,
            message: `Revised paper submitted. Returned to ${article.status} for re-review.`,
            article: {
                articleId: article.articleId,
                title: article.title,
                status: article.status,
                originalFileName: article.originalFileName,
            },
        });
    } catch (error) {
        console.error('Resubmit revised paper error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ message: 'Server error while resubmitting revised paper.' });
    }
};

// @desc Resubmit a fresh paper after reviewer hard-rejection (Reviewer Rejected)
// @route PUT /api/articles/:articleId/resubmit-after-rejection
// @access Private
exports.resubmitAfterRejection = async (req, res) => {
    try {
        const { title, correspondingAuthorName, numberOfAuthors, authors, plagiarismDeclared } = req.body;

        // Validate required fields
        if (!title || !correspondingAuthorName || !numberOfAuthors || !authors || !plagiarismDeclared) {
            if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload the new paper file.' });
        }

        // Parse authors
        let parsedAuthors;
        try {
            parsedAuthors = typeof authors === 'string' ? JSON.parse(authors) : authors;
        } catch {
            if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ message: 'Invalid authors data format.' });
        }

        if (!Array.isArray(parsedAuthors) || parsedAuthors.length === 0) {
            if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ message: 'Please provide at least one author.' });
        }

        for (const author of parsedAuthors) {
            if (!author.name || !author.email) {
                if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
                return res.status(400).json({ message: 'Each author must have a name and email.' });
            }
        }

        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Reviewer Rejected') {
            return res.status(400).json({ message: 'Only papers with "Reviewer Rejected" status can be resubmitted here.' });
        }

        // Archive current submission into revision history
        article.revisionHistory.push({
            paperFile: article.paperFile,
            originalFileName: article.originalFileName,
            plagiarismReport: article.plagiarismReport,
            plagiarismPercent: article.plagiarismPercent,
            aiSimilarityReport: article.aiSimilarityReport,
            aiSimilarityPercent: article.aiSimilarityPercent,
            plagiarismRemark: article.plagiarismRemark,
            plagiarismDecision: article.plagiarismDecision,
            resubmittedAt: new Date(),
        });

        // Update paper metadata with fresh submission data
        article.title = title.trim();
        article.correspondingAuthor = {
            name: correspondingAuthorName.trim(),
            email: req.user.email,
        };
        article.numberOfAuthors = parseInt(numberOfAuthors, 10);
        article.authors = parsedAuthors;
        article.plagiarismDeclared = plagiarismDeclared === 'true' || plagiarismDeclared === true;

        // Replace paper file
        article.paperFile = req.file.path.replace(/\\/g, '/');
        article.originalFileName = req.file.originalname;

        // Clear ALL reviewer data — paper goes through the full process again
        article.reviewer1Report = undefined;
        article.reviewer2Report = undefined;
        article.technicalReviewerReport = undefined;
        article.reviewRevisionStage = undefined;
        article.reviewRevisionRemark = undefined;
        article.reviewRevisionDecision = undefined;
        article.reviewRejectionStage = undefined;
        article.reviewRejectionRemark = undefined;

        // Clear plagiarism data — admin must re-check the new file
        article.plagiarismReport = undefined;
        article.plagiarismPercent = undefined;
        article.aiSimilarityReport = undefined;
        article.aiSimilarityPercent = undefined;
        article.plagiarismRemark = undefined;
        article.plagiarismDecision = undefined;

        // Reset to Submitted for fresh plagiarism check + review pipeline
        article.status = 'Submitted';
        await article.save();

        res.json({
            success: true,
            message: 'Paper resubmitted successfully. It will go through the full review process again.',
            article: {
                articleId: article.articleId,
                title: article.title,
                status: article.status,
                originalFileName: article.originalFileName,
            },
        });
    } catch (error) {
        console.error('Resubmit after rejection error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ message: 'Server error while resubmitting paper.' });
    }
};

