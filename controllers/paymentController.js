const Razorpay = require('razorpay');
const crypto = require('crypto');
const Article = require('../models/Article');
const emailUtils = require('../utils/emailUtils');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Registration plans with amounts
const PLANS = {
    'Peer Reviewed Journal - Indian': { amount: 2800, currency: 'INR' },
    'Scopus Student - Indian': { amount: 8000, currency: 'INR' },
    'Scopus Faculty - Indian': { amount: 9500, currency: 'INR' },
    'Peer Reviewed Journal - International': { amount: 70, currency: 'USD' },
    'Scopus Student - International': { amount: 120, currency: 'USD' },
    'Scopus Faculty - International': { amount: 150, currency: 'USD' },
};

// @desc  Create Razorpay order for an accepted article
// @route POST /api/payment/create-order/:articleId
// @access Private
exports.createOrder = async (req, res) => {
    try {
        const { planKey } = req.body;

        if (!planKey || !PLANS[planKey]) {
            return res.status(400).json({
                message: `Invalid plan. Choose one of: ${Object.keys(PLANS).join(', ')}`,
            });
        }

        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.status !== 'Accepted') {
            return res.status(400).json({ message: 'Payment can only be made for accepted papers.' });
        }

        const plan = PLANS[planKey];
        // Razorpay expects amount in smallest currency unit (paise for INR, cents for USD)
        const amountInSmallest = plan.currency === 'INR' ? plan.amount * 100 : plan.amount * 100;

        const order = await razorpay.orders.create({
            amount: amountInSmallest,
            currency: plan.currency,
            receipt: `rcpt_${article.articleId}_${Date.now()}`,
            notes: {
                articleId: article.articleId,
                title: article.title,
                plan: planKey,
            },
        });

        // Store order details on the article
        article.selectedPlan = planKey;
        article.paymentAmount = plan.amount;
        article.paymentCurrency = plan.currency;
        article.paymentStatus = 'Pending';
        article.razorpayOrderId = order.id;
        await article.save();

        res.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error while creating payment order.' });
    }
};

// @desc  Verify Razorpay payment
// @route POST /api/payment/verify/:articleId
// @access Private
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification fields.' });
        }

        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        }).populate('submittedBy', 'email fullName name');

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        if (article.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({ message: 'Order ID mismatch.' });
        }

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed — invalid signature.' });
        }

        // Payment verified
        article.razorpayPaymentId = razorpay_payment_id;
        article.razorpaySignature = razorpay_signature;
        article.paymentStatus = 'Completed';
        article.paidAt = new Date();
        article.status = 'Payment';
        await article.save();

        // Notify author
        if (article.submittedBy?.email) {
            const symbol = article.paymentCurrency === 'INR' ? '₹' : '$';
            emailUtils.sendPaymentConfirmationEmail(
                article.submittedBy.email,
                article.articleId,
                article.title,
                `${symbol}${article.paymentAmount}`
            );
        }

        res.json({
            success: true,
            message: 'Payment verified successfully.',
            status: article.status,
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: 'Server error while verifying payment.' });
    }
};

// @desc  Get available plans
// @route GET /api/payment/plans
// @access Public
exports.getPlans = (req, res) => {
    res.json({ success: true, plans: PLANS });
};
