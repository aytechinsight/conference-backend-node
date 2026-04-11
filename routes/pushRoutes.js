const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getVapidPublicKey } = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', protect, subscribe);
router.delete('/subscribe', protect, unsubscribe);

module.exports = router;
