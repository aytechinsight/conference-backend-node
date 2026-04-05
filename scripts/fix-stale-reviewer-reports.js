/**
 * One-time fix: Clear stale reviewer reports on articles that have been
 * returned to a reviewer stage after revision but still have the old report
 * in MongoDB (because assigning `undefined` to a Mongoose sub-document doesn't
 * reliably call $unset on the field).
 *
 * Run with: node scripts/fix-stale-reviewer-reports.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Article = require('../models/Article');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Articles stuck at 'Reviewer 1' but still have a reviewer1Report with a decision
    const r1Articles = await Article.find({
        status: 'Reviewer 1',
        'reviewer1Report.decision': { $exists: true, $ne: null },
    });
    console.log(`Found ${r1Articles.length} article(s) stuck at Reviewer 1 with stale report`);
    for (const art of r1Articles) {
        art.reviewer1Report = null;
        art.markModified('reviewer1Report');
        await art.save();
        console.log(`  Fixed: ${art.articleId} — cleared stale reviewer1Report`);
    }

    // Same for Reviewer 2
    const r2Articles = await Article.find({
        status: 'Reviewer 2',
        'reviewer2Report.decision': { $exists: true, $ne: null },
        // Only articles that have come back from revision (reviewer1Report was already done)
        'reviewer1Report.decision': { $exists: true, $ne: null },
    });
    // Note: We don't clear reviewer2Report for R2 unless it's actually been returned to R2 for re-review.
    // The above query is intentionally conservative — only if BOTH reports exist at R2 stage.
    // Typically if at R2, reviewer1 is done, so skip R2 fix unless you know an article is in this state.
    console.log(`Found ${r2Articles.length} article(s) stuck at Reviewer 2 with stale report (skipping auto-fix — verify manually)`);

    // Same for Technical Reviewer
    const trArticles = await Article.find({
        status: 'Technical Reviewer',
        'technicalReviewerReport.decision': { $exists: true, $ne: null },
    });
    // Only clear if both R1 and R2 reports are done (meaning paper is legitimately at Technical stage
    // and was returned for revision) — but this is complex to detect; do it only if reviewRevisionStage was set
    // In practice, just check if it's at TechReviewer and has a stale technicalReviewerReport
    const trFixed = trArticles.filter(a =>
        a.reviewer1Report?.decision && a.reviewer2Report?.decision
    );
    console.log(`Found ${trFixed.length} article(s) stuck at Technical Reviewer with stale report`);
    for (const art of trFixed) {
        art.technicalReviewerReport = null;
        art.markModified('technicalReviewerReport');
        await art.save();
        console.log(`  Fixed: ${art.articleId} — cleared stale technicalReviewerReport`);
    }

    console.log('\nDone! Restart your backend server now.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
