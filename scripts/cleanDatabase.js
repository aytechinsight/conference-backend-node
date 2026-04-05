/**
 * cleanDatabase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deletes:
 *   • All Users whose role is "user"  (keeps superadmin / reviewers)
 *   • ALL Articles (papers)
 *
 * Run with:  node scripts/cleanDatabase.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config(); // loads .env from project root (backend/)
const mongoose = require('mongoose');
const User    = require('../models/User');
const Article = require('../models/Article');

const PROTECTED_ROLES = ['superadmin', 'reviewer 1', 'reviewer 2', 'technical reviewer'];

async function clean() {
    console.log('\n🔌  Connecting to MongoDB …');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to:', mongoose.connection.name, '\n');

    /* ── 1. Show what will be kept ─────────────────────────────────────── */
    const kept = await User.find({ role: { $in: PROTECTED_ROLES } }, 'name email role');
    console.log(`👥  Users that will be KEPT (${kept.length}):`);
    kept.forEach(u => console.log(`    • [${u.role}] ${u.name || '(no name)'} — ${u.email}`));

    /* ── 2. Delete regular users ───────────────────────────────────────── */
    const userResult = await User.deleteMany({ role: 'user' });
    console.log(`\n🗑️   Deleted ${userResult.deletedCount} regular user(s).`);

    /* ── 3. Delete all articles ────────────────────────────────────────── */
    const articleResult = await Article.deleteMany({});
    console.log(`🗑️   Deleted ${articleResult.deletedCount} article/paper(s).`);

    console.log('\n✅  Database cleaned successfully.\n');
    await mongoose.disconnect();
    process.exit(0);
}

clean().catch(err => {
    console.error('❌  Error:', err.message);
    process.exit(1);
});
