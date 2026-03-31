const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getAllArticles,
    getReviewers,
    assignReviewers,
    submitPlagiarismCheck,
} = require('../controllers/adminController');

const adminOnly = [protect, authorize('superadmin')];

// Multer storage for plagiarism reports
const reportStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/reports');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const reportUpload = multer({
    storage: reportStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX, PNG, and JPEG files are allowed for reports.'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.get('/articles', ...adminOnly, getAllArticles);
router.get('/reviewers', ...adminOnly, getReviewers);
router.put('/articles/:id/assign', ...adminOnly, assignReviewers);
router.put(
    '/articles/:id/plagiarism-check',
    ...adminOnly,
    reportUpload.fields([
        { name: 'plagiarismReport', maxCount: 1 },
        { name: 'aiSimilarityReport', maxCount: 1 },
    ]),
    submitPlagiarismCheck
);

module.exports = router;
