const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const {
    submitArticle,
    getMyArticles,
    getArticleById,
    resubmitArticle,
    resubmitRevisedPaper,
    resubmitAfterRejection,
} = require('../controllers/articleController');

// Multer storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/papers');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter — only PDF, DOC, DOCX
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Routes
router.post('/', protect, upload.single('paperFile'), submitArticle);
router.get('/my', protect, getMyArticles);
router.get('/:articleId', protect, getArticleById);
router.put('/:articleId/resubmit', protect, upload.single('paperFile'), resubmitArticle);
router.put('/:articleId/resubmit-revised', protect, upload.single('paperFile'), resubmitRevisedPaper);
router.put('/:articleId/resubmit-after-rejection', protect, upload.single('paperFile'), resubmitAfterRejection);

module.exports = router;
