const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Initialise VAPID details once on startup
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@icreate.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('[push] VAPID keys not set — push notifications disabled.');
}

// @desc  Save / upsert a push subscription for the logged-in user
// @route POST /api/push/subscribe
// @access Private
exports.subscribe = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ message: 'Invalid push subscription data.' });
        }

        await PushSubscription.findOneAndUpdate(
            { endpoint },
            { user: req.user._id, endpoint, keys },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, message: 'Push subscription saved.' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ message: 'Server error saving push subscription.' });
    }
};

// @desc  Remove a push subscription
// @route DELETE /api/push/subscribe
// @access Private
exports.unsubscribe = async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ message: 'Endpoint is required.' });

        await PushSubscription.findOneAndDelete({ endpoint, user: req.user._id });
        res.json({ success: true, message: 'Push subscription removed.' });
    } catch (err) {
        console.error('Push unsubscribe error:', err);
        res.status(500).json({ message: 'Server error removing push subscription.' });
    }
};

// @desc  Return the VAPID public key so the frontend can subscribe
// @route GET /api/push/vapid-public-key
// @access Public
exports.getVapidPublicKey = (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ message: 'Push notifications not configured.' });
    res.json({ publicKey: key });
};

/**
 * Send a push notification to all subscriptions for a given user ID.
 * Call this from other controllers (e.g. notificationController) when a
 * notification is created.
 *
 * @param {string} userId  - MongoDB ObjectId string
 * @param {object} payload - { title, body, icon, data: { url } }
 */
exports.sendPushToUser = async (userId, payload) => {
    if (!process.env.VAPID_PUBLIC_KEY) return; // not configured

    try {
        const subscriptions = await PushSubscription.find({ user: userId });
        if (!subscriptions.length) return;

        const message = JSON.stringify(payload);
        const results = await Promise.allSettled(
            subscriptions.map((sub) =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    message
                )
            )
        );

        // Clean up expired / invalid subscriptions
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === 'rejected') {
                const status = r.reason?.statusCode;
                if (status === 404 || status === 410) {
                    await PushSubscription.findByIdAndDelete(subscriptions[i]._id);
                }
            }
        }
    } catch (err) {
        console.error('[push] sendPushToUser error:', err);
    }
};
