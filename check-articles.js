const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');
const Article = require('./models/Article');
const User = require('./models/User');

(async () => {
    await connectDB();

    const articles = await Article.find({
        status: { $in: ['Submitted', 'Reviewer 1', 'Reviewer 2', 'Technical Reviewer'] }
    }).lean();

    console.log(`Total active articles: ${articles.length}`);
    for (const a of articles) {
        console.log(`\n--- ${a.articleId} | status: ${a.status}`);
        console.log('  reviewer1:', a.reviewer1 || 'MISSING');
        console.log('  reviewer2:', a.reviewer2 || 'MISSING');
        console.log('  technicalReviewer:', a.technicalReviewer || 'MISSING');
    }

    // Also show all reviewer users
    const r1 = await User.find({ role: 'reviewer 1' }).lean();
    const r2 = await User.find({ role: 'reviewer 2' }).lean();
    const tr = await User.find({ role: 'technical reviewer' }).lean();
    console.log('\n--- Reviewers ---');
    console.log('R1:', r1.map(u => `${u.name} (${u._id})`));
    console.log('R2:', r2.map(u => `${u.name} (${u._id})`));
    console.log('TR:', tr.map(u => `${u.name} (${u._id})`));

    process.exit(0);
})();
