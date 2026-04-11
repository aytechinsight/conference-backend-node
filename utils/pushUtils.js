/**
 * pushUtils.js
 * Web Push notification sender using the web-push library + VAPID.
 * Called alongside in-app DB notifications for real-time device alerts.
 */

const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// Configure VAPID credentials (set these in your .env file)
let vapidConfigured = false;
const configureVapid = () => {
    if (vapidConfigured) return;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const prv = process.env.VAPID_PRIVATE_KEY;
    const sub = process.env.VAPID_SUBJECT || 'mailto:icreate@ayit.edu.in';
    if (!pub || !prv) {
        console.warn('[pushUtils] VAPID keys not found in env. Push notifications disabled.');
        return;
    }
    webPush.setVapidDetails(sub, pub, prv);
    vapidConfigured = true;
};

/**
 * Send a push notification to all active subscriptions for a given MongoDB userId.
 * Automatically removes expired/invalid subscriptions (HTTP 410 Gone).
 */
const sendPushToUser = async (userId, payload) => {
    try {
        configureVapid();
        if (!vapidConfigured) return;

        const subs = await PushSubscription.find({ user: userId }).lean();
        if (!subs.length) return;

        const message = JSON.stringify({
            title: payload.title || 'iCreate Notification',
            body:  payload.message || '',
            icon:  '/icreatelogo.png',
            badge: '/icreatelogo.png',
            tag:   payload.type || 'general',
            data:  { url: payload.url || '/dashboard/user/notifications' },
        });

        await Promise.allSettled(
            subs.map(async (sub) => {
                try {
                    await webPush.sendNotification(
                        { endpoint: sub.endpoint, keys: sub.keys },
                        message
                    );
                } catch (err) {
                    // 410 Gone or 404 → subscription is no longer valid, delete it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await PushSubscription.findByIdAndDelete(sub._id).catch(() => {});
                    }
                }
            })
        );
    } catch (err) {
        console.error('[pushUtils] sendPushToUser error:', err.message);
    }
};

/**
 * Resolve email → userId then send push.
 */
const sendPushToEmail = async (email, payload) => {
    try {
        const user = await User.findOne({ email }).select('_id').lean();
        if (!user) return;
        return sendPushToUser(user._id, payload);
    } catch (err) {
        console.error('[pushUtils] sendPushToEmail error:', err.message);
    }
};

/**
 * Send push notification to all superadmins.
 */
const sendPushToSuperadmins = async (payload) => {
    try {
        const superadmins = await User.find({ role: 'superadmin' }).select('_id').lean();
        for (const sa of superadmins) {
            await sendPushToUser(sa._id, payload);
        }
    } catch (err) {
        console.error('[pushUtils] sendPushToSuperadmins error:', err.message);
    }
};

module.exports = { sendPushToUser, sendPushToEmail, sendPushToSuperadmins };
