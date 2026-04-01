const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createOrder,
    verifyPayment,
    getPlans,
} = require('../controllers/paymentController');

router.get('/plans', getPlans);
router.post('/create-order/:articleId', protect, createOrder);
router.post('/verify/:articleId', protect, verifyPayment);

module.exports = router;
