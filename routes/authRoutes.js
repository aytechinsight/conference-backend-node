const express = require('express');
const router = express.Router();
const {
    sendOtp,
    verifyOtpAndRegister,
    loginUser,
    googleAuth,
    updateProfile,
    getMe,
    forgotPassword,
    resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/verify-register', verifyOtpAndRegister);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.put('/profile', protect, updateProfile);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;

