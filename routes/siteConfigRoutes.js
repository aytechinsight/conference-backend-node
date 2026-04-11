const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getSiteConfig,
    updatePaymentPlans,
    updateImportantDates,
    updateHomepageCard,
} = require('../controllers/siteConfigController');

const superadminOnly = [protect, authorize('superadmin')];

// Public — read config
router.get('/', getSiteConfig);

// Superadmin — update sections
router.put('/payment-plans',  ...superadminOnly, updatePaymentPlans);
router.put('/important-dates', ...superadminOnly, updateImportantDates);
router.put('/homepage-card',  ...superadminOnly, updateHomepageCard);

module.exports = router;
