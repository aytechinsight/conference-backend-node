const SiteConfig = require('../models/SiteConfig');

// @desc  Get current site configuration (public)
// @route GET /api/site-config
// @access Public
exports.getSiteConfig = async (req, res) => {
    try {
        const config = await SiteConfig.getOrCreate();
        res.json({ success: true, config });
    } catch (error) {
        console.error('Get site config error:', error);
        res.status(500).json({ message: 'Server error while fetching site configuration.' });
    }
};

// @desc  Update payment plans
// @route PUT /api/site-config/payment-plans
// @access Superadmin
exports.updatePaymentPlans = async (req, res) => {
    try {
        const { paymentPlans } = req.body;
        if (!Array.isArray(paymentPlans) || paymentPlans.length === 0) {
            return res.status(400).json({ message: 'paymentPlans must be a non-empty array.' });
        }

        for (const plan of paymentPlans) {
            if (!plan.key || !plan.label || !plan.group || !plan.amount || !plan.currency) {
                return res.status(400).json({ message: 'Each plan must have key, label, group, amount, and currency.' });
            }
            if (!['Indian', 'International'].includes(plan.group)) {
                return res.status(400).json({ message: `Invalid group "${plan.group}". Must be Indian or International.` });
            }
            if (!['INR', 'USD'].includes(plan.currency)) {
                return res.status(400).json({ message: `Invalid currency "${plan.currency}". Must be INR or USD.` });
            }
            if (typeof plan.amount !== 'number' || plan.amount <= 0) {
                return res.status(400).json({ message: 'Each plan amount must be a positive number.' });
            }
        }

        const config = await SiteConfig.findOneAndUpdate(
            { _singleton: 'config' },
            { $set: { paymentPlans } },
            { new: true, upsert: true }
        );

        res.json({ success: true, message: 'Payment plans updated.', config });
    } catch (error) {
        console.error('Update payment plans error:', error);
        res.status(500).json({ message: 'Server error while updating payment plans.' });
    }
};

// @desc  Update important dates
// @route PUT /api/site-config/important-dates
// @access Superadmin
exports.updateImportantDates = async (req, res) => {
    try {
        const { importantDates } = req.body;
        if (!Array.isArray(importantDates) || importantDates.length === 0) {
            return res.status(400).json({ message: 'importantDates must be a non-empty array.' });
        }

        for (const d of importantDates) {
            if (!d.label || !d.date) {
                return res.status(400).json({ message: 'Each date entry must have a label and date.' });
            }
        }

        const config = await SiteConfig.findOneAndUpdate(
            { _singleton: 'config' },
            { $set: { importantDates } },
            { new: true, upsert: true }
        );

        res.json({ success: true, message: 'Important dates updated.', config });
    } catch (error) {
        console.error('Update important dates error:', error);
        res.status(500).json({ message: 'Server error while updating important dates.' });
    }
};

// @desc  Update homepage card details
// @route PUT /api/site-config/homepage-card
// @access Superadmin
exports.updateHomepageCard = async (req, res) => {
    try {
        const { homepageCard } = req.body;
        if (!homepageCard || typeof homepageCard !== 'object') {
            return res.status(400).json({ message: 'homepageCard must be an object.' });
        }

        const config = await SiteConfig.findOneAndUpdate(
            { _singleton: 'config' },
            { $set: { homepageCard } },
            { new: true, upsert: true }
        );

        res.json({ success: true, message: 'Homepage card updated.', config });
    } catch (error) {
        console.error('Update homepage card error:', error);
        res.status(500).json({ message: 'Server error while updating homepage card.' });
    }
};
