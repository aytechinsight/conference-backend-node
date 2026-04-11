const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getMyAssignedArticles,
    submitReview,
    submitTRPlagiarismCheck,
} = require('../controllers/reviewerController');

const reviewerOnly = [protect, authorize('reviewer 1', 'reviewer 2', 'technical reviewer')];
const trOnly = [protect, authorize('technical reviewer')];

// Multer storage for TR plagiarism reports
const reportStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/reports'),
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, suffix + path.extname(file.originalname));
    },
});
const reportUpload = multer({
    storage: reportStorage,
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
        ];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, DOC, DOCX, PNG, and JPEG are allowed for reports.'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

// Get assigned articles (each role sees only their own)
router.get('/articles', ...reviewerOnly, getMyAssignedArticles);

// Reviewer 1 & 2: submit full review with scores
router.put('/articles/:id/review', ...reviewerOnly, submitReview);

// Technical Reviewer: submit plagiarism & similarity check (no scores)
router.put(
    '/articles/:id/plagiarism-check',
    ...trOnly,
    reportUpload.fields([
        { name: 'plagiarismReport', maxCount: 1 },
        { name: 'aiSimilarityReport', maxCount: 1 },
    ]),
    submitTRPlagiarismCheck
);

module.exports = router;
