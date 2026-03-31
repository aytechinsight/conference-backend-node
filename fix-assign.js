const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');
const Article = require('./models/Article');
const User = require('./models/User');

(async () => {
    await connectDB();

    const r1List = await User.find({ role: 'reviewer 1' });
    const r2List = await User.find({ role: 'reviewer 2' });
    const trList = await User.find({ role: 'technical reviewer' });

    console.log('Reviewer 1 count:', r1List.length);
    console.log('Reviewer 2 count:', r2List.length);
    console.log('Technical Reviewer count:', trList.length);

    if (r1List.length !== 1 || r2List.length !== 1 || trList.length !== 1) {
        console.log('Not exactly 1 of each reviewer role. Skipping.');
        process.exit(0);
    }

    const r1 = r1List[0];
    const r2 = r2List[0];
    const tr = trList[0];

    // Find ALL active articles missing any reviewer slot
    const activeStatuses = ['Submitted', 'Reviewer 1', 'Reviewer 2', 'Technical Reviewer'];
    const articlesToFix = await Article.find({
        status: { $in: activeStatuses },
        $or: [
            { reviewer1: { $exists: false } }, { reviewer1: null },
            { reviewer2: { $exists: false } }, { reviewer2: null },
            { technicalReviewer: { $exists: false } }, { technicalReviewer: null },
        ]
    });

    console.log('Articles needing reviewer patch:', articlesToFix.length);

    for (const article of articlesToFix) {
        const wasFullyUnassigned = !article.reviewer1 && !article.reviewer2 && !article.technicalReviewer;

        if (!article.reviewer1) article.reviewer1 = r1._id;
        if (!article.reviewer2) article.reviewer2 = r2._id;
        if (!article.technicalReviewer) article.technicalReviewer = tr._id;

        if (wasFullyUnassigned) article.status = 'Reviewer 1';

        await article.save();
        console.log(`  Patched: ${article.articleId} (status: ${article.status})`);
    }

    console.log('Done!');
    process.exit(0);
})();

