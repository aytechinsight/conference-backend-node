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
    attachAuthorCertificate,
    attachPublicationLink,
    sendCertificatesToAuthors,
} = require('../controllers/superadminController');
const { sendNewsletter } = require('../controllers/newsletterController');
const { protect, authorize } = require('../middleware/authMiddleware');

const superadminOnly = [protect, authorize('superadmin')];

// Multer storage for per-author certificates
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
    limits: { fileSize: 20 * 1024 * 1024 },
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

// Payment & certificate routes
router.get('/payments', ...superadminOnly, getAllPayments);

// Upload certificate for a specific author (authorIndex in body)
router.put(
    '/articles/:articleId/author-certificate',
    ...superadminOnly,
    uploadCert.single('certificateFile'),
    attachAuthorCertificate
);

// Save / update the publication link (no file)
router.put('/articles/:articleId/publication-link', ...superadminOnly, attachPublicationLink);

// Send certificates to all authors + mark as Published
router.post('/articles/:articleId/send-certificates', ...superadminOnly, sendCertificatesToAuthors);

// Newsletter
router.post('/newsletter', ...superadminOnly, sendNewsletter);

module.exports = router;
