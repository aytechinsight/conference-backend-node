const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
    getStats,
    getAllUsers,
    createReviewer,
    deleteUser,
    getAllPayments,
    attachCertificate,
    sendCertificateToAuthor,
} = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const superadminOnly = [protect, authorize('superadmin')];

// Multer storage for certificates
const certStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'certificates');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `cert_${req.params.articleId}_${Date.now()}${ext}`);
    },
});
const uploadCert = multer({
    storage: certStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only PDF and image files are allowed for certificates.'));
    },
});

router.get('/stats', ...superadminOnly, getStats);
router.get('/users', ...superadminOnly, getAllUsers);
router.post('/create-reviewer', ...superadminOnly, createReviewer);
router.delete('/users/:id', ...superadminOnly, deleteUser);

// Payment routes
router.get('/payments', ...superadminOnly, getAllPayments);
router.put('/articles/:articleId/certificate', ...superadminOnly, uploadCert.single('certificateFile'), attachCertificate);
router.post('/articles/:articleId/send-certificate', ...superadminOnly, sendCertificateToAuthor);

module.exports = router;
