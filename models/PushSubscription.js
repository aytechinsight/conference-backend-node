const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Browser-generated endpoint URL unique to this device + browser
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
    },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
