const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');
const Article = require('./models/Article');
const User = require('./models/User');

(async () => {
    await connectDB();

    // Get all reviewer users
    const r1List = await User.find({ role: 'reviewer 1' }).lean();
    const r2List = await User.find({ role: 'reviewer 2' }).lean();
    const trList = await User.find({ role: 'technical reviewer' }).lean();

    console.log('R1_COUNT=' + r1List.length);
    console.log('R2_COUNT=' + r2List.length);
    console.log('TR_COUNT=' + trList.length);

    if (r1List.length !== 1 || r2List.length !== 1 || trList.length !== 1) {
        console.log('Not exactly 1 of each role, aborting patch.');
        process.exit(0);
    }

    const r1 = r1List[0];
    const r2 = r2List[0];
    const tr = trList[0];

    console.log('R1=' + r1.name + ' (' + r1._id + ')');
    console.log('R2=' + r2.name + ' (' + r2._id + ')');
    console.log('TR=' + tr.name + ' (' + tr._id + ')');

    // Get ALL active articles
    const articles = await Article.find({
        status: { $in: ['Submitted', 'Reviewer 1', 'Reviewer 2', 'Technical Reviewer'] }
    });

    console.log('TOTAL_ACTIVE_ARTICLES=' + articles.length);

    let patched = 0;
    for (const article of articles) {
        const missingR1 = !article.reviewer1;
        const missingR2 = !article.reviewer2;
        const missingTR = !article.technicalReviewer;

        console.log('ARTICLE=' + article.articleId + ' status=' + article.status + ' missingR1=' + missingR1 + ' missingR2=' + missingR2 + ' missingTR=' + missingTR);

        if (missingR1 || missingR2 || missingTR) {
            const wasFullyUnassigned = missingR1 && missingR2 && missingTR;
            if (missingR1) article.reviewer1 = r1._id;
            if (missingR2) article.reviewer2 = r2._id;
            if (missingTR) article.technicalReviewer = tr._id;
            if (wasFullyUnassigned) article.status = 'Reviewer 1';
            await article.save();
            console.log('  => PATCHED (new status: ' + article.status + ')');
            patched++;
        } else {
            console.log('  => Already fully assigned, skipping.');
        }
    }

    console.log('DONE. Patched ' + patched + ' articles.');
    process.exit(0);
})();
