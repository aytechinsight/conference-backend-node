/**
 * resetCounters.js
 * ─────────────────────────────────────────────────
 * Resets the article counter so the next article
 * gets ART-001 instead of continuing from the old
 * sequence. Also resets the user counter.
 *
 * Run with:  node scripts/resetCounters.js
 * ─────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Counter } = require('../models/Counter');

async function reset() {
    console.log('\n🔌  Connecting to MongoDB …');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to:', mongoose.connection.name, '\n');

    // Show current counters
    const counters = await Counter.find({});
    console.log('📋  Current counters:');
    counters.forEach(c => console.log(`    • ${c._id} = ${c.seq}`));

    // Reset all counters to 0
    const result = await Counter.updateMany({}, { $set: { seq: 0 } });
    console.log(`\n🔄  Reset ${result.modifiedCount} counter(s) to 0.`);

    // Also delete the newly created user and article so you can start fresh
    const User = require('../models/User');
    const Article = require('../models/Article');

    const delUsers = await User.deleteMany({ role: 'user' });
    console.log(`🗑️   Deleted ${delUsers.deletedCount} regular user(s).`);

    const delArticles = await Article.deleteMany({});
    console.log(`🗑️   Deleted ${delArticles.deletedCount} article(s).`);

    console.log('\n✅  Counters reset & data cleaned. Next user will be USR001, next article ART-001.\n');
    await mongoose.disconnect();
    process.exit(0);
}

reset().catch(err => {
    console.error('❌  Error:', err.message);
    process.exit(1);
});
