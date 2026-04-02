const mongoose = require('mongoose');

/**
 * Counter collection for atomic, collision-proof sequential ID generation.
 * Documents:
 *   { _id: 'user_counter',            seq: 0 }
 *   { _id: 'article_counter_<YEAR>',  seq: 0 }
 */
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', CounterSchema);

/**
 * Atomically increment and return the next sequence number for a given key.
 * Uses findOneAndUpdate with $inc — safe for concurrent requests.
 */
async function getNextSequence(key) {
    const result = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );
    return result.seq;
}

module.exports = { Counter, getNextSequence };
